/**
 * Simulates a successful gateway payment for a sponsorship — dev has no Paystack
 * key, so this stands in for: checkout link → sponsor pays → webhook verifies →
 * settle. Uses the SAME settleSponsorshipPayment path the real webhook flow calls.
 */
import { config as loadEnv } from 'dotenv';
loadEnv();
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { SponsorshipInquiryModel } from './src/models/sponsorship-inquiry.model';
import { SponsorshipPaymentModel } from './src/models/sponsorship-payment.model';
import { PlatformSettingsModel } from './src/models/platform-settings.model';
import { settleSponsorshipPayment } from './src/services/sponsorship-payment.service';
import { computeGatewayFeeNgn } from './src/services/payment-fee';
import { getGatewayFeeConfig } from './src/services/premium.service';

async function main() {
  const slug = process.argv[2] ?? 'tech-week-summit-demo';
  await mongoose.connect(config.mongoUri);

  const event = await EventModel.findOne({ slug, deletedAt: null });
  if (!event) throw new Error(`Event ${slug} not found`);

  const inquiry = await SponsorshipInquiryModel.findOne({ eventId: event._id, status: 'WON', dealAmount: { $gt: 0 } }).sort({ createdAt: -1 });
  if (!inquiry) throw new Error('No WON deal with an amount found — convert an inquiry first (make-sponsor-payment-link.ts does this)');

  const settings = await PlatformSettingsModel.findOne({ key: 'GLOBAL' }).lean();
  const feePercent = settings?.sponsorshipFeePercent ?? 10;
  const baseNgn = inquiry.dealAmount;
  const feeNgn = computeGatewayFeeNgn(baseNgn, await getGatewayFeeConfig());
  const commissionNgn = Math.round((baseNgn * feePercent) / 100);

  const payment =
    (await SponsorshipPaymentModel.findOne({ inquiryId: inquiry._id, status: 'PENDING' })) ??
    (await SponsorshipPaymentModel.create({
      eventId: event._id,
      communityId: event.communityId,
      inquiryId: inquiry._id,
      provider: 'PAYSTACK',
      reference: `SPN-${String(event._id).slice(-6)}-${randomBytes(6).toString('hex')}`,
      companyName: inquiry.companyName,
      sponsorEmail: inquiry.email,
      amount: (baseNgn + feeNgn) * 100,
      baseAmount: baseNgn * 100,
      feeAmount: feeNgn * 100,
      commissionAmount: commissionNgn * 100,
      organizerAmount: (baseNgn - commissionNgn) * 100,
      currency: 'NGN',
      status: 'PENDING',
    }));
  console.log(`PENDING checkout ${payment.reference} — sponsor "pays" ₦${(baseNgn + feeNgn).toLocaleString('en-NG')} on the gateway here…`);

  // — sponsor "pays" on the hosted gateway page here —

  payment.status = 'PAID';
  payment.paidAt = new Date();
  await payment.save();
  await settleSponsorshipPayment(payment, event);

  console.log(`payment PAID + settled → fee PAID, sponsor "Paid via GuildOS", ₦${baseNgn - commissionNgn} escrowed to the community wallet (₦${commissionNgn} platform fee kept)`);
  console.log(`report: http://localhost:3000/events/${event.slug}/sponsor-report`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
