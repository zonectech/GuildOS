// One-off: open a demo event for sponsorship (pitch + default packages) so the
// /sponsors marketplace and the event page's "Sponsor this event" section are testable.
// Pass 'off' to close it again. Optionally pass an event slug as the 2nd arg.
import { config as loadEnv } from 'dotenv';
loadEnv();
import mongoose from 'mongoose';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';

async function main() {
  const on = process.argv[2] !== 'off';
  const slugArg = process.argv[3];
  await mongoose.connect(config.mongoUri);

  const query: Record<string, unknown> = { deletedAt: null, status: { $in: ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'] } };
  if (slugArg) query.slug = slugArg;
  const event = await EventModel.findOne(query).sort({ startDate: -1 });
  if (!event) {
    console.log('No published event found', slugArg ? `with slug ${slugArg}` : '— publish one first (any live event works)');
    await mongoose.disconnect();
    return;
  }

  event.sponsorshipOpen = on;
  if (on) {
    if (!event.sponsorshipPitch) {
      event.sponsorshipPitch = 'Put your brand in front of verified student attendees — logo placement, certificates, and a verified reach report.';
    }
    if (!event.sponsorshipPackages?.length) {
      event.sponsorshipPackages = [
        { name: 'Gold Sponsor', price: '₦150,000', perks: ['LOGO_EVENT_PAGE', 'LOGO_CERTIFICATES', 'SOCIAL_ANNOUNCEMENT', 'ATTENDANCE_REPORT', 'STAGE_MENTION'], benefits: '' },
        { name: 'Silver Sponsor', price: '₦75,000', perks: ['LOGO_EVENT_PAGE', 'SOCIAL_ANNOUNCEMENT', 'ATTENDANCE_REPORT'], benefits: '' },
        { name: 'Bronze Sponsor', price: '₦30,000', perks: ['LOGO_EVENT_PAGE'], benefits: '' },
      ] as typeof event.sponsorshipPackages;
    }
  }
  await event.save();
  console.log(`sponsorship ${on ? 'OPENED' : 'closed'} on "${event.title}" — http://localhost:3000/events/${event.slug}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
