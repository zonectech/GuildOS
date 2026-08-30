import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { CommunityModel } from '../../models/community.model';
import { EventModel } from '../../models/event.model';
import { MembershipModel } from '../../models/membership.model';
import { PlatformSettingsModel } from '../../models/platform-settings.model';
import { PremiumPaymentModel } from '../../models/premium-payment.model';
import { TicketPaymentModel } from '../../models/ticket-payment.model';
import { SponsorshipPaymentModel } from '../../models/sponsorship-payment.model';
import { WalletPayoutModel, type WalletPayout } from '../../models/wallet-payout.model';
import { WalletSpendLockModel } from '../../models/wallet-spend-lock.model';
import { authStore } from '../../store/auth-store';
import { getPaymentGateway, getPremiumEventPrice, getPremiumMonthlyPrice } from '../premium.service';
import { initiateBankTransfer, isGatewayConfigured } from '../payment-gateway.service';
import { hasCommunityPermission } from './community-shared';

/**
 * Community ticket wallet. All ticket money is collected into the platform
 * gateway account; each PAID TicketPayment credits `organizerAmount` to the
 * event's community. Leaders (TREASURER+) see the balance and request payouts;
 * platform admins settle them by bank transfer and mark them PAID.
 */

const MIN_PAYOUT_NGN = 1000;

/**
 * Serializes wallet-spending operations per community (premium debits, payout
 * requests) so a double-click or a retried request can't read-then-write the
 * balance twice before the first write lands. The unique index on
 * `WalletSpendLockModel.communityId` makes acquisition a single atomic insert —
 * no multi-document transaction (and no replica-set requirement) needed.
 */
async function withWalletSpendLock<T>(communityId: string, fn: () => Promise<T>): Promise<T> {
  try {
    await WalletSpendLockModel.create({ communityId });
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: number }).code === 11000) {
      throw new Error('A wallet payment is already in progress for this community — please try again in a moment');
    }
    throw error;
  }
  try {
    return await fn();
  } finally {
    await WalletSpendLockModel.deleteOne({ communityId }).catch(() => {});
  }
}

/** MANUAL = admin settles by bank transfer and marks paid; AUTO = gateway transfer fires on request. */
export async function getPayoutMode(): Promise<'MANUAL' | 'AUTO'> {
  const settings = await PlatformSettingsModel.findOneAndUpdate(
    { key: 'GLOBAL' },
    { $setOnInsert: { key: 'GLOBAL' } },
    { new: true, upsert: true },
  ).lean();
  return settings.payoutMode === 'AUTO' ? 'AUTO' : 'MANUAL';
}

export async function setPayoutMode(mode: string): Promise<'MANUAL' | 'AUTO'> {
  const value = mode === 'AUTO' ? 'AUTO' : 'MANUAL';
  await PlatformSettingsModel.findOneAndUpdate({ key: 'GLOBAL' }, { $set: { payoutMode: value } }, { upsert: true });
  return value;
}

async function requireWalletAccess(communityId: string, actorId: string) {
  const membership = await MembershipModel.findOne({ communityId, userId: actorId, status: 'ACTIVE' });
  if (!membership || !hasCommunityPermission(membership.role, 'TREASURER')) {
    throw new Error('Only community leaders (Treasurer and above) can view the wallet');
  }
  return membership;
}

