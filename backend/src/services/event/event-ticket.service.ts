import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../../config';
import { EventModel } from '../../models/event.model';
import { EventRegistrationModel, type EventRegistrationStatus } from '../../models/event-registration.model';
import { PlatformSettingsModel } from '../../models/platform-settings.model';
import { TicketPaymentModel } from '../../models/ticket-payment.model';
import { TicketClaimModel } from '../../models/ticket-claim.model';
import { authStore } from '../../store/auth-store';
import {
  getPaymentGateway,
  isPaymentsEnabled,
  getGatewayFeeConfig,
  computeGatewayFeeNgn,
} from '../premium.service';
import { initializeCharge, verifyCharge, isGatewayConfigured, refundCharge, type PaymentGateway } from '../payment-gateway.service';
import { notifyTicketPurchased, notifyTicketSold, notifyTicketClaimed, notifyTicketRefunded, notifyEventCancelled, notifyTicketTransferred, notifyRegistrationCancelledByOrganizer, notifyWaitlistPromoted } from '../event-notification.service';
import { renderTicketPng } from '../ticket-image.service';
import { CommunityModel } from '../../models/community.model';
import { UserModel } from '../../models/user.model';
import { requireEventManager, recalcEventCounters } from './event-shared';
import { inviteTokenValid } from './event-registration.service';

/** GuildOS commission on ticket sales, percent of the ticket price. Admin-configurable. */
export async function getTicketCommissionPercent(): Promise<number> {
  const settings = await PlatformSettingsModel.findOneAndUpdate(
    { key: 'GLOBAL' },
    { $setOnInsert: { key: 'GLOBAL' } },
    { new: true, upsert: true },
  ).lean();
  return settings.ticketCommissionPercent ?? 10;
}

export async function setTicketCommissionPercent(percent: number): Promise<number> {
  const value = Math.min(50, Math.max(0, Number(percent) || 0));
  await PlatformSettingsModel.findOneAndUpdate({ key: 'GLOBAL' }, { $set: { ticketCommissionPercent: value } }, { upsert: true });
  return value;
}

/**
 * Buyer-facing quote. When the event has tiers, each tier is priced individually;
 * `tierName`/`promoCode`/`quantity` produce the exact order total the checkout will
 * charge (fee is grossed up on the ORDER total — cheaper for group buys than per-unit).
 */
export async function getTicketQuote(
  eventId: string,
  options: { tierName?: string; promoCode?: string; quantity?: number } = {},
) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null })
    .select('ticketPrice ticketTiers ticketPromoCodes ticketGroupDiscount status capacity days')
    .lean();
  if (!event) {
    throw new Error('Event not found');
  }

  const feeConfig = await getGatewayFeeConfig();
  const commissionPercent = await getTicketCommissionPercent();
  const promo = resolvePromo(event.ticketPromoCodes ?? [], options.promoCode);
  const quantity = clampQuantity(options.quantity);
  const group = event.ticketGroupDiscount ?? { minQuantity: 0, percentOff: 0 };

  // Per-tier availability (sold = PAID quantity per tier).
  const tiers = event.ticketTiers ?? [];
  const soldByTier = tiers.length ? await soldQuantityByTier(eventId) : new Map<string, number>();
  const cancelledDaySet = new Set((event.days ?? []).reduce<number[]>((acc, d, i) => (d.cancelled ? [...acc, i + 1] : acc), []));
  const tierQuotes = tiers.map((tier) => {
    const unit = discounted(tier.price, promo);
    const sold = soldByTier.get(tier.name) ?? 0;
    const dayCancelled = (tier.days ?? []).length > 0 && tier.days.every((d) => cancelledDaySet.has(d));
    return {
      name: tier.name,
      price: tier.price,
      unitPrice: unit,
      capacity: tier.capacity,
      remaining: tier.capacity > 0 ? Math.max(0, tier.capacity - sold) : null,
      soldOut: (tier.capacity > 0 && sold >= tier.capacity) || dayCancelled,
      /** 1-based days this tier covers ([] = whole event). */
      days: [...(tier.days ?? [])],
      /** True when every day this tier covers has been cancelled — no longer purchasable. */
      dayCancelled,
    };
  });

  // Exact order pricing for the selected (or only) price level.
  const selected = tiers.length
    ? tiers.find((tier) => tier.name === (options.tierName ?? '')) ?? tiers[0]
    : { name: '', price: event.ticketPrice ?? 0, capacity: 0 };
  const applied = bestDiscount(promo, group, quantity);
  const unitPrice = discountedBy(selected.price, applied.percentOff);
  const orderBase = unitPrice * quantity;
  const orderFee = orderBase > 0 ? computeGatewayFeeNgn(orderBase, feeConfig) : 0;

  return {
    price: unitPrice,
    listPrice: selected.price,
    tierName: selected.name,
    quantity,
    base: orderBase,
    fee: orderFee,
    total: orderBase + orderFee,
    currency: 'NGN',
    commissionPercent,
    tiers: tierQuotes,
    promo: promo ? { code: promo.code, percentOff: promo.percentOff } : null,
    promoError: options.promoCode && !promo ? 'This code is invalid or has been used up' : null,
    groupDiscount: group.minQuantity >= 2 && group.percentOff > 0 ? { minQuantity: group.minQuantity, percentOff: group.percentOff } : null,
    /** Which discount actually priced this order (promo and group never stack — best one wins). */
    discountSource: applied.source,
    gateway: await getPaymentGateway(),
    paymentsEnabled: await isPaymentsEnabled(),
  };
}

