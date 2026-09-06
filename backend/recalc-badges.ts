/* One-off: recalculate reputation for every scored user so the new FOUNDER badge appears. */
import mongoose from 'mongoose';
import { ReputationScoreModel } from './src/models/reputation-score.model';
import { recalculateReputation } from './src/services/reputation.service';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const rows = await ReputationScoreModel.find({}).select('userId fullName badges').lean();
  for (const row of rows) {
    await recalculateReputation(row.userId.toString());
    const updated = await ReputationScoreModel.findOne({ userId: row.userId }).select('fullName badges').lean();
    console.log(updated?.fullName || row.userId.toString(), '→', (updated?.badges ?? []).join(', '));
  }
  await mongoose.disconnect();
}
void main();
