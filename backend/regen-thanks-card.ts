import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from './src/config';
import { PostModel } from './src/models/post.model';
import { createSponsorThanksImage } from './src/services/sponsor-thanks-image.service';

async function main() {
  await mongoose.connect(config.mongoUri);
  const imageUrl = await createSponsorThanksImage({
    sponsorName: 'Kolawole Technologies Ltd',
    eventTitle: 'AI & Robotics Career Night 2026',
    packageWon: 'Gold Sponsor',
    logo: '/uploads/1788371278001-kolawole-tech-logo.png',
  });
  console.log('card generated:', imageUrl);
  const r = await PostModel.updateOne(
    { content: /thank you to Kolawole Technologies/i },
    { $set: { imageUrl } },
  );
  console.log('post updated:', r.modifiedCount);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