const MAX_TICKETS_PER_ORDER = 10;

function clampQuantity(value: unknown) {
  return Math.min(MAX_TICKETS_PER_ORDER, Math.max(1, Math.round(Number(value) || 1)));
}

function discounted(priceNgn: number, promo: { percentOff: number } | null) {
  if (!promo) return priceNgn;
  return Math.max(0, Math.round((priceNgn * (100 - promo.percentOff)) / 100));
}

function discountedBy(priceNgn: number, percentOff: number) {
  if (percentOff <= 0) return priceNgn;
  return Math.max(0, Math.round((priceNgn * (100 - percentOff)) / 100));
}

/**
 * Promo codes and the group-buy rule never stack — the buyer gets whichever is
 * better. Returns the winning percent and its source (drives the promo counter:
 * a promo only burns a use when it actually priced the order).
 */
function bestDiscount(
  promo: { percentOff: number } | null,
  group: { minQuantity: number; percentOff: number },
  quantity: number,
): { percentOff: number; source: 'PROMO' | 'GROUP' | null } {
  const promoOff = promo?.percentOff ?? 0;
  const groupOff = group.minQuantity >= 2 && group.percentOff > 0 && quantity >= group.minQuantity ? group.percentOff : 0;
  if (promoOff === 0 && groupOff === 0) return { percentOff: 0, source: null };
  return groupOff > promoOff ? { percentOff: groupOff, source: 'GROUP' } : { percentOff: promoOff, source: 'PROMO' };
}

function resolvePromo(codes: { code: string; percentOff: number; maxUses: number; usedCount: number }[], raw?: string) {
  const code = String(raw ?? '').trim().toUpperCase();
  if (!code) return null;
  const promo = codes.find((p) => p.code === code);
  if (!promo) return null;
  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) return null;
  return promo;
}

/** PAID ticket quantity per tier — drives per-tier sold-out checks. */
async function soldQuantityByTier(eventId: string) {
  const rows = await TicketPaymentModel.aggregate<{ _id: string; sold: number }>([
    { $match: { eventId: new mongoose.Types.ObjectId(eventId), status: 'PAID' } },
    { $group: { _id: '$tierName', sold: { $sum: { $ifNull: ['$quantity', 1] } } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.sold]));
}

/**
 * Starts a ticket purchase. Mirrors the premium checkout flow: creates a PENDING
 * TicketPayment (`TKT-…` reference so webhooks can route it), sends the buyer to
 * the gateway, and the verify step (callback AND webhook, idempotent) creates
 * the registration once the money is confirmed.
 */
export async function startTicketCheckout(
  eventId: string,
  userId: string,
  options: { tierName?: string; promoCode?: string; quantity?: number; inviteToken?: string; referrer?: string } = {},
) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }
  if ((event.ticketPrice ?? 0) <= 0 && !(event.ticketTiers ?? []).length) {
    throw new Error('This event is free — just register');
  }
  if (!['PUBLISHED', 'CHECK_IN'].includes(event.status)) {
    throw new Error('Ticket sales are not open for this event');
  }
  if (event.registrationPolicy === 'INVITE' && !(await inviteTokenValid(eventId, options.inviteToken))) {
    throw new Error('This event is invite only — ask the organizers for an invite link');
  }
  if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
    throw new Error('The registration deadline has passed');
  }
  if (event.registrationClosed) {
    throw new Error('The organizers have closed ticket sales for this event');
  }

  const existing = await EventRegistrationModel.findOne({ eventId, userId });
  if (existing && existing.status !== 'CANCELLED') {
    throw new Error('You already have a ticket for this event');
  }

  const quantity = clampQuantity(options.quantity);

  // Resolve the price level being bought.
  const tiers = event.ticketTiers ?? [];
  let tier: { name: string; price: number; capacity: number; days?: number[] } | null = null;
  if (tiers.length) {
    tier = tiers.find((t) => t.name === (options.tierName ?? '')) ?? null;
    if (!tier) {
      throw new Error('Pick a ticket type');
    }
    const cancelledDaySet = new Set((event.days ?? []).reduce<number[]>((acc, d, i) => (d.cancelled ? [...acc, i + 1] : acc), []));
    if ((tier.days ?? []).length && tier.days!.every((d) => cancelledDaySet.has(d))) {
      throw new Error(`${tier.name} is no longer available — that day of the event was cancelled`);
    }
    if (tier.capacity > 0) {
      const sold = (await soldQuantityByTier(eventId)).get(tier.name) ?? 0;
      if (sold + quantity > tier.capacity) {
        const left = Math.max(0, tier.capacity - sold);
        throw new Error(left === 0 ? `${tier.name} is sold out` : `Only ${left} ${tier.name} ticket${left === 1 ? '' : 's'} left`);
      }
    }
  }
  const listPrice = tier ? tier.price : event.ticketPrice;

  // Paid events never waitlist — capacity is a hard stop before money changes hands.
  const activeCount = await EventRegistrationModel.countDocuments({
    eventId,
    status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] },
  });
  if (event.capacity > 0 && activeCount + quantity > event.capacity) {
    throw new Error('This event is sold out');
  }

  const user = await authStore.getPublicUserById(userId);
  if (!user?.email) {
    throw new Error('A valid account email is required to pay');
  }

  // Promo codes: validate strictly at checkout so buyers get a clear error, not a silent full price.
  const promo = options.promoCode ? resolvePromo(event.ticketPromoCodes ?? [], options.promoCode) : null;
  if (options.promoCode && !promo) {
    throw new Error('This promo code is invalid or has been used up');
  }

  // Best of promo vs group-buy rule — never stacked.
  const applied = bestDiscount(promo, event.ticketGroupDiscount ?? { minQuantity: 0, percentOff: 0 }, quantity);
  const unitPrice = discountedBy(listPrice, applied.percentOff);
  const baseNgn = unitPrice * quantity;
  const feeNgn = baseNgn > 0 ? computeGatewayFeeNgn(baseNgn, await getGatewayFeeConfig()) : 0;
  const totalNgn = baseNgn + feeNgn;
  const commissionPercent = await getTicketCommissionPercent();
  const commissionNgn = Math.round((baseNgn * commissionPercent) / 100);

  const gateway = await getPaymentGateway();
  const reference = `TKT-${event._id.toString().slice(-6)}-${crypto.randomBytes(6).toString('hex')}`;

  // Referral attribution: the ?ref=<username> that brought this buyer. Must resolve to a real
  // account, and self-referrals don't count — you can't earn credit for buying your own ticket.
  let referrer = (options.referrer ?? '').trim().toLowerCase().slice(0, 40);
  if (referrer) {
    const refUser = await UserModel.findOne({ 'profile.username': referrer, deletedAt: null }).select('_id').lean();
    if (!refUser || refUser._id.toString() === userId) referrer = '';
  }

  const payment = await TicketPaymentModel.create({
    eventId: event._id,
    communityId: event.communityId,
    userId,
    provider: gateway,
    reference,
    tierName: tier?.name ?? '',
    referrer,
    // Only recorded (and later counted) when the promo actually priced the order.
    promoCode: applied.source === 'PROMO' ? promo?.code ?? '' : '',
    quantity,
    amount: Math.round(totalNgn * 100),
    baseAmount: Math.round(baseNgn * 100),
    feeAmount: Math.round(feeNgn * 100),
    commissionAmount: Math.round(commissionNgn * 100),
    organizerAmount: Math.round((baseNgn - commissionNgn) * 100),
    currency: 'NGN',
    status: 'PENDING',
  });

  // 100%-discount (or free-tier) orders skip the gateway entirely.
  if (totalNgn <= 0) {
    const registration = await fulfilTicket(payment);
    payment.status = 'PAID';
    payment.paidAt = new Date();
    payment.registrationId = registration._id;
    await payment.save();
    await settleTicketExtras(payment);
    void sendTicketReceipts(payment).catch(() => undefined);
    return { free: true as const, reference };
  }

  if (!isGatewayConfigured(gateway)) {
    await TicketPaymentModel.updateOne({ reference }, { $set: { status: 'FAILED' } });
    throw new Error('Online payment is not configured. Please contact an admin.');
  }

  const callbackUrl = `${config.frontendUrl}/events/${encodeURIComponent(event.slug)}`;
  try {
    const { authorizationUrl } = await initializeCharge({
      gateway,
      email: user.email,
      amountNgn: totalNgn,
      reference,
      callbackUrl,
      metadata: { eventId: event._id.toString(), type: 'TICKET', initiatedBy: userId },
    });
    return { authorizationUrl, reference };
  } catch (error) {
    await TicketPaymentModel.updateOne({ reference }, { $set: { status: 'FAILED' } });
    throw error;
  }
}

