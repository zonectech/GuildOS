// One-off: seed demo attendee feedback on the demo event so the rating surfaces
// (sponsor report card, community ★, organizer AI insights) are testable.
import 'dotenv/config'; // MUST be first: src/config reads process.env at import time
import mongoose from 'mongoose';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { EventFeedbackModel } from './src/models/event-feedback.model';

const SAMPLES: Array<{ rating: number; comment: string }> = [
  { rating: 5, comment: 'The hands-on robotics workshop was the highlight — more of that please!' },
  { rating: 4, comment: 'Great speakers, but registration queue at the door was too slow.' },
  { rating: 5, comment: 'Loved the certificate with sponsor branding. Venue was easy to find.' },
  { rating: 3, comment: 'Sound system kept cutting out during the panel. Content was solid though.' },
  { rating: 4, comment: 'Please provide more power outlets and start on time next edition.' },
  { rating: 5, comment: 'Networking session after the talks was worth the whole day.' },
  { rating: 4, comment: 'Food came late but the workshops were excellent.' },
];

async function main() {
  const slug = process.argv[2] ?? 'tech-week-summit-demo';
  await mongoose.connect(config.mongoUri);
  const event = await EventModel.findOne({ slug, deletedAt: null });
  if (!event) throw new Error(`Event ${slug} not found`);

  const registrations = await EventRegistrationModel.find({ eventId: event._id }).limit(SAMPLES.length).lean();
  if (!registrations.length) throw new Error('No registrations on this event to attach feedback to');

  let created = 0;
  for (let i = 0; i < registrations.length; i += 1) {
    const sample = SAMPLES[i % SAMPLES.length];
    await EventFeedbackModel.findOneAndUpdate(
      { eventId: event._id, userId: registrations[i].userId },
      { $set: { rating: sample.rating, comment: sample.comment } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    created += 1;
  }
  console.log(`Seeded ${created} feedback entr${created === 1 ? 'y' : 'ies'} on "${event.title}"`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
