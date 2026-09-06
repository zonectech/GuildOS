// One-off: stage a live virtual demo event to browser-test the new flows —
// "Check in & join meeting" one-tap, doors-open nudge window, and the official
// partner registration (MLSA-style) card + organizer tracking.
// Usage: npx tsx stage-virtual-demo.ts [slug]   (pass 'off' to restore nothing — it just reports)
import 'dotenv/config'; // MUST be first: src/config reads process.env at import time
import mongoose from 'mongoose';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';

async function main() {
  const slugArg = process.argv[2];
  await mongoose.connect(config.mongoUri);

  const query: Record<string, unknown> = { deletedAt: null, status: { $in: ['PUBLISHED', 'CHECK_IN'] } };
  if (slugArg) query.slug = slugArg;
  const event = await EventModel.findOne(query).sort({ startDate: -1 });
  if (!event) {
    console.log('No published event found — publish one first.');
    await mongoose.disconnect();
    return;
  }

  // Live NOW: started 5 minutes ago (inside the 15-min self-check-in gate), check-in open.
  const now = Date.now();
  event.mode = 'VIRTUAL';
  event.status = 'CHECK_IN';
  event.startDate = new Date(now - 5 * 60_000);
  event.endDate = new Date(now + 2 * 60 * 60_000);
  // Free registration so the demo attendee can register directly (no ticket hop).
  event.ticketPrice = 0;
  event.set('ticketTiers', []);
  if (!event.meetingLink) event.meetingLink = 'https://meet.google.com/abc-defg-hij';
  // MLSA-style partner form
  event.partnerRegistrationUrl = 'https://forms.office.com/r/demo-mlsa-form';
  event.partnerRegistrationLabel = 'Microsoft';
  // Let the doors-open nudge fire fresh for this staging run.
  event.doorsOpenNudgeSentAt = null;
  await event.save();

  console.log(`Staged LIVE virtual event: ${event.title}`);
  console.log(`  http://localhost:3000/events/${event.slug}`);
  console.log(`  attendees: http://localhost:3000/dashboard/events/attendees?eventId=${event._id}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