/**
 * Creates the CONFIRMED registration for a PAID ticket. Separated from the
 * gateway verification so the money-side and the entitlement-side stay
 * individually testable; idempotent per user+event.
 */
export async function fulfilTicket(payment: { eventId: unknown; userId: unknown; _id: unknown }) {
  const eventId = String(payment.eventId);
  const userId = String(payment.userId);
  const event = await EventModel.findById(eventId);
  if (!event) {
    throw new Error('Event not found');
  }

  let registration = await EventRegistrationModel.findOne({ eventId, userId });
  if (registration && registration.status !== 'CANCELLED') {
    return registration;
  }

  const status: EventRegistrationStatus = 'CONFIRMED';
  registration = registration
    ? Object.assign(registration, { status, registrationType: 'OPEN', communityId: event.communityId, registeredAt: new Date(), qrToken: registration.qrToken || randomUUID() })
    : new EventRegistrationModel({ eventId, communityId: event.communityId, userId, registrationType: 'OPEN', status, qrToken: randomUUID() });
  await registration.save();

  // The payment receipt (notifyTicketPurchased) doubles as the confirmation email.
  await recalcEventCounters(eventId);
  return registration;
}

/** Ticket PNG for email attachment — same design as the on-page download; null on any render hiccup. */
async function renderTicketForEmail(event: {
  title: string;
  startDate?: Date | null;
  venue?: string;
  mode?: string;
  ticketPrice?: number;
  ticketTemplate?: string;
  ticketQrPlacement?: string;
  ticketStyle?: string;
  ticketAccent?: string;
  communityId?: unknown;
}, attendeeName: string, qrToken: string, tierLabel = ''): Promise<Buffer | null> {
  try {
    const community = event.communityId ? await CommunityModel.findById(event.communityId).select('name logo').lean() : null;
    return await renderTicketPng({
      eventTitle: event.title,
      communityName: community?.name ?? 'GuildOS',
      attendeeName,
      dateLabel: event.startDate ? new Date(event.startDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '',
      venueLabel: event.mode === 'VIRTUAL' ? 'Online event' : event.venue || '',
      priceLabel: (event.ticketPrice ?? 0) > 0 ? `₦${(event.ticketPrice ?? 0).toLocaleString()}` : 'FREE ENTRY',
      qrToken,
      templateImage: event.ticketTemplate || '',
      qrPlacement: (event.ticketQrPlacement as 'BOTTOM_RIGHT' | undefined) ?? 'BOTTOM_RIGHT',
      style: (event.ticketStyle as 'MIDNIGHT' | undefined) ?? 'MIDNIGHT',
      accent: event.ticketAccent || '#6366f1',
      logoImage: community?.logo || '',
      tierLabel,
    });
  } catch (error) {
    console.warn('[GuildOS Tickets] ticket render failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Buyer receipt (bell + email w/ ticket PNG) and organizer sale alert — fired once on PENDING→PAID. */
export async function sendTicketReceipts(payment: {
  eventId: unknown;
  userId: unknown;
  amount: number;
  baseAmount: number;
  feeAmount: number;
  reference: string;
  quantity?: number;
  tierName?: string;
}) {
  const event = await EventModel.findById(payment.eventId)
    .select('title slug startDate venue mode meetingLink createdBy communityId ticketPrice ticketTemplate ticketQrPlacement ticketStyle ticketAccent')
    .lean();
  if (!event) return;
  const notifiable = { title: event.title, slug: event.slug, startDate: event.startDate, venue: event.venue, meetingLink: event.meetingLink };
  const buyer = await authStore.getPublicUserById(String(payment.userId));
  const registration = await EventRegistrationModel.findOne({ eventId: payment.eventId, userId: payment.userId }).select('qrToken').lean();
  const ticketPng = registration?.qrToken
    ? await renderTicketForEmail(event, buyer?.fullName ?? 'Attendee', registration.qrToken, payment.tierName ?? '')
    : null;

  notifyTicketPurchased(String(payment.userId), notifiable, {
    totalNgn: Math.round(payment.amount / 100),
    ticketNgn: Math.round(payment.baseAmount / 100),
    feeNgn: Math.round(payment.feeAmount / 100),
    reference: payment.reference,
    quantity: payment.quantity ?? 1,
  }, ticketPng);

  if (event.createdBy) {
    notifyTicketSold(String(event.createdBy), notifiable, {
      ticketNgn: Math.round(payment.baseAmount / 100),
      buyerName: buyer?.fullName ?? 'An attendee',
    });
  }
}

/**
 * Organizer-side registration cancellation ("remove this attendee") — the counterpart to
 * a student cancelling their own spot. Lives here (not event-registration.service) because
 * it must refund paid tickets and this module owns the refund machinery.
 * - A reason is REQUIRED and the attendee sees it (bell + email) — no silent removals.
 * - Paid registrations refund the buyer's full payment automatically (guest claims voided,
 *   buyer notified with the reason) — organizers never keep money for seats they took away.
 * - Blocked once attendance has been recorded (check-ins are certificate evidence).
 * - Frees the seat: the oldest waitlisted person is promoted, same as a self-cancel.
 */
export async function organizerCancelRegistration(eventId: string, registrationId: string, actorId: string, reason: string) {
  const event = await requireEventManager(eventId, actorId);
  const registration = await EventRegistrationModel.findById(registrationId);
  if (!registration || registration.eventId.toString() !== eventId) {
    throw new Error('Registration not found');
  }
  if (['CANCELLED', 'REJECTED'].includes(registration.status)) {
    throw new Error('This registration is already cancelled');
  }
  if (registration.checkInAt || ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'].includes(registration.status)) {
    throw new Error('This attendee has already checked in — attendance records cannot be cancelled');
  }
  const cleanReason = String(reason ?? '').trim().slice(0, 200);
  if (!cleanReason) {
    throw new Error('A reason is required — the attendee will see it');
  }

  const wasConfirmedSeat = registration.status === 'CONFIRMED';

  // Paid ticket → full refund (also cancels their registrations, voids guest claims,
  // and notifies the buyer with the reason via notifyTicketRefunded).
  const payment = await TicketPaymentModel.findOne({ eventId, userId: registration.userId, status: 'PAID' });
  let refunded = false;
  if (payment) {
    await refundOnePaidPayment(payment, { title: event.title, slug: event.slug }, cleanReason);
    refunded = true;
  }

  registration.status = 'CANCELLED';
  registration.cancellationReason = cleanReason;
  registration.cancelledBy = 'ORGANIZER';
  await registration.save();

  // A guest-claimed seat (group buy) goes back to the buyer as a fresh claim link —
  // unless the whole payment was just refunded, which voids the claims instead.
  if (!refunded) {
    const claim = await TicketClaimModel.findOne({ registrationId: registration._id });
    if (claim) {
      claim.claimedBy = null;
      claim.registrationId = null;
      claim.claimedAt = null;
      await claim.save();
    }
    notifyRegistrationCancelledByOrganizer(registration.userId.toString(), { title: event.title, slug: event.slug }, cleanReason);
  }

  // The freed seat goes to the waitlist, same as a self-cancel.
  if (wasConfirmedSeat && event.waitlistEnabled) {
    const nextWaitlisted = await EventRegistrationModel.findOne({ eventId, status: 'WAITLISTED' }).sort({ registeredAt: 1 });
    if (nextWaitlisted) {
      nextWaitlisted.status = 'CONFIRMED';
      await nextWaitlisted.save();
      notifyWaitlistPromoted(String(nextWaitlisted.userId), {
        title: event.title,
        slug: event.slug,
        startDate: event.startDate,
        venue: event.venue,
        meetingLink: event.meetingLink,
      });
    }
  }

  await recalcEventCounters(eventId);
  return { registration, refunded };
}

/**
 * Void one PAID payment: gateway refund (→ REFUNDED) or manual queue (→ REFUND_DUE),
 * cancel the buyer's registration + all guest-claim registrations, delete claims,
 * and tell the buyer. Shared by whole-event cancellation and per-day cancellation.
 */
async function refundOnePaidPayment(
  payment: InstanceType<typeof TicketPaymentModel>,
  event: { title: string; slug: string } | null,
  reason: string,
): Promise<'refunded' | 'queued'> {
  const eventId = String(payment.eventId);
  const amountNgn = Math.round(payment.amount / 100);
  let outcome: 'refunded' | 'queued' = 'refunded';
  // Free orders (100% promo / free tier) have nothing to send back.
  if (amountNgn <= 0) {
    payment.status = 'REFUNDED';
    payment.refundRef = 'FREE_ORDER';
    payment.refundedAt = new Date();
  } else {
    const gateway: PaymentGateway = payment.provider === 'FLUTTERWAVE' ? 'FLUTTERWAVE' : 'PAYSTACK';
    try {
      const { refundRef } = await refundCharge(gateway, payment.reference, amountNgn, reason);
      payment.status = 'REFUNDED';
      payment.refundRef = refundRef;
      payment.refundedAt = new Date();
    } catch (error) {
      payment.status = 'REFUND_DUE';
      payment.refundRef = '';
      console.warn(`[GuildOS Tickets] gateway refund failed for ${payment.reference}:`, error instanceof Error ? error.message : error);
      outcome = 'queued';
    }
  }
  await payment.save();

  // The ticket is void either way — cancel the registration and any guest claims.
  await EventRegistrationModel.updateMany(
    { eventId, userId: payment.userId, status: { $nin: ['CANCELLED', 'REJECTED'] } },
    { $set: { status: 'CANCELLED' } },
  );
  const claims = await TicketClaimModel.find({ paymentId: payment._id });
  for (const claim of claims) {
    if (claim.registrationId) {
      await EventRegistrationModel.updateOne({ _id: claim.registrationId }, { $set: { status: 'CANCELLED' } });
    }
  }
  await TicketClaimModel.deleteMany({ paymentId: payment._id });

  if (event) {
    notifyTicketRefunded(String(payment.userId), { title: event.title, slug: event.slug }, {
      amountNgn,
      queued: payment.status === 'REFUND_DUE',
      reason,
    });
  }
  return outcome;
}

/**
 * Refund every PAID ticket on an event — fired when a paid event is cancelled
 * before it happens. Money goes back through the gateway where possible; failed
 * gateway refunds become REFUND_DUE for the platform admin to settle manually.
 * Either way the payment stops counting toward the organizer's wallet, buyers'
 * registrations are cancelled, and unclaimed guest links die with the payment.
 */
export async function refundEventTickets(eventId: string, reason: string) {
  const payments = await TicketPaymentModel.find({ eventId, status: 'PAID' });
  const event = await EventModel.findById(eventId).select('title slug').lean();
  let refunded = 0;
  let queued = 0;

  for (const payment of payments) {
    const outcome = await refundOnePaidPayment(payment, event, reason);
    if (Math.round(payment.amount / 100) > 0) {
      if (outcome === 'refunded') refunded += 1;
      else queued += 1;
    }
  }

  // Free registrants lose their spot too — cancel + tell them why (no money involved).
  const freeRegs = await EventRegistrationModel.find({ eventId, status: { $nin: ['CANCELLED', 'REJECTED'] } }).select('userId').lean();
  if (freeRegs.length) {
    await EventRegistrationModel.updateMany(
      { eventId, status: { $nin: ['CANCELLED', 'REJECTED'] } },
      { $set: { status: 'CANCELLED' } },
    );
    if (event) {
      for (const reg of freeRegs) {
        notifyEventCancelled(String(reg.userId), { title: event.title, slug: event.slug }, reason);
      }
    }
  }

  await recalcEventCounters(eventId);
  return { refunded, queued };
}

/**
 * Per-day cancellation refunds: only tickets scoped to specific days are refunded,
 * and only when EVERY day they cover is now cancelled (whole-event tickets keep
 * their value — the rest of the programme still runs). Partial overlaps are the
 * organizer's judgment call; buyers are notified either way by the cancel flow.
 */
export async function refundDayScopedTickets(eventId: string, reason: string) {
  const event = await EventModel.findById(eventId).select('title slug ticketTiers days').lean();
  if (!event) return { refunded: 0, queued: 0 };
  const cancelledDays = new Set((event.days ?? []).reduce<number[]>((acc, d, i) => (d.cancelled ? [...acc, i + 1] : acc), []));
  if (!cancelledDays.size) return { refunded: 0, queued: 0 };

  const deadTiers = new Set(
    (event.ticketTiers ?? [])
      .filter((t) => (t.days ?? []).length > 0 && t.days.every((d) => cancelledDays.has(d)))
      .map((t) => t.name),
  );
  if (!deadTiers.size) return { refunded: 0, queued: 0 };

  const payments = await TicketPaymentModel.find({ eventId, status: 'PAID', tierName: { $in: [...deadTiers] } });
  let refunded = 0;
  let queued = 0;
  for (const payment of payments) {
    const outcome = await refundOnePaidPayment(payment, event, reason);
    if (outcome === 'refunded') refunded += 1;
    else queued += 1;
  }
  if (payments.length) await recalcEventCounters(eventId);
  return { refunded, queued };
}

/**
 * Which 1-based days this attendee's ticket covers. null = unrestricted
 * (free registration, whole-event ticket, or tier without day scoping).
 * Guests from group buys inherit the buyer's tier via their claim.
 */
export async function ticketCoveredDays(
  event: { _id: unknown; ticketTiers?: { name: string; days?: number[] }[] },
  userId: string,
  registrationId?: string,
): Promise<number[] | null> {
  const tiers = (event.ticketTiers ?? []).filter((t) => (t.days ?? []).length > 0);
  if (!tiers.length) return null;

  let payment = await TicketPaymentModel.findOne({ eventId: event._id, userId, status: 'PAID' }).sort({ paidAt: -1 }).select('tierName').lean();
  if (!payment && registrationId) {
    const claim = await TicketClaimModel.findOne({ registrationId }).select('paymentId').lean();
    if (claim) {
      payment = await TicketPaymentModel.findOne({ _id: claim.paymentId, status: 'PAID' }).select('tierName').lean();
    }
    // Transferred tickets: the payment stays with the original buyer but keeps
    // pointing at this registration.
    if (!payment) {
      payment = await TicketPaymentModel.findOne({ eventId: event._id, registrationId, status: 'PAID' }).select('tierName').lean();
    }
  }
  if (!payment?.tierName) return null;
  const tier = tiers.find((t) => t.name === payment!.tierName);
  return tier ? [...(tier.days ?? [])] : null;
}

/**
 * Hand a ticket to someone else BEFORE any check-in: the registration moves to
 * the recipient with a fresh QR token; the payment stays with the original buyer
 * (refunds must go back to the card that paid). Guests from group buys hand over
 * their claim the same way.
 */
export async function transferTicket(eventId: string, ownerId: string, recipientQuery: string) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) throw new Error('Event not found');
  if (!['PUBLISHED', 'CHECK_IN'].includes(event.status)) {
    throw new Error('Tickets can only be transferred while the event is upcoming or live');
  }
  if ((event.ticketPrice ?? 0) <= 0 && !(event.ticketTiers ?? []).length) {
    throw new Error('This is a free event — your friend can simply register');
  }

  const registration = await EventRegistrationModel.findOne({ eventId, userId: ownerId });
  if (!registration || ['CANCELLED', 'REJECTED'].includes(registration.status)) {
    throw new Error('You need a confirmed ticket to transfer');
  }
  if (
    registration.checkInAt ||
    (registration.attendanceDays ?? []).some((d) => d.checkInAt) ||
    ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'].includes(registration.status)
  ) {
    throw new Error('This ticket has already been used for check-in and cannot be transferred');
  }
  if (registration.status !== 'CONFIRMED') {
    throw new Error('You need a confirmed ticket to transfer');
  }

  const query = String(recipientQuery ?? '').trim().toLowerCase();
  if (!query) throw new Error('Enter the email or username of the person to transfer to');
  const recipient = await UserModel.findOne({
    $or: [{ email: query }, { 'profile.username': query.replace(/^@/, '') }],
    status: 'ACTIVE',
  }).select('fullName email').lean();
  if (!recipient) throw new Error('No GuildOS account found with that email or username');
  if (String(recipient._id) === ownerId) throw new Error('That is already your ticket');

  const existing = await EventRegistrationModel.findOne({ eventId, userId: recipient._id });
  if (existing && !['CANCELLED', 'REJECTED'].includes(existing.status)) {
    throw new Error(`${recipient.fullName} already has a ticket for this event`);
  }

  // Move the registration itself — payment.registrationId keeps pointing here,
  // so refunds on cancellation still void the right seat.
  registration.userId = recipient._id as any;
  registration.qrToken = randomUUID();
  await registration.save();

  // Claim-born ticket? The claim follows its new holder.
  await TicketClaimModel.updateOne({ registrationId: registration._id }, { $set: { claimedBy: recipient._id } });

  const owner = await authStore.getPublicUserById(ownerId);
  notifyTicketTransferred(String(recipient._id), {
    title: event.title,
    slug: event.slug,
    startDate: event.startDate,
    venue: event.venue,
    meetingLink: event.meetingLink,
  }, owner?.fullName ?? 'Another attendee');

  return { transferred: true as const, to: { fullName: recipient.fullName } };
}

/**
 * One-time side effects of a payment turning PAID: guest claim links for group
 * purchases and the promo-code redemption counter. Called only on the
 * PENDING→PAID transition, so it never double-counts.
 */
export async function settleTicketExtras(payment: {
  _id: unknown;
  eventId: unknown;
  userId: unknown;
  quantity?: number;
  promoCode?: string;
}) {
  const guests = Math.max(0, (payment.quantity ?? 1) - 1);
  if (guests > 0) {
    const existing = await TicketClaimModel.countDocuments({ paymentId: payment._id });
    if (existing === 0) {
      await TicketClaimModel.insertMany(
        Array.from({ length: guests }, () => ({
          eventId: payment.eventId,
          paymentId: payment._id,
          createdBy: payment.userId,
          token: `TKC-${crypto.randomBytes(12).toString('hex')}`,
        })),
      );
    }
  }
  if (payment.promoCode) {
    await EventModel.updateOne(
      { _id: payment.eventId, 'ticketPromoCodes.code': payment.promoCode },
      { $inc: { 'ticketPromoCodes.$.usedCount': 1 } },
    );
  }
}

/** The buyer's guest tickets (group purchase) with claim status — for sharing links. */
export async function listMyTicketClaims(eventId: string, userId: string) {
  const claims = await TicketClaimModel.find({ eventId, createdBy: userId }).sort({ createdAt: 1 }).lean();
  const claimers = await authStore.getPublicUsersByIds(claims.filter((c) => c.claimedBy).map((c) => String(c.claimedBy)));
  return claims.map((c) => ({
    token: c.token,
    claimed: Boolean(c.claimedBy),
    claimedByName: c.claimedBy ? claimers.get(String(c.claimedBy))?.fullName ?? 'Claimed' : null,
  }));
}

/** A guest redeems a claim link — they get their own registration + personal QR. */
export async function claimTicket(token: string, userId: string) {
  const claim = await TicketClaimModel.findOne({ token });
  if (!claim) {
    throw new Error('This ticket link is not valid');
  }
  if (claim.claimedBy) {
    if (String(claim.claimedBy) === userId) {
      return { alreadyYours: true as const };
    }
    throw new Error('This ticket has already been claimed by someone else');
  }

  const existing = await EventRegistrationModel.findOne({ eventId: claim.eventId, userId });
  if (existing && existing.status !== 'CANCELLED') {
    throw new Error('You already have a ticket for this event');
  }

  const registration = await fulfilTicket({ eventId: claim.eventId, userId, _id: claim.paymentId });
  claim.claimedBy = userId as never;
  claim.registrationId = registration._id;
  claim.claimedAt = new Date();
  await claim.save();

  const event = await EventModel.findById(claim.eventId)
    .select('title slug startDate venue mode meetingLink communityId ticketPrice ticketTemplate ticketQrPlacement ticketStyle ticketAccent')
    .lean();
  if (event) {
    // Guest gets their own ticket PNG (their name + their QR) attached to the confirmation.
    const guest = await authStore.getPublicUserById(userId);
    const ticketPng = await renderTicketForEmail(event, guest?.fullName ?? 'Attendee', registration.qrToken);
    notifyTicketClaimed(userId, { title: event.title, slug: event.slug, startDate: event.startDate, venue: event.venue, meetingLink: event.meetingLink }, ticketPng);
  }
  return { claimed: true as const, registrationId: registration._id.toString() };
}

/**
 * Verify a `TKT-…` reference with the gateway and, on success, register the
 * buyer. Idempotent — safe from the return-URL and the webhook simultaneously.
 * Same underpayment/currency guards as premium.
 */
export async function verifyTicketPayment(reference: string) {
  const payment = await TicketPaymentModel.findOne({ reference });
  if (!payment) {
    throw new Error('Payment not found');
  }
  if (payment.status === 'PAID') {
    return { status: 'PAID' as const, alreadyProcessed: true };
  }
  const gateway: PaymentGateway = payment.provider === 'FLUTTERWAVE' ? 'FLUTTERWAVE' : 'PAYSTACK';
  if (!isGatewayConfigured(gateway)) {
    throw new Error('Online payment is not configured');
  }

  const { success, failed, amountNgn, currency } = await verifyCharge(gateway, reference);
  if (!success) {
    if (failed) {
      payment.status = 'FAILED';
      await payment.save();
    }
    return { status: 'FAILED' as const };
  }

  const expectedNgn = payment.amount / 100;
  const currencyOk = !currency || currency === payment.currency;
  const amountOk = typeof amountNgn !== 'number' || amountNgn + 1 >= expectedNgn;
  if (!currencyOk || !amountOk) {
    payment.status = 'FAILED';
    await payment.save();
    console.warn(`[GuildOS Tickets] Rejected ${reference}: paid ${amountNgn} ${currency}, expected ${expectedNgn} ${payment.currency}`);
    return { status: 'FAILED' as const, reason: 'amount_mismatch' as const };
  }

  // If the event was cancelled/deleted while this payment sat PENDING, the
  // cancellation refund sweep never saw it (it only covers PAID rows). Send
  // the money straight back instead of confirming a ticket to a dead event.
  const event = await EventModel.findOne({ _id: payment.eventId, deletedAt: null }).select('status title slug cancellationReason').lean();
  if (!event || event.status === 'ARCHIVED') {
    const reason = event?.cancellationReason || 'Event cancelled';
    const refundNgn = Math.round(payment.amount / 100);
    try {
      const { refundRef } = await refundCharge(gateway, reference, refundNgn, reason);
      payment.status = 'REFUNDED';
      payment.refundRef = refundRef;
      payment.refundedAt = new Date();
    } catch (error) {
      payment.status = 'REFUND_DUE';
      payment.refundRef = '';
      console.warn(`[GuildOS Tickets] late-payment refund failed for ${reference}:`, error instanceof Error ? error.message : error);
    }
    await payment.save();
    if (event) {
      notifyTicketRefunded(String(payment.userId), { title: event.title, slug: event.slug }, {
        amountNgn: refundNgn,
        queued: payment.status === 'REFUND_DUE',
        reason,
      });
    }
    return { status: 'REFUNDED' as const };
  }

  const registration = await fulfilTicket(payment);

  payment.status = 'PAID';
  payment.paidAt = new Date();
  payment.registrationId = registration._id;
  await payment.save();
  await settleTicketExtras(payment);

  // Receipt to the buyer (bell + email w/ ticket attached) and a sale alert to the organizer.
  void sendTicketReceipts(payment).catch(() => undefined);

  return { status: 'PAID' as const, registrationId: registration._id.toString() };
}

/** Organizer-facing sales summary: tickets sold (incl. per-tier), gross, commission, and their net. All NGN. */
export async function getTicketSales(eventId: string, actorId: string) {
  await requireEventManager(eventId, actorId);

  const [paid, eventDoc, checkoutsStarted] = await Promise.all([
    TicketPaymentModel.find({ eventId, status: 'PAID' }).select('baseAmount commissionAmount organizerAmount paidAt createdAt tierName promoCode quantity referrer').lean(),
    EventModel.findById(eventId).select('viewCount').lean(),
    TicketPaymentModel.countDocuments({ eventId }),
  ]);
  const sum = (pick: (p: (typeof paid)[number]) => number) => Math.round(paid.reduce((acc, p) => acc + pick(p), 0) / 100);

  const tierMap = new Map<string, { sold: number; grossNgn: number }>();
  const dayMap = new Map<string, { sold: number; grossNgn: number }>();
  const promoMap = new Map<string, { uses: number; grossNgn: number }>();
  for (const p of paid) {
    const key = p.tierName || 'General';
    const row = tierMap.get(key) ?? { sold: 0, grossNgn: 0 };
    row.sold += p.quantity ?? 1;
    row.grossNgn += Math.round(p.baseAmount / 100);
    tierMap.set(key, row);

    const dayKey = new Date(p.paidAt ?? p.createdAt).toISOString().slice(0, 10);
    const day = dayMap.get(dayKey) ?? { sold: 0, grossNgn: 0 };
    day.sold += p.quantity ?? 1;
    day.grossNgn += Math.round(p.baseAmount / 100);
    dayMap.set(dayKey, day);

    if (p.promoCode) {
      const promo = promoMap.get(p.promoCode) ?? { uses: 0, grossNgn: 0 };
      promo.uses += 1;
      promo.grossNgn += Math.round(p.baseAmount / 100);
      promoMap.set(p.promoCode, promo);
    }
  }

  return {
    sold: paid.reduce((acc, p) => acc + (p.quantity ?? 1), 0),
    grossNgn: sum((p) => p.baseAmount),
    commissionNgn: sum((p) => p.commissionAmount),
    organizerNgn: sum((p) => p.organizerAmount),
    commissionPercent: await getTicketCommissionPercent(),
    tiers: [...tierMap.entries()].map(([name, row]) => ({ name, ...row })),
    /** Sales per calendar day (UTC), oldest first — for a mini trend view. */
    salesByDay: [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, row]) => ({ day, ...row })),
    /** Which promo codes actually converted. */
    promos: [...promoMap.entries()].map(([code, row]) => ({ code, ...row })),
    /** Referral attribution — which shared links converted (sorted best first). */
    referrers: (() => {
      const refMap = new Map<string, { sold: number; grossNgn: number }>();
      for (const p of paid) {
        if (!p.referrer) continue;
        const row = refMap.get(p.referrer) ?? { sold: 0, grossNgn: 0 };
        row.sold += p.quantity ?? 1;
        row.grossNgn += Math.round(p.baseAmount / 100);
        refMap.set(p.referrer, row);
      }
      return [...refMap.entries()].map(([username, row]) => ({ username, ...row })).sort((a, b) => b.sold - a.sold);
    })(),
    /** Conversion funnel: page views → checkouts started → paid. */
    views: eventDoc?.viewCount ?? 0,
    checkoutsStarted,
  };
}

