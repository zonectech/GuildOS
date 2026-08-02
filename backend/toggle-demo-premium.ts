// One-off: toggle premium on the demo community (pass 'off' to revoke).
import { config as loadEnv } from 'dotenv';
loadEnv();
import mongoose from 'mongoose';
import { config } from './src/config';
import { CommunityModel } from './src/models/community.model';

async function main() {
  const on = process.argv[2] !== 'off';
  await mongoose.connect(config.mongoUri);
  const r = await CommunityModel.updateOne({ slug: 'robotics-guild-demo' }, { $set: { isPremium: on } });
  console.log(`premium ${on ? 'granted' : 'revoked'}:`, r.modifiedCount);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
