// One-off: restore the 2026/2027 Robotics Guild demo roster back to ACTIVE after
// live-testing the dissolve-with-certificates flow (the issued certificates remain).
import { config as loadEnv } from 'dotenv';
loadEnv();
import mongoose from 'mongoose';
import { config } from './src/config';
import { CommunityLeaderModel } from './src/models/community-leader.model';
import { CommunityModel } from './src/models/community.model';

async function main() {
  await mongoose.connect(config.mongoUri);
  const community = await CommunityModel.findOne({ slug: 'robotics-guild-demo' }).select('_id').lean();
  if (!community) throw new Error('robotics-guild-demo not found');
  const res = await CommunityLeaderModel.updateMany(
    { communityId: community._id, session: '2026/2027', status: 'PAST' },
    { $set: { status: 'ACTIVE' } },
  );
  console.log('Restored', res.modifiedCount, 'leaders to ACTIVE');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