/**
 * Buyer-triggered safety net: verify the viewer's most recent PENDING payment
 * for this event (covers missed redirects — e.g. closed tab, or gateways that
 * can't redirect back to the current origin).
 */
export async function checkMyTicketPayment(eventId: string, userId: string) {
  const pending = await TicketPaymentModel.find({ eventId, userId, status: 'PENDING' }).sort({ createdAt: -1 }).limit(3);
  if (!pending.length) {
    const paid = await TicketPaymentModel.findOne({ eventId, userId, status: 'PAID' });
    return paid ? { status: 'PAID' as const, alreadyProcessed: true } : { status: 'NONE' as const };
  }
  for (const payment of pending) {
    try {
      const result = await verifyTicketPayment(payment.reference);
      if (result.status === 'PAID' || result.status === 'REFUNDED') return result;
    } catch {
      /* try the next pending reference */
    }
  }
  return { status: 'PENDING' as const };
}

/**
 * Scheduler safety net (mirrors reconcilePendingPayments for premium): re-verify
 * PENDING ticket payments aged 2min–24h in case both the callback and webhook
 * were missed; anything older than 24h PENDING is marked FAILED.
 */
export async function reconcilePendingTicketPayments() {
  const now = Date.now();
  const pending = await TicketPaymentModel.find({
    status: 'PENDING',
    createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000), $lte: new Date(now - 2 * 60 * 1000) },
  })
    .limit(50)
    .lean();

  let recovered = 0;
  for (const payment of pending) {
    try {
      const result = await verifyTicketPayment(payment.reference);
      if (result.status === 'PAID') recovered += 1;
    } catch {
      /* gateway hiccup — next run retries */
    }
  }

  await TicketPaymentModel.updateMany(
    { status: 'PENDING', createdAt: { $lt: new Date(now - 24 * 60 * 60 * 1000) } },
    { $set: { status: 'FAILED' } },
  );

  return { recovered, checked: pending.length };
}
