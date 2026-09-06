import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from './src/config';
import { notifySponsorshipEventCancelled } from './src/services/sponsorship-notify.service';
import { EventModel } from './src/models/event.model';

async function main() {
  await mongoose.connect(config.mongoUri);
  const event = await EventModel.findOne({ slug: 'ai-robotics-career-night-2026-d0afdaae' }).select('_id cancellationReason').lean();
  const out = await notifySponsorshipEventCancelled(String(event!._id), event!.cancellationReason || 'Event cancelled');
  console.log('sponsor cancellation emails sent:', out.notified);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
