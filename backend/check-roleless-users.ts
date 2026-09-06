import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
(async () => {
  await connectDatabase();
  const users = mongoose.connection.db!.collection('users');
  const broken = await users.find({ role: { $exists: false } }).project({ email: 1, fullName: 1, emailVerified: 1, status: 1, createdAt: 1, onboardingCompleted: 1 }).toArray();
  console.log(JSON.stringify(broken, null, 1));
  if (process.argv[2] === 'fix') {
    const r = await users.updateMany({ role: { $exists: false } }, { $set: { role: 'STUDENT' } });
    console.log('backfilled role on', r.modifiedCount, 'user(s)');
    const noStatus = await users.updateMany({ status: { $exists: false } }, { $set: { status: 'ACTIVE' } });
    console.log('backfilled status on', noStatus.modifiedCount, 'user(s)');
  }
  await mongoose.disconnect();
})();
