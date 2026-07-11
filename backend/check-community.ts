import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';

(async () => {
  await connectDatabase();
  const c = await mongoose.connection
    .collection('communities')
    .findOne({ slug: 'abu-ce052f75' }, { projection: { name: 1, slug: 1, verificationStatus: 1, visibility: 1, archivedAt: 1 } });
  console.log(JSON.stringify(c, null, 1));
  process.exit(0);
})();