async function walletTotals(communityId: string) {
  const id = new mongoose.Types.ObjectId(communityId);
  // ESCROW: earnings are only withdrawable once the event has actually happened
  // (COMPLETED, or archived after completion — pre-event archives refund buyers
  // so their payments stop being PAID). This means cancellation refunds always
  // come out of held funds and the platform is never left fronting money for an
  // organizer who withdrew and then cancelled.
  const earnedRows = await TicketPaymentModel.aggregate<{ total: number; count: number; released: number }>([
    { $match: { communityId: id, status: 'PAID' } },
    { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
    { $unwind: '$event' },
    {
      $group: {
        _id: null,
        total: { $sum: '$organizerAmount' },
        count: { $sum: { $ifNull: ['$quantity', 1] } },
        released: { $sum: { $cond: [{ $in: ['$event.status', ['COMPLETED', 'ARCHIVED']] }, '$organizerAmount', 0] } },
      },
    },
  ]);
  const earned = earnedRows[0] ?? { total: 0, count: 0, released: 0 };

  // Sponsorship money paid through the gateway follows the same escrow rule:
  // the community's share releases only once the event actually happened.
  const sponsorRows = await SponsorshipPaymentModel.aggregate<{ total: number; count: number; released: number }>([
    { $match: { communityId: id, status: 'PAID' } },
    { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
    { $unwind: '$event' },
    {
      $group: {
        _id: null,
        total: { $sum: '$organizerAmount' },
        count: { $sum: 1 },
        released: { $sum: { $cond: [{ $in: ['$event.status', ['COMPLETED', 'ARCHIVED']] }, '$organizerAmount', 0] } },
      },
    },
  ]);
  const sponsored = sponsorRows[0] ?? { total: 0, count: 0, released: 0 };
  const totalEarned = earned.total + sponsored.total;
  const totalReleased = earned.released + sponsored.released;

  const payoutRows = await WalletPayoutModel.aggregate<{ _id: string; total: number }>([
    { $match: { communityId: id, status: { $in: ['PENDING', 'PAID'] } } },
    { $group: { _id: '$status', total: { $sum: '$amount' } } },
  ]);
  const paidOut = payoutRows.find((r) => r._id === 'PAID')?.total ?? 0;
  const pending = payoutRows.find((r) => r._id === 'PENDING')?.total ?? 0;

  return {
    ticketsSold: earned.count,
    sponsorshipsPaid: sponsored.count,
    earnedNgn: Math.round(totalEarned / 100),
    /** Earnings from events that haven't happened yet — released at completion. */
    heldNgn: Math.round((totalEarned - totalReleased) / 100),
    paidOutNgn: Math.round(paidOut / 100),
    pendingPayoutNgn: Math.round(pending / 100),
    availableNgn: Math.round((totalReleased - paidOut - pending) / 100),
  };
}

/** Raw balance snapshot without the TREASURER gate — used by community deletion for its money-safety guard. */
export async function communityWalletSnapshot(communityId: string) {
  return walletTotals(communityId);
}

export async function getCommunityWallet(communityId: string, actorId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }
  await requireWalletAccess(communityId, actorId);

  const totals = await walletTotals(communityId);

  const sales = await TicketPaymentModel.find({ communityId, status: 'PAID' }).sort({ paidAt: -1 }).limit(50).lean();
  const eventIds = [...new Set(sales.map((s) => String(s.eventId)))];
  const events = await EventModel.find({ _id: { $in: eventIds } }).select('title slug').lean();
  const eventById = new Map(events.map((e) => [String(e._id), e]));
  const buyers = await authStore.getPublicUsersByIds(sales.map((s) => String(s.userId)));

  const payouts = await WalletPayoutModel.find({ communityId }).sort({ createdAt: -1 }).limit(50).lean();

  return {
    ...totals,
    currency: 'NGN',
    payoutMode: await getPayoutMode(),
    sales: sales.map((s) => ({
      _id: String(s._id),
      eventTitle: eventById.get(String(s.eventId))?.title ?? 'Event',
      eventSlug: eventById.get(String(s.eventId))?.slug ?? '',
      buyerName: buyers.get(String(s.userId))?.fullName ?? 'Attendee',
      ticketNgn: Math.round(s.baseAmount / 100),
      commissionNgn: Math.round(s.commissionAmount / 100),
      earnedNgn: Math.round(s.organizerAmount / 100),
      paidAt: s.paidAt,
    })),
    payouts: payouts.map(serializePayout),
  };
}

export async function requestWalletPayout(
  communityId: string,
  actorId: string,
  input: { amountNgn?: number; bankName?: string; accountNumber?: string; accountName?: string },
) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }
  await requireWalletAccess(communityId, actorId);

  const bankName = String(input.bankName ?? '').trim();
  const accountNumber = String(input.accountNumber ?? '').trim();
  const accountName = String(input.accountName ?? '').trim();
  if (!bankName || !accountNumber || !accountName) {
    throw new Error('Bank name, account number, and account name are required');
  }

  const amountNgn = Math.round(Number(input.amountNgn) || 0);
  if (amountNgn < MIN_PAYOUT_NGN) {
    throw new Error(`Minimum payout is ₦${MIN_PAYOUT_NGN.toLocaleString()}`);
  }

  const payout = await withWalletSpendLock(communityId, async () => {
    const existing = await WalletPayoutModel.findOne({ communityId, status: 'PENDING' });
    if (existing) {
      throw new Error('You already have a pending payout request — wait for it to be processed');
    }

    const totals = await walletTotals(communityId);
    if (amountNgn > totals.availableNgn) {
      throw new Error(
        totals.heldNgn > 0
          ? `Only ₦${totals.availableNgn.toLocaleString()} is available — ₦${totals.heldNgn.toLocaleString()} is held until your events take place`
          : `Only ₦${totals.availableNgn.toLocaleString()} is available to withdraw`,
      );
    }

    return WalletPayoutModel.create({
      communityId,
      requestedBy: actorId,
      amount: amountNgn * 100,
      bankName,
      accountNumber,
      accountName,
    });
  });

  // AUTO mode: fire the gateway transfer right away. Any failure (no keys, OTP-locked
  // account, ambiguous bank name, low balance) leaves the request PENDING for manual
  // settlement — the organizer never sees a dead end.
  if ((await getPayoutMode()) === 'AUTO') {
    const gateway = await getPaymentGateway();
    if (isGatewayConfigured(gateway)) {
      try {
        const reference = `PYT-${String(payout._id).slice(-8)}-${Date.now().toString(36)}`;
        const { transferRef } = await initiateBankTransfer({
          gateway,
          amountNgn,
          bankName,
          accountNumber,
          accountName,
          reference,
          reason: 'GuildOS ticket earnings payout',
        });
        payout.status = 'PAID';
        payout.note = `Auto transfer via ${gateway} (${transferRef})`;
        payout.transferReference = reference;
        payout.transferRef = transferRef;
        payout.processedAt = new Date();
        await payout.save();
      } catch (error) {
        payout.note = `Auto transfer failed: ${error instanceof Error ? error.message : 'gateway error'} — will be settled manually`;
        await payout.save();
      }
    } else {
      payout.note = 'Auto payouts are on, but no payment gateway key is configured — will be settled manually';
      await payout.save();
    }
  }

  return serializePayout(payout.toObject());
}

