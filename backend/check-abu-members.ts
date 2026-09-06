import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
(async () => {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const abu = await db.collection('communities').findOne({ name: 'ABU' }, { projection: { _id: 1, memberCount: 1 } });
  const memberships = await db.collection('memberships').find({ communityId: abu!._id }).project({ userId: 1, role: 1, status: 1 }).toArray();
  for (const m of memberships) {
    const u = await db.collection('users').findOne({ _id: m.userId }, { projection: { email: 1, deletedAt: 1 } });
    console.log(m.role, m.status, '-', u?.email ?? '(user gone)', u?.deletedAt ? '[deleted]' : '');
  }
  await mongoose.disconnect();
})();
