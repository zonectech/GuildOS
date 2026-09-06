import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
(async () => {
  await connectDatabase();
  const r = await mongoose.connection.db!.collection('memberships').updateMany(
    { status: { $exists: false } },
    { $set: { status: 'ACTIVE' } },
  );
  console.log('backfilled status on', r.modifiedCount, 'membership(s)');
  await mongoose.disconnect();
})();
