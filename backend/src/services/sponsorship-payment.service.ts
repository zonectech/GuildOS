import crypto from 'node:crypto';
import { config } from '../config';
import { EventModel } from '../models/event.model';
import { EventSponsorModel } from '../models/event-sponsor.model';
import { PlatformSettingsModel } from '../models/platform-settings.model';
import { SponsorshipInquiryModel } from '../models/sponsorship-inquiry.model';
import { SponsorshipPaymentModel, type SponsorshipPaymentHydratedDocument } from '../models/sponsorship-payment.model';
import { UserModel } from '../models/user.model';
import { requireEventManager } from './event/event-shared';
import { initializeCharge, verifyCharge, refundCharge, isGatewayConfigured, type PaymentGateway } from './payment-gateway.service';
import { computeGatewayFeeNgn } from './payment-fee';
import { getGatewayFeeConfig, getPaymentGateway } from './premium.service';
import { createNotification } from './notification.service';
import { congratulationsEmail, warningEmail, sendEmail } from '../utils/email';

/**
 * Sponsor-pays-through-GuildOS flow (`SPN-…` references).
 *
 * This is the structural fix for fee leakage: the platform fee is deducted at
 * source (the organizer never handles it), the community's share sits in the
 * wallet under the same held-until-event-completes escrow rule as ticket money,
 * and event cancellation refunds sponsors automatically. Deals settled off-
 * platform stay possible but earn none of the paid perks (certificate branding,
 * "Paid via GuildOS" badge, unlocked reach report).
 *
 * NOTE: this module must not import from event-core/event.service (it is
 * imported BY event-core for cancellation refunds) — organizer auth goes
 * through event-shared's requireEventManager instead.
 */

async function sponsorshipFeePercent(): Promise<number> {
  const settings = await PlatformSettingsModel.findOneAndUpdate(
    { key: 'GLOBAL' },
    { $setOnInsert: { key: 'GLOBAL' } },
    { new: true, upsert: true },
  ).lean();
  return settings.sponsorshipFeePercent ?? 10;
}

/**
 * Organizer generates a hosted checkout link for a WON deal and shares it with
 * the sponsor (no sponsor account needed). On payment, the fee settles itself.
 */
export async function startSponsorshipCheckout(eventId: string, inquiryId: string, actorId: string) {
  const event = await requireEventManager(eventId, actorId);
  const inquiry = await SponsorshipInquiryModel.findOne({ _id: inquiryId, eventId });
  if (!inquiry) {
    throw new Error('Inquiry not found');
  }
  if (inquiry.status !== 'WON' || inquiry.dealAmount <= 0) {
    throw new Error('Generate the payment link after marking the deal WON with the agreed amount');
  }
  if (inquiry.feeStatus === 'PAID') {
    throw new Error('This deal is already settled');
  }

  const gateway = await getPaymentGateway();
  if (!isGatewayConfigured(gateway)) {
    throw new Error('Online payment is not configured — the GuildOS team will share bank details instead');
  }

  // Reuse a live PENDING checkout instead of minting a new reference per click.
  const existing = await SponsorshipPaymentModel.findOne({ inquiryId, status: 'PENDING' }).sort({ createdAt: -1 });

  const baseNgn = inquiry.dealAmount;
  const feeNgn = computeGatewayFeeNgn(baseNgn, await getGatewayFeeConfig());
  const feePercent = await sponsorshipFeePercent();
  const commissionNgn = Math.round((baseNgn * feePercent) / 100);
  const reference = existing?.reference ?? `SPN-${eventId.slice(-6)}-${crypto.randomBytes(6).toString('hex')}`;

  if (!existing) {
    await SponsorshipPaymentModel.create({
      eventId,
      communityId: event.communityId,
      inquiryId,
      provider: gateway,
      reference,
      companyName: inquiry.companyName,
      sponsorEmail: inquiry.email,
      amount: (baseNgn + feeNgn) * 100,
      baseAmount: baseNgn * 100,
      feeAmount: feeNgn * 100,
      commissionAmount: commissionNgn * 100,
      organizerAmount: (baseNgn - commissionNgn) * 100,
      currency: 'NGN',
      status: 'PENDING',
    });
  }

  const callbackUrl = `${config.frontendUrl}/events/${encodeURIComponent(event.slug)}/sponsor-report?reference=${encodeURIComponent(reference)}`;
  const { authorizationUrl } = await initializeCharge({
    gateway,
    email: inquiry.email,
    amountNgn: baseNgn + feeNgn,
    reference,
    callbackUrl,
    metadata: { kind: 'SPONSORSHIP', eventId, inquiryId, companyName: inquiry.companyName },
  });

  return {
    checkoutUrl: authorizationUrl,
    reference,
    amountNgn: baseNgn + feeNgn,
    breakdown: { dealNgn: baseNgn, gatewayFeeNgn: feeNgn, platformFeeNgn: commissionNgn },
  };
}

