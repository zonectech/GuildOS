import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';

(async () => {
  await connectDatabase();
  const res = await mongoose.connection
    .collection('communities')
    .updateOne({ slug: 'abu-ce052f75' }, { $set: { verificationStatus: 'VERIFIED' } });
  console.log('matched=' + res.matchedCount + ' modified=' + res.modifiedCount);
  process.exit(0);
})();
