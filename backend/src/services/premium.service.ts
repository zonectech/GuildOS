import crypto from 'node:crypto';
import { config } from '../config';
import { CommunityModel } from '../models/community.model';
import { EventModel } from '../models/event.model';
import { PremiumPaymentModel } from '../models/premium-payment.model';
import { PlatformSettingsModel } from '../models/platform-settings.model';
import { authStore } from '../store/auth-store';
import { getCommunityMembership, hasCommunityPermission } from './community.service';
import { initializeCharge, verifyCharge, isGatewayConfigured, type PaymentGateway } from './payment-gateway.service';
import { computeGatewayFeeNgn, type GatewayFeeConfig } from './payment-fee';

export { computeGatewayFeeNgn };
export type { GatewayFeeConfig };

function addOneMonth(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

async function getSettings() {
  return PlatformSettingsModel.findOneAndUpdate(
    { key: 'GLOBAL' },
    { $setOnInsert: { key: 'GLOBAL' } },
    { new: true, upsert: true },
  ).lean();
}

/** The active payment gateway (only one is used at a time). */
export async function getPaymentGateway(): Promise<PaymentGateway> {
  const settings = await getSettings();
  return settings.paymentGateway === 'FLUTTERWAVE' ? 'FLUTTERWAVE' : 'PAYSTACK';
}

export async function setPaymentGateway(gateway: string): Promise<PaymentGateway> {
  const value: PaymentGateway = gateway === 'FLUTTERWAVE' ? 'FLUTTERWAVE' : 'PAYSTACK';
  await PlatformSettingsModel.findOneAndUpdate({ key: 'GLOBAL' }, { $set: { paymentGateway: value } }, { upsert: true });
  return value;
}

/** Whether online payment is currently possible (active gateway has its key set). */
export async function isPaymentsEnabled(): Promise<boolean> {
  return isGatewayConfigured(await getPaymentGateway());
}

/** The monthly premium price in NGN (naira). Admin-configurable via PlatformSettings. */
export async function getPremiumMonthlyPrice(): Promise<number> {
  const settings = await getSettings();
  return settings.premiumMonthlyPrice ?? 5000;
}

export async function setPremiumMonthlyPrice(price: number): Promise<number> {
  const value = Math.max(0, Math.round(Number(price) || 0));
  await PlatformSettingsModel.findOneAndUpdate({ key: 'GLOBAL' }, { $set: { premiumMonthlyPrice: value } }, { upsert: true });
  return value;
}

/** The per-event premium unlock price in NGN. Admin-configurable. */
export async function getPremiumEventPrice(): Promise<number> {
  const settings = await getSettings();
  return settings.premiumEventPrice ?? 400;
}

export async function setPremiumEventPrice(price: number): Promise<number> {
  const value = Math.max(0, Math.round(Number(price) || 0));
  await PlatformSettingsModel.findOneAndUpdate({ key: 'GLOBAL' }, { $set: { premiumEventPrice: value } }, { upsert: true });
  return value;
}

export async function getGatewayFeeConfig(): Promise<GatewayFeeConfig> {
  const settings = await getSettings();
  return {
    percent: settings.gatewayFeePercent ?? 1.5,
    flat: settings.gatewayFeeFlatNgn ?? 100,
    cap: settings.gatewayFeeCapNgn ?? 2000,
    waiver: settings.gatewayFeeWaiverNgn ?? 2500,
  };
}

export async function setGatewayFeeConfig(patch: Partial<GatewayFeeConfig>): Promise<GatewayFeeConfig> {
  const set: Record<string, number> = {};
  if (patch.percent !== undefined) set.gatewayFeePercent = Math.max(0, Number(patch.percent) || 0);
  if (patch.flat !== undefined) set.gatewayFeeFlatNgn = Math.max(0, Math.round(Number(patch.flat) || 0));
  if (patch.cap !== undefined) set.gatewayFeeCapNgn = Math.max(0, Math.round(Number(patch.cap) || 0));
  if (patch.waiver !== undefined) set.gatewayFeeWaiverNgn = Math.max(0, Math.round(Number(patch.waiver) || 0));
  if (Object.keys(set).length) {
    await PlatformSettingsModel.findOneAndUpdate({ key: 'GLOBAL' }, { $set: set }, { upsert: true });
  }
  return getGatewayFeeConfig();
}


export async function getPremiumStatus(communityId: string) {
  const community = await CommunityModel.findById(communityId).select('isPremium premiumExpiresAt').lean();
  if (!community) {
    throw new Error('Community not found');
  }
  const monthlyPrice = await getPremiumMonthlyPrice();
  const feeCfg = await getGatewayFeeConfig();
  const monthlyFee = computeGatewayFeeNgn(monthlyPrice, feeCfg);
  const eventPrice = await getPremiumEventPrice();
  const eventFee = computeGatewayFeeNgn(eventPrice, feeCfg);
  return {
    isPremium: Boolean(community.isPremium),
    premiumExpiresAt: community.premiumExpiresAt ?? null,
    monthlyPrice,
    monthlyFee,
    monthlyTotal: monthlyPrice + monthlyFee,
    eventPrice,
    eventFee,
    eventTotal: eventPrice + eventFee,
    gateway: await getPaymentGateway(),
    paymentsEnabled: await isPaymentsEnabled(),
  };
}

async function requireLeader(communityId: string, userId: string) {
  const membership = await getCommunityMembership(communityId, userId);
  if (!membership || !hasCommunityPermission(membership.role, 'PRESIDENT')) {
    throw new Error('Only community leaders can manage premium');
  }
}

/**
 * Start a Paystack checkout for one month of premium. Returns the hosted
 * authorization URL to redirect the leader to. The gateway fee is added on top
 * so the buyer covers the processing charge.
 */
export async function startPremiumCheckout(communityId: string, userId: string) {
  const gateway = await getPaymentGateway();
  if (!isGatewayConfigured(gateway)) {
    throw new Error('Online payment is not configured. Please contact an admin.');
  }
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }
  await requireLeader(communityId, userId);

  const user = await authStore.getPublicUserById(userId);
  if (!user?.email) {
    throw new Error('A valid account email is required to pay');
  }

  const priceNgn = await getPremiumMonthlyPrice();
  const feeNgn = computeGatewayFeeNgn(priceNgn, await getGatewayFeeConfig());
  const totalNgn = Math.max(1, priceNgn + feeNgn);
  const baseKobo = Math.round(priceNgn * 100);
  const feeKobo = Math.round(feeNgn * 100);
  const amountKobo = Math.round(totalNgn * 100);
  const reference = `PREM-${community._id.toString().slice(-6)}-${crypto.randomBytes(6).toString('hex')}`;

  await PremiumPaymentModel.create({
    communityId: community._id,
    scope: 'MONTHLY',
    initiatedBy: userId,
    provider: gateway,
    reference,
    amount: amountKobo,
    baseAmount: baseKobo,
    feeAmount: feeKobo,
    currency: 'NGN',
    status: 'PENDING',
  });

  const callbackUrl = `${config.frontendUrl}/dashboard/premium?communityId=${community._id.toString()}`;
  try {
    const { authorizationUrl } = await initializeCharge({
      gateway,
      email: user.email,
      amountNgn: totalNgn,
      reference,
      callbackUrl,
      title: `GuildOS Premium — ${community.name}`,
      metadata: { communityId: community._id.toString(), type: 'PREMIUM', initiatedBy: userId },
    });
    return { authorizationUrl, reference };
  } catch (error) {
    await PremiumPaymentModel.updateOne({ reference }, { $set: { status: 'FAILED' } });
    throw error;
  }
}

