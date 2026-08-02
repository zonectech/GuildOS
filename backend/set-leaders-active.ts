/**
 * One-off maintenance script — flips every CommunityLeader's status back to
 * ACTIVE (i.e. "current"), undoing any archives made during manual testing of
 * the Past Leadership feature.
 * Run: npx tsx --env-file=.env set-leaders-active.ts
 */
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { CommunityLeaderModel } from './src/models/community-leader.model';

async function main() {
  await connectDatabase();

  const result = await CommunityLeaderModel.updateMany({ status: 'ARCHIVED' }, { $set: { status: 'ACTIVE' } });
  console.log(`Moved ${result.modifiedCount} leader(s) back to current (ACTIVE).`);

  const all = await CommunityLeaderModel.find({}).select('name session status').lean();
  for (const l of all) {
    console.log(`- ${l.name} (${l.session || 'no session'}): ${l.status}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
