/**
 * Sponsorship payment (SPN-) live suite — service-level, NO live gateway calls.
 * Covers: checkout guards, commission-rate lock across link regeneration,
 * money split math, settle effects (fee PAID, paid perks, case-insensitive
 * sponsor upsert), wallet escrow parity, and the REFUND_DUE manual-settlement
 * path (Paystack provider = unconfigured in dev, so the refund fails locally
 * and deterministically without touching a real gateway).
 * Run: npx tsx --env-file=.env live-test-sponsorship.ts   (backend not required)
 */
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import { config } from './src/config';
import { CommunityModel } from './src/models/community.model';
import { EventModel } from './src/models/event.model';
import { EventSponsorModel } from './src/models/event-sponsor.model';
import { NotificationModel } from './src/models/notification.model';
import { PlatformSettingsModel } from './src/models/platform-settings.model';
import { SponsorshipInquiryModel } from './src/models/sponsorship-inquiry.model';
import { SponsorshipPaymentModel } from './src/models/sponsorship-payment.model';
import { UserModel } from './src/models/user.model';
import { computeGatewayFeeNgn } from './src/services/payment-fee';
import { getGatewayFeeConfig } from './src/services/premium.service';
import { getCommunityWallet } from './src/services/community/community-wallet.service';
import {
  refundEventSponsorships,
  resolveSponsorshipCommissionPercent,
  settleSponsorshipPayment,
  startSponsorshipCheckout,
  verifySponsorshipPayment,
} from './src/services/sponsorship-payment.service';

