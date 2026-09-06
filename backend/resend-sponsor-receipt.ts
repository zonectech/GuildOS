/** One-off: resend the sponsorship settle receipt email + smoke-test new endpoints. */
import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from './src/config';
import { SponsorshipPaymentModel } from './src/models/sponsorship-payment.model';
import { EventModel } from './src/models/event.model';
import { getSponsorshipReceipt } from './src/services/sponsorship-payment.service';
import { getCommunitySponsors } from './src/services/sponsorship.service';
import { congratulationsEmail, sendEmail } from './src/utils/email';

async function main() {
  await mongoose.connect(config.mongoUri);
  const payment = await SponsorshipPaymentModel.findOne({ reference: 'SPN-3d3db7-e39c5599a2cd' }).lean();
  if (!payment) throw new Error('payment not found');
  const event = await EventModel.findById(payment.eventId).select('title slug communityId').lean();

  // Smoke-test the new service fns.
  const receipt = await getSponsorshipReceipt(payment.reference);
  console.log('receipt ok:', receipt.reference, receipt.status, '₦' + receipt.amountNgn, receipt.eventTitle);
  const roster = await getCommunitySponsors(String(event!.communityId));
  console.log('roster ok:', roster.totalSponsors, 'sponsors across', roster.eventsSponsored, 'events →', roster.sponsors.map((s) => `${s.name}${s.paidViaPlatform ? ' (paid)' : ''}`).join(', '));

  await sendEmail(
    payment.sponsorEmail,
    congratulationsEmail(
      payment.companyName,
      `Receipt — your sponsorship of "${event!.title}" is confirmed`,
      `We received ₦${Math.round(payment.amount / 100).toLocaleString('en-NG')} for ${payment.companyName}'s sponsorship of "${event!.title}" (₦${Math.round(payment.baseAmount / 100).toLocaleString('en-NG')} sponsorship + ₦${Math.round(payment.feeAmount / 100).toLocaleString('en-NG')} processing fee, ref ${payment.reference}). The deal is settled through GuildOS — refund-protected if the event is cancelled — and your verified reach report is unlocked. Your online receipt is always available at the link below.`,
      'View receipt & verified report',
      `${config.frontendUrl}/events/${encodeURIComponent(event!.slug)}/sponsor-report?reference=${encodeURIComponent(payment.reference)}`,
    ),
  );
  console.log('receipt email re-sent to', payment.sponsorEmail);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