async function requireEventManager(eventId: string, userId: string) {
  const event = await EventModel.findById(eventId);
  if (!event || event.deletedAt) {
    throw new Error('Event not found');
  }
  const membership = await getCommunityMembership(event.communityId.toString(), userId);
  const isOwner = event.createdBy.toString() === userId;
  if (!membership || (!isOwner && !hasCommunityPermission(membership.role, 'COORDINATOR'))) {
    throw new Error('Only event managers can unlock premium for this event');
  }
  return event;
}

/** Quote for a per-event premium unlock: base price, gateway fee, and total. */
export async function getEventPremiumQuote(eventId: string, userId: string) {
  const event = await requireEventManager(eventId, userId);
  const community = await CommunityModel.findById(event.communityId).select('isPremium').lean();
  const priceNgn = await getPremiumEventPrice();
  const feeNgn = computeGatewayFeeNgn(priceNgn, await getGatewayFeeConfig());
  return {
    unlocked: Boolean(event.premiumUnlocked) || Boolean(community?.isPremium),
    communityPremium: Boolean(community?.isPremium),
    price: priceNgn,
    fee: feeNgn,
    total: priceNgn + feeNgn,
    gateway: await getPaymentGateway(),
    paymentsEnabled: await isPaymentsEnabled(),
  };
}

