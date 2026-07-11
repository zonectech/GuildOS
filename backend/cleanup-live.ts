/**
 * Cleanup for live UI testing artifacts:
 *  - removes GuildOS Admin's registration on the demo AI event (restores count)
 *  - removes the Acme Live Test sponsorship inquiry
 *  - removes all cert-seed / smoke throwaway users + their communities/events/certs
 * Run: npx tsx --env-file=.env cleanup-live.ts
 */
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';

(async () => {
  await connectDatabase();
  const db = mongoose.connection.db;

  // 1) Admin registration on the demo AI event
  const adminId = '6a481361591987ddd3989c06';
  const aiEvent = await db.collection('events').findOne({ slug: 'demo-seed-ai-careers-summit-2026' }, { projection: { _id: 1 } });
  if (aiEvent) {
    const r = await db.collection('eventregistrations').deleteMany({ eventId: aiEvent._id, userId: new mongoose.Types.ObjectId(adminId) });
    await db.collection('events').updateOne({ _id: aiEvent._id }, { $set: { registrationCount: 42, checkedInCount: 0, completedCount: 0 } });
    console.log(`admin registrations removed: ${r.deletedCount}`);
  }

  // 2) Sponsorship inquiry from the live UI test
  let inquiryRemoved = 0;
  for (const coll of ['sponsorshipinquiries']) {
    try {
      const r = await db.collection(coll).deleteMany({ email: 'jane@acme-livetest.example' });
      inquiryRemoved += r.deletedCount ?? 0;
    } catch { /* */ }
  }
  console.log(`sponsorship inquiries removed: ${inquiryRemoved}`);

  // 3) Throwaway seed data (smoke + cert seed)
  const users = await db.collection('users').find({ email: { $regex: '^(certseed-|smoke-)' } }).project({ _id: 1 }).toArray();
  const comms = await db.collection('communities').find({ slug: { $regex: '^(cert-seed-guild-|smoke-test-guild-)' } }).project({ _id: 1 }).toArray();
  const commIds = comms.map((c) => c._id);
  const events = commIds.length ? await db.collection('events').find({ communityId: { $in: commIds } }).project({ _id: 1 }).toArray() : [];
  const ids = [...users.map((u) => u._id), ...commIds, ...events.map((e) => e._id)];

  let removed = 0;
  if (ids.length) {
    const orClauses = [
      { _id: { $in: ids } }, { userId: { $in: ids } }, { communityId: { $in: ids } },
      { eventId: { $in: ids } }, { founder: { $in: ids } }, { issuedBy: { $in: ids } },
      { recipientId: { $in: ids } }, { actorId: { $in: ids } }, { authorId: { $in: ids } },
      { membershipId: { $in: ids } },
    ];
    const collections = await db.listCollections().toArray();
    for (const { name } of collections) {
      try {
        const r = await db.collection(name).deleteMany({ $or: orClauses } as any);
        removed += r.deletedCount ?? 0;
      } catch { /* type mismatch ok */ }
    }
  }
  console.log(`throwaway documents removed: ${removed}`);

  await mongoose.connection.close();
  process.exit(0);
})().catch(async (e) => { console.error(e); try { await mongoose.connection.close(); } catch {} process.exit(1); });
