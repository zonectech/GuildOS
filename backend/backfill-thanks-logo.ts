import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from './src/config';
import { PostModel } from './src/models/post.model';

async function main() {
  await mongoose.connect(config.mongoUri);
  const r = await PostModel.updateOne(
    { content: /thank you to Kolawole Technologies/i, imageUrl: '' },
    { $set: { imageUrl: '/uploads/1788371278001-kolawole-tech-logo.png' } },
  );
  console.log('backfilled existing thank-you post:', r.modifiedCount);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