/**
 * Verify a `SPN-…` reference with the gateway and, on success, settle the deal:
 * fee PAID, sponsor upgraded to "Paid via GuildOS" (certificate branding perk
 * applied), organizer notified. Late payments to dead events are refunded.
 */
export async function verifySponsorshipPayment(reference: string) {
  const payment = await SponsorshipPaymentModel.findOne({ reference });
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
    if (failed && payment.status === 'PENDING') {
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
    console.warn(`[GuildOS Sponsorship] Rejected ${reference}: paid ${amountNgn} ${currency}, expected ${expectedNgn} ${payment.currency}`);
    return { status: 'FAILED' as const, reason: 'amount_mismatch' as const };
  }

  // Event died while the checkout sat PENDING — send the money straight back.
  const event = await EventModel.findOne({ _id: payment.eventId, deletedAt: null })
    .select('status title slug createdBy sponsorshipPackages cancellationReason')
    .lean();
  if (!event || event.status === 'ARCHIVED') {
    const reason = event?.cancellationReason || 'Event cancelled';
    await refundOneSponsorshipPayment(payment, reason);
    return { status: 'REFUNDED' as const };
  }

  payment.status = 'PAID';
  payment.paidAt = new Date();
  await payment.save();

  const inquiry = await SponsorshipInquiryModel.findById(payment.inquiryId);
  if (inquiry) {
    inquiry.feeStatus = 'PAID';
    await inquiry.save();

    // Paid perks: publish/upgrade the sponsor listing with the platform-paid badge,
    // and deliver certificate branding when the won package includes it.
    const wonPackage = inquiry.packageWon ? event.sponsorshipPackages?.find((p) => p.name === inquiry.packageWon) : undefined;
    const sponsor =
      (await EventSponsorModel.findOne({ eventId: payment.eventId, name: inquiry.companyName })) ??
      new EventSponsorModel({ eventId: payment.eventId, name: inquiry.companyName, logo: '', website: inquiry.website });
    sponsor.paidViaPlatform = true;
    if (wonPackage?.perks?.includes('LOGO_CERTIFICATES')) {
      sponsor.showOnCertificate = true;
    }
    await sponsor.save();
  }

  void createNotification({
    userId: event.createdBy.toString(),
    type: 'SYSTEM',
    title: `Sponsorship payment received for "${event.title}"`,
    body: `${payment.companyName} paid ₦${Math.round(payment.baseAmount / 100).toLocaleString('en-NG')} via GuildOS — the platform fee is settled and their verified report is unlocked.`,
    link: `/dashboard/events/create?slug=${event.slug}`,
  });

  // Receipt + report in the sponsor's inbox — their durable proof of the deal.
  void sendEmail(
    payment.sponsorEmail,
    congratulationsEmail(
      inquiry?.contactName ?? payment.companyName,
      `Payment received — your sponsorship of "${event.title}" is confirmed`,
      `We received ₦${Math.round(payment.amount / 100).toLocaleString('en-NG')} for ${payment.companyName}'s sponsorship of "${event.title}" (ref ${payment.reference}). The deal is settled through GuildOS — refund-protected if the event is cancelled — and your verified reach report is unlocked.`,
      'Open your verified report',
      `${config.frontendUrl}/events/${encodeURIComponent(event.slug)}/sponsor-report`,
    ),
  ).catch(() => undefined);

  return { status: 'PAID' as const };
}