/** Start a checkout to unlock premium customization for a single event. */
export async function startEventPremiumCheckout(eventId: string, userId: string) {
  const gateway = await getPaymentGateway();
  if (!isGatewayConfigured(gateway)) {
    throw new Error('Online payment is not configured. Please contact an admin.');
  }
  const event = await requireEventManager(eventId, userId);

  const user = await authStore.getPublicUserById(userId);
  if (!user?.email) {
    throw new Error('A valid account email is required to pay');
  }

  const priceNgn = await getPremiumEventPrice();
  const feeNgn = computeGatewayFeeNgn(priceNgn, await getGatewayFeeConfig());
  const totalNgn = Math.max(1, priceNgn + feeNgn);
  const amountKobo = Math.round(totalNgn * 100);
  const reference = `EVPR-${event._id.toString().slice(-6)}-${crypto.randomBytes(6).toString('hex')}`;

  await PremiumPaymentModel.create({
    communityId: event.communityId,
    eventId: event._id,
    scope: 'EVENT',
    initiatedBy: userId,
    provider: gateway,
    reference,
    amount: amountKobo,
    baseAmount: Math.round(priceNgn * 100),
    feeAmount: Math.round(feeNgn * 100),
    currency: 'NGN',
    status: 'PENDING',
  });

  const callbackUrl = `${config.frontendUrl}/dashboard/events/create?slug=${encodeURIComponent(event.slug)}&communityId=${event.communityId.toString()}`;
  try {
    const { authorizationUrl } = await initializeCharge({
      gateway,
      email: user.email,
      amountNgn: totalNgn,
      reference,
      callbackUrl,
      title: `Premium unlock — ${event.title}`,
      metadata: { eventId: event._id.toString(), type: 'EVENT_PREMIUM', initiatedBy: userId },
    });
    return { authorizationUrl, reference };
  } catch (error) {
    await PremiumPaymentModel.updateOne({ reference }, { $set: { status: 'FAILED' } });
    throw error;
  }
}

/**
 * Verify a payment reference and, on success, apply the entitlement (extend the
 * community's premium by one month, or unlock a single event). Idempotent —
 * safe to call from both the callback and the webhook.
 */
export async function verifyPremiumPayment(reference: string) {
  const payment = await PremiumPaymentModel.findOne({ reference });
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

  // Guard against underpayment / wrong currency before granting anything.
  const expectedNgn = payment.amount / 100;
  const currencyOk = !currency || currency === payment.currency;
  const amountOk = typeof amountNgn !== 'number' || amountNgn + 1 >= expectedNgn; // ₦1 rounding tolerance
  if (!currencyOk || !amountOk) {
    payment.status = 'FAILED';
    await payment.save();
    console.warn(`[GuildOS Premium] Rejected ${reference}: paid ${amountNgn} ${currency}, expected ${expectedNgn} ${payment.currency}`);
    return { status: 'FAILED' as const, reason: 'amount_mismatch' as const };
  }

  const now = new Date();

  // Per-event unlock: flip the single event's premiumUnlocked flag.
  if (payment.scope === 'EVENT' && payment.eventId) {
    const event = await EventModel.findById(payment.eventId);
    if (!event) {
      throw new Error('Event not found');
    }
    event.premiumUnlocked = true;
    await event.save();

    payment.status = 'PAID';
    payment.paidAt = now;
    await payment.save();

    return { status: 'PAID' as const, scope: 'EVENT' as const, eventId: event._id.toString() };
  }

  const community = await CommunityModel.findById(payment.communityId);
  if (!community) {
    throw new Error('Community not found');
  }
  const base = community.premiumExpiresAt && community.premiumExpiresAt > now ? community.premiumExpiresAt : now;
  const periodEnd = addOneMonth(base);

  community.isPremium = true;
  community.premiumExpiresAt = periodEnd;
  await community.save();

  payment.status = 'PAID';
  payment.paidAt = now;
  payment.periodStart = now;
  payment.periodEnd = periodEnd;
  await payment.save();

  return { status: 'PAID' as const, premiumExpiresAt: periodEnd };
}

