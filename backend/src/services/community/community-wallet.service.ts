import mongoose from 'mongoose';
import { CommunityModel } from '../../models/community.model';
import { EventModel } from '../../models/event.model';
import { MembershipModel } from '../../models/membership.model';
import { PlatformSettingsModel } from '../../models/platform-settings.model';
import { TicketPaymentModel } from '../../models/ticket-payment.model';
import { WalletPayoutModel, type WalletPayout } from '../../models/wallet-payout.model';
import { authStore } from '../../store/auth-store';
import { getPaymentGateway } from '../premium.service';
import { initiateBankTransfer, isGatewayConfigured } from '../payment-gateway.service';
import { hasCommunityPermission } from './community-shared';

/**
 * Community ticket wallet. All ticket money is collected into the platform
 * gateway account; each PAID TicketPayment credits `organizerAmount` to the
 * event's community. Leaders (TREASURER+) see the balance and request payouts;
 * platform admins settle them by bank transfer and mark them PAID.
 */

const MIN_PAYOUT_NGN = 1000;

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

  const payoutRows = await WalletPayoutModel.aggregate<{ _id: string; total: number }>([
    { $match: { communityId: id, status: { $in: ['PENDING', 'PAID'] } } },
    { $group: { _id: '$status', total: { $sum: '$amount' } } },
  ]);
  const paidOut = payoutRows.find((r) => r._id === 'PAID')?.total ?? 0;
  const pending = payoutRows.find((r) => r._id === 'PENDING')?.total ?? 0;

  return {
    ticketsSold: earned.count,
    earnedNgn: Math.round(earned.total / 100),
    /** Earnings from events that haven't happened yet — released at completion. */
    heldNgn: Math.round((earned.total - earned.released) / 100),
    paidOutNgn: Math.round(paidOut / 100),
    pendingPayoutNgn: Math.round(pending / 100),
    availableNgn: Math.round((earned.released - paidOut - pending) / 100),
  };
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

  const payout = await WalletPayoutModel.create({
    communityId,
    requestedBy: actorId,
    amount: amountNgn * 100,
    bankName,
    accountNumber,
    accountName,
  });

  // AUTO mode: fire the gateway transfer right away. Any failure (no keys, OTP-locked
  // account, ambiguous bank name, low balance) leaves the request PENDING for manual
  // settlement — the organizer never sees a dead end.
  if ((await getPayoutMode()) === 'AUTO') {
    const gateway = await getPaymentGateway();
    if (isGatewayConfigured(gateway)) {
      try {
        const { transferRef } = await initiateBankTransfer({
          gateway,
          amountNgn,
          bankName,
          accountNumber,
          accountName,
          reference: `PYT-${String(payout._id).slice(-8)}-${Date.now().toString(36)}`,
          reason: 'GuildOS ticket earnings payout',
        });
        payout.status = 'PAID';
        payout.note = `Auto transfer via ${gateway} (${transferRef})`;
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

/** Manual refund queue: buyers whose gateway refund failed — the admin settles by transfer. */
export async function adminListRefundsDue() {
  const payments = await TicketPaymentModel.find({ status: 'REFUND_DUE' }).sort({ updatedAt: 1 }).limit(200).lean();
  const events = await EventModel.find({ _id: { $in: payments.map((p) => p.eventId) } }).select('title slug').lean();
  const eventById = new Map(events.map((e) => [String(e._id), e]));
  const buyers = await authStore.getPublicUsersByIds(payments.map((p) => String(p.userId)));
  return payments.map((p) => ({
    _id: String(p._id),
    reference: p.reference,
    amountNgn: Math.round(p.amount / 100),
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