async function refundOneSponsorshipPayment(payment: SponsorshipPaymentHydratedDocument, reason: string) {
  const gateway: PaymentGateway = payment.provider === 'FLUTTERWAVE' ? 'FLUTTERWAVE' : 'PAYSTACK';
  const refundNgn = Math.round(payment.amount / 100);
  try {
    const { refundRef } = await refundCharge(gateway, payment.reference, refundNgn, reason);
    payment.status = 'REFUNDED';
    payment.refundRef = refundRef;
    payment.refundedAt = new Date();
  } catch (error) {
    payment.status = 'REFUND_DUE';
    payment.refundRef = '';
    console.warn(`[GuildOS Sponsorship] refund failed for ${payment.reference}:`, error instanceof Error ? error.message : error);
    // Guardrail: a sponsor is owed money the gateway couldn't return — every admin
    // hears about it immediately (settled via the admin payments queue).
    void (async () => {
      const admins = await UserModel.find({ role: 'ADMIN' }).select('_id').lean();
      await Promise.all(
        admins.map((admin) =>
          createNotification({
            userId: admin._id.toString(),
            type: 'SYSTEM',
            title: 'Sponsorship refund needs manual settlement',
            body: `${payment.companyName} is owed ₦${refundNgn.toLocaleString('en-NG')} (${payment.reference}) — the gateway refund failed (${reason}).`,
            link: '/dashboard/admin',
          }),
        ),
      );
    })().catch(() => undefined);
  }
  await payment.save();

  // Tell the sponsor what happened to their money — refunds must never be silent.
  const refundedEvent = await EventModel.findById(payment.eventId).select('title').lean();
  void sendEmail(
    payment.sponsorEmail,
    warningEmail(
      payment.companyName,
      `Refund for your sponsorship of "${refundedEvent?.title ?? 'the event'}"`,
      payment.status === 'REFUNDED'
        ? `Your sponsorship payment of ₦${refundNgn.toLocaleString('en-NG')} (ref ${payment.reference}) has been refunded to your original payment method because: ${reason}. Depending on your bank it may take a few days to reflect.`
        : `Your sponsorship payment of ₦${refundNgn.toLocaleString('en-NG')} (ref ${payment.reference}) is being refunded because: ${reason}. The automatic refund could not be completed, so the GuildOS team will settle it manually and follow up with you shortly.`,
    ),
  ).catch(() => undefined);

  return payment.status;
}

/**
 * Cancellation protection: refund every platform-paid sponsorship for a dead
 * event. Funds are still held in the wallet (escrow releases only at event
 * completion), so refunds never chase money an organizer already withdrew.
 */
export async function refundEventSponsorships(eventId: string, reason: string) {
  const payments = await SponsorshipPaymentModel.find({ eventId, status: 'PAID' });
  const event = await EventModel.findById(eventId).select('title slug createdBy').lean();
  let refunded = 0;
  let queued = 0;

  for (const payment of payments) {
    const outcome = await refundOneSponsorshipPayment(payment, reason);
    if (outcome === 'REFUNDED') refunded += 1;
    else queued += 1;
  }

  if (payments.length && event) {
    void createNotification({
      userId: event.createdBy.toString(),
      type: 'SYSTEM',
      title: `Sponsor payments refunded for "${event.title}"`,
      body: `${refunded + queued} sponsorship payment${refunded + queued === 1 ? ' was' : 's were'} refunded because the event was cancelled${queued ? ` (${queued} queued for manual settlement)` : ''}.`,
      link: `/dashboard/events/create?slug=${event.slug}`,
    });
  }

  return { refunded, queued };
}

/** Sweep `SPN-…` payments stuck PENDING when a webhook/callback was missed. */
export async function reconcilePendingSponsorshipPayments() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const pending = await SponsorshipPaymentModel.find({ status: 'PENDING', createdAt: { $lt: cutoff } })
    .sort({ createdAt: -1 })
    .limit(50);
  for (const payment of pending) {
    try {
      await verifySponsorshipPayment(payment.reference);
    } catch {
      /* gateway hiccup — retried on the next sweep */
    }
  }
}

/** Admin oversight: every platform sponsorship payment, newest first (money trail). */
export async function adminListSponsorshipPayments() {
  const payments = await SponsorshipPaymentModel.find({}).sort({ createdAt: -1 }).limit(500).lean();
  const eventIds = Array.from(new Set(payments.map((p) => p.eventId.toString())));
  const events = await EventModel.find({ _id: { $in: eventIds } }).select('title slug').lean();
  const eventById = new Map(events.map((e) => [e._id.toString(), e]));

  return payments.map((p) => ({
    _id: p._id.toString(),
    reference: p.reference,
    eventId: p.eventId.toString(),
    eventTitle: eventById.get(p.eventId.toString())?.title ?? '',
    eventSlug: eventById.get(p.eventId.toString())?.slug ?? '',
    companyName: p.companyName,
    sponsorEmail: p.sponsorEmail,
    provider: p.provider,
    status: p.status,
    dealNgn: Math.round(p.baseAmount / 100),
    platformFeeNgn: Math.round(p.commissionAmount / 100),
    organizerNgn: Math.round(p.organizerAmount / 100),
    paidAt: p.paidAt,
    refundedAt: p.refundedAt,
    refundRef: p.refundRef,
    createdAt: p.createdAt,
  }));
}

/** Admin: a REFUND_DUE was settled manually by bank transfer — close it out. */
export async function settleSponsorshipRefundDue(paymentId: string) {
  const payment = await SponsorshipPaymentModel.findById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }
  if (payment.status !== 'REFUND_DUE') {
    throw new Error('Only REFUND_DUE payments can be settled manually');
  }
  payment.status = 'REFUNDED';
  payment.refundRef = 'MANUAL';
  payment.refundedAt = new Date();
  await payment.save();
  return { payment: { _id: payment._id.toString(), reference: payment.reference, status: payment.status } };
}