/**
 * Pay for premium straight from the community's ticket-earnings wallet.
 * No gateway fee (it's an internal ledger move) and it works even when card
 * payments are unconfigured. The debit is recorded as an instantly-PAID
 * WalletPayout row (so the balance math and the payout history both see it)
 * plus a PAID PremiumPayment (provider WALLET) for the premium history.
 * Only released (post-event) funds can be spent — same rule as withdrawals.
 */
async function walletPremiumDebit(options: {
  communityId: string;
  actorId: string;
  priceNgn: number;
  label: string;
  scope: 'MONTHLY' | 'EVENT';
  eventId?: string;
}) {
  const { communityId, actorId, priceNgn, label, scope, eventId } = options;
  if (priceNgn <= 0) throw new Error('Premium price is not configured');

  const totals = await walletTotals(communityId);
  if (priceNgn > totals.availableNgn) {
    throw new Error(
      totals.heldNgn > 0
        ? `Wallet has ₦${totals.availableNgn.toLocaleString()} available (₦${totals.heldNgn.toLocaleString()} is held until your events take place) — ₦${priceNgn.toLocaleString()} is needed`
        : `Wallet balance is ₦${totals.availableNgn.toLocaleString()} — ₦${priceNgn.toLocaleString()} is needed`,
    );
  }

  const reference = `WAL-${communityId.slice(-6)}-${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date();

  // Debit first — if entitlement application fails the money shows in history and
  // support can resolve; the reverse (free premium) is the outcome we can't allow.
  await WalletPayoutModel.create({
    communityId,
    requestedBy: actorId,
    amount: priceNgn * 100,
    bankName: 'GuildOS',
    accountNumber: 'INTERNAL',
    accountName: label,
    status: 'PAID',
    note: `${label} — paid from wallet balance (${reference})`,
    processedAt: now,
  });

  const payment = await PremiumPaymentModel.create({
    communityId,
    eventId: eventId ?? null,
    scope,
    initiatedBy: actorId,
    provider: 'WALLET',
    reference,
    amount: priceNgn * 100,
    baseAmount: priceNgn * 100,
    feeAmount: 0,
    currency: 'NGN',
    status: 'PAID',
    paidAt: now,
  });

  return { payment, now };
}

/** One month of premium, funded by the wallet (President+). */
export async function payMonthlyPremiumFromWallet(communityId: string, actorId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community) throw new Error('Community not found');
  const membership = await MembershipModel.findOne({ communityId, userId: actorId, status: 'ACTIVE' });
  if (!membership || !hasCommunityPermission(membership.role, 'PRESIDENT')) {
    throw new Error('Only community leaders can manage premium');
  }

  return withWalletSpendLock(communityId, async () => {
    const priceNgn = await getPremiumMonthlyPrice();
    const { payment, now } = await walletPremiumDebit({ communityId, actorId, priceNgn, label: 'GuildOS Premium (1 month)', scope: 'MONTHLY' });

    // Re-read inside the lock — another request may have just extended premium.
    const fresh = await CommunityModel.findById(communityId);
    if (!fresh) throw new Error('Community not found');
    const base = fresh.premiumExpiresAt && fresh.premiumExpiresAt > now ? fresh.premiumExpiresAt : now;
    const periodEnd = new Date(base);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    fresh.isPremium = true;
    fresh.premiumExpiresAt = periodEnd;
    await fresh.save();

    payment.periodStart = now;
    payment.periodEnd = periodEnd;
    await payment.save();

    return { status: 'PAID' as const, premiumExpiresAt: periodEnd, paidFromWallet: true as const };
  });
}

/** Per-event premium unlock, funded by the wallet (Treasurer+ in the owning community). */
export async function payEventPremiumFromWallet(eventId: string, actorId: string) {
  const event = await EventModel.findById(eventId);
  if (!event || event.deletedAt) throw new Error('Event not found');
  if (event.premiumUnlocked) return { status: 'PAID' as const, alreadyUnlocked: true as const };
  const communityId = event.communityId.toString();
  const membership = await MembershipModel.findOne({ communityId, userId: actorId, status: 'ACTIVE' });
  if (!membership || !hasCommunityPermission(membership.role, 'TREASURER')) {
    throw new Error('Only community leaders (Treasurer and above) can spend the wallet');
  }

  return withWalletSpendLock(communityId, async () => {
    // Re-read inside the lock — a concurrent request may have just unlocked it.
    const fresh = await EventModel.findById(eventId);
    if (!fresh || fresh.deletedAt) throw new Error('Event not found');
    if (fresh.premiumUnlocked) return { status: 'PAID' as const, alreadyUnlocked: true as const };

    const priceNgn = await getPremiumEventPrice();
    await walletPremiumDebit({ communityId, actorId, priceNgn, label: `Premium unlock — ${fresh.title}`.slice(0, 120), scope: 'EVENT', eventId });

    fresh.premiumUnlocked = true;
    await fresh.save();

    return { status: 'PAID' as const, eventId, paidFromWallet: true as const };
  });
}

/** Balance preview for the "pay from wallet" buttons — event managers included (no TREASURER gate; read-only number). */
export async function walletBalanceForPremium(communityId: string) {
  const totals = await walletTotals(communityId);
  return { availableNgn: totals.availableNgn };
}

/**
 * Transfer-status webhook: settle the matching auto payout. Failed/reversed
 * transfers flip the payout back to PENDING so an admin retries manually —
 * the money never silently disappears.
 */
export async function applyTransferWebhook(transferRefOrReference: string, status: string) {
  const payout = await WalletPayoutModel.findOne({
    $or: [{ transferRef: transferRefOrReference }, { transferReference: transferRefOrReference }],
  });
  if (!payout) return { matched: false as const };

  const normalized = status.toLowerCase();
  if (['successful', 'succeeded', 'success', 'completed'].includes(normalized)) {
    if (payout.status !== 'PAID') {
      payout.status = 'PAID';
      payout.processedAt = payout.processedAt ?? new Date();
      payout.note = `${payout.note ? `${payout.note} · ` : ''}Transfer confirmed by gateway webhook`;
      await payout.save();
    }
  } else if (['failed', 'reversed', 'error'].includes(normalized)) {
    payout.status = 'PENDING';
    payout.processedAt = null;
    payout.note = `${payout.note ? `${payout.note} · ` : ''}Gateway reported transfer ${normalized} — needs manual settlement`;
    await payout.save();
  }
  return { matched: true as const, status: payout.status };
}

function serializePayout(p: {
  _id: unknown;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: string;
  note: string;
  createdAt: Date;
  processedAt: Date | null;
}) {
  return {
    _id: String(p._id),
    amountNgn: Math.round(p.amount / 100),
    bankName: p.bankName,
    accountNumber: p.accountNumber,
    accountName: p.accountName,
    status: p.status,
    note: p.note,
    requestedAt: p.createdAt,
    processedAt: p.processedAt,
  };
}

// ── Platform admin oversight ─────────────────────────────────────────────────

/** Platform-wide ticket economics + per-event breakdown for the admin console. */
export async function adminTicketOverview() {
  const [totals] = await TicketPaymentModel.aggregate<{
    sold: number;
    gross: number;
    fees: number;
    commission: number;
    organizer: number;
  }>([
    { $match: { status: 'PAID' } },
    {
      $group: {
        _id: null,
        sold: { $sum: { $ifNull: ['$quantity', 1] } },
        gross: { $sum: '$amount' },
        fees: { $sum: '$feeAmount' },
        commission: { $sum: '$commissionAmount' },
        organizer: { $sum: '$organizerAmount' },
      },
    },
  ]);

  const payoutRows = await WalletPayoutModel.aggregate<{ _id: string; total: number }>([
    { $match: { status: { $in: ['PENDING', 'PAID'] } } },
    { $group: { _id: '$status', total: { $sum: '$amount' } } },
  ]);
  const paidOut = payoutRows.find((r) => r._id === 'PAID')?.total ?? 0;
  const pendingPayouts = payoutRows.find((r) => r._id === 'PENDING')?.total ?? 0;

  // Refund exposure: money already sent back vs. queued for manual settlement.
  const refundRows = await TicketPaymentModel.aggregate<{ _id: string; total: number }>([
    { $match: { status: { $in: ['REFUNDED', 'REFUND_DUE'] } } },
    { $group: { _id: '$status', total: { $sum: '$amount' } } },
  ]);
  const refunded = refundRows.find((r) => r._id === 'REFUNDED')?.total ?? 0;
  const refundsDue = refundRows.find((r) => r._id === 'REFUND_DUE')?.total ?? 0;

  const perEvent = await TicketPaymentModel.aggregate<{
    _id: unknown;
    sold: number;
    gross: number;
    commission: number;
    organizer: number;
    lastSaleAt: Date;
  }>([
    { $match: { status: 'PAID' } },
    {
      $group: {
        _id: '$eventId',
        sold: { $sum: { $ifNull: ['$quantity', 1] } },
        gross: { $sum: '$amount' },
        commission: { $sum: '$commissionAmount' },
        organizer: { $sum: '$organizerAmount' },
        lastSaleAt: { $max: '$paidAt' },
      },
    },
    { $sort: { lastSaleAt: -1 } },
    { $limit: 100 },
  ]);

  const events = await EventModel.find({ _id: { $in: perEvent.map((r) => r._id) } }).select('title slug communityId ticketPrice').lean();
  const eventById = new Map(events.map((e) => [String(e._id), e]));
  const communities = await CommunityModel.find({ _id: { $in: events.map((e) => e.communityId) } }).select('name slug').lean();
  const communityById = new Map(communities.map((c) => [String(c._id), c]));

  return {
    totals: {
      ticketsSold: totals?.sold ?? 0,
      grossNgn: Math.round((totals?.gross ?? 0) / 100),
      gatewayFeesNgn: Math.round((totals?.fees ?? 0) / 100),
      commissionNgn: Math.round((totals?.commission ?? 0) / 100),
      organizerNgn: Math.round((totals?.organizer ?? 0) / 100),
      paidOutNgn: Math.round(paidOut / 100),
      pendingPayoutsNgn: Math.round(pendingPayouts / 100),
      /** What the platform still holds on behalf of organizers. */
      owedToOrganizersNgn: Math.round(((totals?.organizer ?? 0) - paidOut) / 100),
      refundedNgn: Math.round(refunded / 100),
      refundsDueNgn: Math.round(refundsDue / 100),
    },
    events: perEvent.map((row) => {
      const event = eventById.get(String(row._id));
      const community = event ? communityById.get(String(event.communityId)) : null;
      return {
        eventId: String(row._id),
        title: event?.title ?? 'Event',
        slug: event?.slug ?? '',
        ticketPriceNgn: event?.ticketPrice ?? 0,
        communityName: community?.name ?? '—',
        sold: row.sold,
        grossNgn: Math.round(row.gross / 100),
        commissionNgn: Math.round(row.commission / 100),
        organizerNgn: Math.round(row.organizer / 100),
        lastSaleAt: row.lastSaleAt,
      };
    }),
  };
}

export async function adminListPayouts() {
  const payouts = await WalletPayoutModel.find({}).sort({ status: 1, createdAt: -1 }).limit(200).lean();
  const communities = await CommunityModel.find({ _id: { $in: payouts.map((p) => p.communityId) } }).select('name slug').lean();
  const communityById = new Map(communities.map((c) => [String(c._id), c]));
  const requesters = await authStore.getPublicUsersByIds(payouts.map((p) => String(p.requestedBy)));
  return payouts.map((p) => ({
    ...serializePayout(p),
    communityName: communityById.get(String(p.communityId))?.name ?? '—',
    communitySlug: communityById.get(String(p.communityId))?.slug ?? '',
    requestedByName: requesters.get(String(p.requestedBy))?.fullName ?? '—',
  }));
}

/** Manual refund queue: buyers whose gateway refund failed — the admin settles by transfer.
 *  Covers full refunds (status REFUND_DUE) AND partial day-cancellation refunds that
 *  failed at the gateway (status PAID with refundDueAmount > 0). */
export async function adminListRefundsDue() {
  const payments = await TicketPaymentModel.find({
    $or: [{ status: 'REFUND_DUE' }, { status: 'PAID', refundDueAmount: { $gt: 0 } }],
  }).sort({ updatedAt: 1 }).limit(200).lean();
  const events = await EventModel.find({ _id: { $in: payments.map((p) => p.eventId) } }).select('title slug').lean();
  const eventById = new Map(events.map((e) => [String(e._id), e]));
  const buyers = await authStore.getPublicUsersByIds(payments.map((p) => String(p.userId)));
  return payments.map((p) => ({
    _id: String(p._id),
    reference: p.reference,
    amountNgn: p.status === 'REFUND_DUE' ? Math.round(p.amount / 100) : Math.round((p.refundDueAmount ?? 0) / 100),
    partial: p.status !== 'REFUND_DUE',
    eventTitle: eventById.get(String(p.eventId))?.title ?? 'Event',
    buyerName: buyers.get(String(p.userId))?.fullName ?? '—',
    buyerEmail: buyers.get(String(p.userId))?.email ?? '',
    since: p.updatedAt,
  }));
}

/** Admin confirms they sent the money back manually. */
export async function adminMarkRefunded(paymentId: string) {
  const payment = await TicketPaymentModel.findById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }
  // Partial day-cancellation refund settled by bank transfer: the ticket stays
  // valid (status stays PAID) — just move the due amount into the refunded trail.
  if (payment.status === 'PAID' && (payment.refundDueAmount ?? 0) > 0) {
    const settled = payment.refundDueAmount;
    payment.refundedAmount = (payment.refundedAmount ?? 0) + settled;
    payment.refundDueAmount = 0;
    payment.refundRef = payment.refundRef || 'MANUAL';
    payment.refundedAt = new Date();
    await payment.save();
    return { reference: payment.reference, amountNgn: Math.round(settled / 100) };
  }
  if (payment.status !== 'REFUND_DUE') {
    throw new Error('This payment is not awaiting a manual refund');
  }
  payment.status = 'REFUNDED';
  payment.refundRef = 'MANUAL';
  payment.refundedAt = new Date();
  await payment.save();
  return { reference: payment.reference, amountNgn: Math.round(payment.amount / 100) };
}

export async function adminSetPayoutStatus(payoutId: string, status: 'PAID' | 'REJECTED', adminId: string, note?: string) {
  if (status !== 'PAID' && status !== 'REJECTED') {
    throw new Error('Status must be PAID or REJECTED');
  }
  const payout = await WalletPayoutModel.findById(payoutId);
  if (!payout) {
    throw new Error('Payout request not found');
  }
  if (payout.status !== 'PENDING') {
    throw new Error('This payout request has already been processed');
  }
  payout.status = status;
  payout.note = String(note ?? '').slice(0, 500);
  payout.processedBy = adminId as never;
  payout.processedAt = new Date();
  await payout.save();
  return serializePayout(payout.toObject());
}
