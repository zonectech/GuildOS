/**
 * One-off: create a WON sponsorship deal on the Career Night event for the
 * user's sponsor test address, generate the live SPN- checkout link, and email
 * it with the branded payment-request message the organizer would send.
 */
import 'dotenv/config'; // MUST be first: src/config reads process.env at import time
import mongoose from 'mongoose';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { SponsorshipInquiryModel } from './src/models/sponsorship-inquiry.model';
import { convertInquiryToSponsor } from './src/services/sponsorship.service';
import { startSponsorshipCheckout } from './src/services/sponsorship-payment.service';
import { categoryEmail, sendEmail } from './src/utils/email';

const SPONSOR_EMAIL = 'kolawoleabubakir6@gmail.com';
const DEAL_NGN = 100; // small live-money test amount

async function main() {
  await mongoose.connect(config.mongoUri);
  const event = await EventModel.findOne({ slug: 'ai-robotics-career-night-2026-d0afdaae', deletedAt: null });
  if (!event) throw new Error('event not found');
  const organizerId = event.createdBy.toString();

  let inquiry = await SponsorshipInquiryModel.findOne({ eventId: event._id, email: SPONSOR_EMAIL, feeStatus: { $ne: 'PAID' } }).sort({ createdAt: -1 });
  if (!inquiry) {
    inquiry = await SponsorshipInquiryModel.create({
      eventId: event._id,
      communityId: event.communityId,
      companyName: 'Kolawole Technologies Ltd',
      contactName: 'Abubakir Kolawole',
      email: SPONSOR_EMAIL,
      website: '',
      packageName: event.sponsorshipPackages?.[0]?.name ?? '',
      message: 'We would like to sponsor the Career Night (live payment test).',
    });
    console.log('Inquiry created:', inquiry.companyName);
  }

  if (inquiry.status !== 'WON') {
    await convertInquiryToSponsor(event._id.toString(), inquiry._id.toString(), organizerId, {
      packageWon: event.sponsorshipPackages?.[0]?.name ?? '',
      dealAmount: DEAL_NGN,
      dealNote: 'Live payment-flow test deal',
    });
    console.log(`Deal WON at ₦${DEAL_NGN}`);
  }

  const result = await startSponsorshipCheckout(event._id.toString(), inquiry._id.toString(), organizerId);
  console.log('Reference:', result.reference);
  console.log('Total: ₦' + result.amountNgn.toLocaleString('en-NG'), result.breakdown);
  console.log('Link:', result.checkoutUrl);

  await sendEmail(
    SPONSOR_EMAIL,
    categoryEmail('CONFIRMATION', {
      name: inquiry.contactName || inquiry.companyName,
      subject: `Complete your sponsorship of "${event.title}" — ₦${result.amountNgn.toLocaleString('en-NG')}`,
      heading: 'Your sponsorship is ready to confirm',
      message:
        `Robotics Guild has confirmed ${inquiry.companyName}'s sponsorship of "${event.title}" at ₦${DEAL_NGN.toLocaleString('en-NG')}.\n\n` +
        `Total due: ₦${result.amountNgn.toLocaleString('en-NG')} (₦${DEAL_NGN.toLocaleString('en-NG')} sponsorship + ₦${result.breakdown.gatewayFeeNgn.toLocaleString('en-NG')} processing fee). Payment reference: ${result.reference}.\n\n` +
        `Paying through GuildOS is refund-protected — if the event is cancelled, your money is returned automatically. Once payment is confirmed, your company is listed on the event page with a "Paid via GuildOS" badge and your verified reach report unlocks instantly.`,
      ctaLabel: 'Pay securely (card, transfer, or USSD)',
      ctaUrl: result.checkoutUrl,
      note: 'This payment link is unique to your deal. If it expires, ask the organizers to generate a fresh one.',
    }),
  );
  console.log('Payment-request email sent to', SPONSOR_EMAIL);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
