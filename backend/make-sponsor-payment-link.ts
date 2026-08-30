// One-off: produce a live sponsor checkout link for the demo event.
// Finds the latest inquiry (creates a test one if none), marks the deal WON as
// the organizer, then generates the SPN- payment link a sponsor would pay through.
import 'dotenv/config'; // MUST be first: src/config reads process.env at import time
import mongoose from 'mongoose';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { SponsorshipInquiryModel } from './src/models/sponsorship-inquiry.model';
import { convertInquiryToSponsor } from './src/services/sponsorship.service';
import { startSponsorshipCheckout } from './src/services/sponsorship-payment.service';

async function main() {
  const slug = process.argv[2] ?? 'tech-week-summit-demo';
  await mongoose.connect(config.mongoUri);

  const event = await EventModel.findOne({ slug, deletedAt: null });
  if (!event) throw new Error(`Event ${slug} not found`);
  const organizerId = event.createdBy.toString();

  let inquiry = await SponsorshipInquiryModel.findOne({ eventId: event._id, feeStatus: { $ne: 'PAID' } }).sort({ createdAt: -1 });
  if (!inquiry) {
    inquiry = await SponsorshipInquiryModel.create({
      eventId: event._id,
      communityId: event.communityId,
      companyName: `Acme Test Sponsors ${Date.now().toString().slice(-4)} Ltd`,
      contactName: 'Ada Tester',
      email: 'livetest@guildos.local',
      phone: '',
      website: 'https://example.com',
      packageName: 'Bronze Sponsor',
      message: 'Test sponsorship inquiry (demo).',
    });
    console.log('Created test inquiry from', inquiry.companyName);
  } else {
    console.log(`Using latest inquiry: ${inquiry.companyName} (${inquiry.email}) — status ${inquiry.status}`);
  }

  if (inquiry.status !== 'WON') {
    await convertInquiryToSponsor(event._id.toString(), inquiry._id.toString(), organizerId, {
      packageWon: event.sponsorshipPackages?.[0]?.name ?? '',
      dealAmount: 5000, // small test amount (₦)
      dealNote: 'Demo deal for payment-flow test',
    });
    console.log('Deal marked WON at ₦5,000');
  }

  const result = await startSponsorshipCheckout(event._id.toString(), inquiry._id.toString(), organizerId);
  console.log('--- SPONSOR CHECKOUT ---');
  console.log('Reference :', result.reference);
  console.log('Total     : ₦' + result.amountNgn.toLocaleString('en-NG'), result.breakdown);
  console.log('Pay here  :', result.checkoutUrl);

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
