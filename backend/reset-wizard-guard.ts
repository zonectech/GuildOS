// One-off: reset the community-creation cooldown guard for the wizard test user.
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';

(async () => {
  await connectDatabase();
  const user = await UserModel.findOne({ email: 'wizardtest@guildos.local' }).select('_id').lean();
  if (!user) throw new Error('wizardtest user not found');
  const result = await mongoose.connection
    .collection('communitycreationguards')
    .updateOne({ userId: user._id }, { $set: { nextAllowedAt: new Date(0), windowCount: 0 } });
  console.log('guard reset:', result.modifiedCount);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => undefined);
  throw e;
});