export async function listPremiumPayments(communityId: string, userId: string) {
  await requireLeader(communityId, userId);
  const payments = await PremiumPaymentModel.find({ communityId }).sort({ createdAt: -1 }).limit(50).lean();
  return payments.map((p) => ({
    reference: p.reference,
    amount: p.amount / 100,
    baseAmount: (p.baseAmount ?? p.amount) / 100,
    feeAmount: (p.feeAmount ?? 0) / 100,
    scope: p.scope ?? 'MONTHLY',
    currency: p.currency,
    status: p.status,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  }));
}

/** Scheduler: downgrade communities whose premium has expired. */
export async function expireLapsedPremium() {
  const now = new Date();
  const result = await CommunityModel.updateMany(
    { isPremium: true, premiumExpiresAt: { $ne: null, $lt: now } },
    { $set: { isPremium: false } },
  );
  return result.modifiedCount ?? 0;
}

/**
 * Scheduler / safety net: re-verify payments left PENDING (e.g. the buyer closed
 * the tab before the callback ran and the webhook never arrived). Re-checks the
 * gateway and applies the entitlement if the charge actually succeeded. Payments
 * still PENDING after 24h are marked FAILED so they stop being retried.
 */
export async function reconcilePendingPayments() {
  const now = Date.now();
  const settleAfter = new Date(now - 2 * 60 * 1000); // give the normal flow 2 min to settle first
  const giveUpAfter = new Date(now - 24 * 60 * 60 * 1000);

  const pending = await PremiumPaymentModel.find({
    status: 'PENDING',
    createdAt: { $lt: settleAfter, $gt: giveUpAfter },
  })
    .sort({ createdAt: 1 })
    .limit(50)
    .lean();

  let recovered = 0;
  for (const p of pending) {
    try {
      const result = await verifyPremiumPayment(p.reference);
      if (result.status === 'PAID' && !('alreadyProcessed' in result && result.alreadyProcessed)) recovered += 1;
    } catch {
      /* leave PENDING for the next run */
    }
  }

  // Expire anything older than 24h so it doesn't linger forever.
  await PremiumPaymentModel.updateMany(
    { status: 'PENDING', createdAt: { $lte: giveUpAfter } },
    { $set: { status: 'FAILED' } },
  );

  return recovered;
}

/**
 * User-triggered "check my payment" for a community — re-verifies any of the
 * community's recent PENDING payments and returns the fresh premium status.
 */
export async function reconcileCommunityPayments(communityId: string, userId: string) {
  await requireLeader(communityId, userId);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pending = await PremiumPaymentModel.find({ communityId, status: 'PENDING', createdAt: { $gt: since } })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  let recovered = 0;
  for (const p of pending) {
    try {
      const result = await verifyPremiumPayment(p.reference);
      if (result.status === 'PAID') recovered += 1;
    } catch {
      /* ignore — still pending */
    }
  }
  return { recovered, pending: pending.length, status: await getPremiumStatus(communityId) };
}

/** User-triggered "check my payment" for a single event unlock. */
export async function reconcileEventPayments(eventId: string, userId: string) {
  const event = await requireEventManager(eventId, userId);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pending = await PremiumPaymentModel.find({ eventId: event._id, status: 'PENDING', createdAt: { $gt: since } })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  let recovered = 0;
  for (const p of pending) {
    try {
      const result = await verifyPremiumPayment(p.reference);
      if (result.status === 'PAID') recovered += 1;
    } catch {
      /* ignore — still pending */
    }
  }
  const fresh = await EventModel.findById(event._id).select('premiumUnlocked').lean();
  return { recovered, pending: pending.length, unlocked: Boolean(fresh?.premiumUnlocked) };
}