let checks = 0;
function ok(cond: boolean, label: string) {
  checks += 1;
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ FAIL: ${label}`); process.exitCode = 1; }
}

const COMPANY = 'SPN Test Corp';

async function main() {
  await mongoose.connect(config.mongoUri);
  const event = await EventModel.findOne({ slug: 'tech-week-summit-demo', deletedAt: null });
  const owner = await UserModel.findOne({ email: 'livetest@guildos.local' });
  const community = await CommunityModel.findOne({ slug: 'robotics-guild-demo' });
  if (!event || !owner || !community) throw new Error('fixtures missing — reseed demo data');
  const originalStatus = event.status;
  const originalPackages = event.sponsorshipPackages;

  // Deterministic package with the certificate perk for the settle test.
  event.status = 'PUBLISHED';
  event.set('sponsorshipPackages', [{ name: 'Gold (SPN test)', price: 100000, benefits: '', perks: ['LOGO_CERTIFICATES'] }]);
  await event.save();

  const inquiry = await SponsorshipInquiryModel.create({
    eventId: event._id,
    communityId: community._id,
    companyName: COMPANY,
    contactName: 'Ada Sponsor',
    email: 'spn-sponsor@guildos.local',
    status: 'NEW',
    dealAmount: 0,
  });

  console.log('A) checkout guards');
  try {
    await startSponsorshipCheckout(String(event._id), String(inquiry._id), String(owner._id));
    ok(false, 'non-WON inquiry rejected');
  } catch (err) {
    ok(/marking the deal WON/.test((err as Error).message), 'non-WON inquiry rejected');
  }

  inquiry.status = 'WON';
  inquiry.dealAmount = 100000;
  inquiry.packageWon = 'Gold (SPN test)';
  inquiry.feeStatus = 'PAID';
  await inquiry.save();
  try {
    await startSponsorshipCheckout(String(event._id), String(inquiry._id), String(owner._id));
    ok(false, 'already-settled deal rejected');
  } catch (err) {
    ok(/already settled/.test((err as Error).message), 'already-settled deal rejected');
  }
  inquiry.feeStatus = 'NONE';
  await inquiry.save();

  console.log('B) commission rate locks to the deal across regeneration');
  const settings = await PlatformSettingsModel.findOne({ key: 'GLOBAL' }).lean();
  const platformPct = settings?.sponsorshipFeePercent ?? 10;
  const freshPct = await resolveSponsorshipCommissionPercent(String(inquiry._id));
  ok(freshPct === platformPct, `no prior payment → platform default ${platformPct}%`);

  // Simulate an earlier link generated when the fee was 7%.
  const priorRef = `SPN-TEST-${randomBytes(6).toString('hex')}`;
  const feeNgn = computeGatewayFeeNgn(100000, await getGatewayFeeConfig());
  const prior = await SponsorshipPaymentModel.create({
    eventId: event._id, communityId: community._id, inquiryId: inquiry._id,
    provider: 'PAYSTACK', reference: priorRef, companyName: COMPANY, sponsorEmail: inquiry.email,
    amount: (100000 + feeNgn) * 100, baseAmount: 100000 * 100, feeAmount: feeNgn * 100,
    commissionAmount: 7000 * 100, organizerAmount: 93000 * 100, currency: 'NGN', status: 'FAILED',
  });
  const lockedPct = await resolveSponsorshipCommissionPercent(String(inquiry._id));
  ok(lockedPct === 7, `regenerated link keeps the deal's original 7% (not the current ${platformPct}%)`);

  console.log('C) money split math + settle effects');
  const commissionNgn = Math.round((100000 * lockedPct) / 100);
  const payment = await SponsorshipPaymentModel.create({
    eventId: event._id, communityId: community._id, inquiryId: inquiry._id,
    provider: 'PAYSTACK', reference: `SPN-TEST-${randomBytes(6).toString('hex')}`,
    companyName: COMPANY, sponsorEmail: inquiry.email,
    amount: (100000 + feeNgn) * 100, baseAmount: 100000 * 100, feeAmount: feeNgn * 100,
    commissionAmount: commissionNgn * 100, organizerAmount: (100000 - commissionNgn) * 100,
    currency: 'NGN', status: 'PENDING',
  });
  ok(payment.amount === payment.baseAmount + payment.feeAmount, 'sponsor pays deal + gateway fee exactly');
  ok(payment.organizerAmount + payment.commissionAmount === payment.baseAmount, 'organizer share + platform fee = deal (fee deducted at source)');

  // Pre-existing organizer-created listing with different casing/whitespace —
  // settle must UPGRADE it, not duplicate it.
  await EventSponsorModel.create({ eventId: event._id, name: COMPANY.toUpperCase(), logo: '', website: '' });

  const walletBefore = await getCommunityWallet(String(community._id), String(owner._id));
  payment.status = 'PAID';
  payment.paidAt = new Date();
  await payment.save();
  await settleSponsorshipPayment(payment, event);

  const settledInquiry = await SponsorshipInquiryModel.findById(inquiry._id).lean();
  ok(settledInquiry?.feeStatus === 'PAID', 'fee settled itself (inquiry feeStatus PAID)');
  const sponsors = await EventSponsorModel.find({
    eventId: event._id,
    name: { $regex: `^\\s*${COMPANY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, $options: 'i' },
  });
  ok(sponsors.length === 1, `case-insensitive match reused the existing listing (${sponsors.length} row, no duplicate)`);
  ok(sponsors[0].paidViaPlatform === true, 'sponsor upgraded to "Paid via GuildOS"');
  ok(sponsors[0].showOnCertificate === true, 'LOGO_CERTIFICATES perk delivered (showOnCertificate)');

  console.log('D) wallet escrow parity');
  const walletHeld = await getCommunityWallet(String(community._id), String(owner._id));
  ok(walletHeld.heldNgn - walletBefore.heldNgn === 100000 - commissionNgn, `₦${(100000 - commissionNgn).toLocaleString()} held while the event is upcoming`);
  // Other demo payments on this event (e.g. a PAID ticket) release alongside ours
  // when the event completes — fold them into the expected delta.
  const { TicketPaymentModel } = await import('./src/models/ticket-payment.model');
  const otherPaid = await TicketPaymentModel.aggregate<{ _id: null; total: number }>([
    { $match: { eventId: event._id, status: 'PAID' } },
    { $group: { _id: null, total: { $sum: '$organizerAmount' } } },
  ]);
  const otherReleaseNgn = Math.round((otherPaid[0]?.total ?? 0) / 100);
  event.status = 'COMPLETED';
  await event.save();
  const walletReleased = await getCommunityWallet(String(community._id), String(owner._id));
  ok(
    walletReleased.availableNgn - walletBefore.availableNgn === 100000 - commissionNgn + otherReleaseNgn,
    `released to available once the event completes (+₦${otherReleaseNgn.toLocaleString()} from other demo payments)`,
  );
  event.status = 'PUBLISHED';
  await event.save();

  console.log('E) refund failure → REFUND_DUE + admin alert (no gateway in dev for PAYSTACK)');
  const refundOutcome = await refundEventSponsorships(String(event._id), 'SPN live-test cancellation');
  ok(refundOutcome.queued === 1 && refundOutcome.refunded === 0, 'gateway refund failed → queued for manual settlement');
  const duePayment = await SponsorshipPaymentModel.findById(payment._id).lean();
  ok(duePayment?.status === 'REFUND_DUE', 'payment marked REFUND_DUE');
  // Admin bell is fired async (void IIFE) — give it a beat.
  await new Promise((r) => setTimeout(r, 800));
  const adminBells = await NotificationModel.find({ title: 'Sponsorship refund needs manual settlement' }).lean();
  ok(adminBells.some((n) => n.body.includes(payment.reference)), 'every admin alerted about the owed refund');

  console.log('F) re-verifying a refunded payment is a no-op (no second refund attempt)');
  const reVerify = await verifySponsorshipPayment(payment.reference);
  ok(reVerify.status === 'REFUNDED' && (reVerify as { alreadyProcessed?: boolean }).alreadyProcessed === true, 're-verify returns REFUNDED alreadyProcessed');
  const afterReVerify = await SponsorshipPaymentModel.findById(payment._id).lean();
  ok(afterReVerify?.status === 'REFUND_DUE', 'status untouched by re-verify (terminal state preserved)');

  // Cleanup — throwaway rows removed, demo event restored.
  await SponsorshipPaymentModel.deleteMany({ _id: { $in: [prior._id, payment._id] } });
  await SponsorshipInquiryModel.deleteOne({ _id: inquiry._id });
  await EventSponsorModel.deleteMany({ eventId: event._id, name: { $regex: `^\\s*${COMPANY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, $options: 'i' } });
  await NotificationModel.deleteMany({ title: { $in: ['Sponsorship refund needs manual settlement', `Sponsorship payment received for "${event.title}"`, `Sponsor payments refunded for "${event.title}"`] } });
  event.status = originalStatus;
  event.set('sponsorshipPackages', originalPackages);
  await event.save();

  console.log(`\n${checks} checks done; demo restored (event ${originalStatus}).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
