// One-off: remove the synthetic AMAS-test leaders imported during the previous demo run,
// so the real AMAS PDF import starts from a clean 2026/2027 roster (Amina Yusuf kept).
import { config as loadEnv } from 'dotenv';
loadEnv();
import mongoose from 'mongoose';
import { config } from './src/config';
import { CommunityLeaderModel } from './src/models/community-leader.model';

const names = [
  'Abdullahi Musa Kabir', 'Fatima Sani Bello', 'Ibrahim Yusuf Adam',
  'Khadija Aliyu Umar', 'Usman Garba Sadiq', 'Aisha Mohammed Tukur', 'Suleiman Bala Nuhu',
];

async function main() {
  await mongoose.connect(config.mongoUri);
  const res = await CommunityLeaderModel.deleteMany({ name: { $in: names }, session: '2026/2027' });
  console.log('Removed', res.deletedCount, 'synthetic test leaders');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
