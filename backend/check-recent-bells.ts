import mongoose from 'mongoose';
import { config } from './src/config';
import { NotificationModel } from './src/models/notification.model';

async function main() {
  await mongoose.connect(config.mongoUri);
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const rows = await NotificationModel.find({ createdAt: { $gt: since } }).sort({ createdAt: -1 }).select('title body').lean();
  for (const r of rows) console.log('-', r.title, '::', (r.body ?? '').slice(0, 100));
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
