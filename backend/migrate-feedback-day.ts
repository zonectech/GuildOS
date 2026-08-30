// One-off migration: per-day feedback — drop the old {eventId,userId} unique index
// (it blocks a second day's rating) and default existing rows to day 0.
import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from './src/config';
import { EventFeedbackModel } from './src/models/event-feedback.model';

async function main() {
  await mongoose.connect(config.mongoUri);
  const coll = EventFeedbackModel.collection;
  const indexes = await coll.indexes();
  for (const idx of indexes) {
    if (idx.name === 'eventId_1_userId_1') {
      await coll.dropIndex(idx.name);
      console.log('dropped old index', idx.name);
    }
  }
  const r = await coll.updateMany({ day: { $exists: false } }, { $set: { day: 0 } });
  await EventFeedbackModel.syncIndexes();
  console.log(`day:0 backfilled on ${r.modifiedCount} rows; indexes synced:`, (await coll.indexes()).map((i) => i.name).join(', '));
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
