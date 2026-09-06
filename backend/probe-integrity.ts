/* One-off READ-ONLY probe #3: data integrity — orphans + counter drift. */
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';

async function main() {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const c = (n: string) => db.collection(n);

  const [communityIds, eventIds, userIds] = await Promise.all([
    c('communities').distinct('_id'),
    c('events').distinct('_id'),
    c('users').distinct('_id', { deletedAt: null }),
  ]);
  const userSet = new Set(userIds.map(String));

  // Orphans
  const [orphanRegs, orphanMemberships, orphanPosts, orphanCerts, regsDeadUsers, membershipsDeadUsers] = await Promise.all([
    c('eventregistrations').countDocuments({ eventId: { $nin: eventIds } }),
    c('memberships').countDocuments({ communityId: { $nin: communityIds } }),
    c('posts').countDocuments({ communityId: { $nin: [...communityIds, null] } }),
    c('certificates').countDocuments({ eventId: { $nin: [...eventIds, null] } }),
    c('eventregistrations').distinct('userId').then((ids) => ids.filter((id) => !userSet.has(String(id))).length),
    c('memberships').distinct('userId').then((ids) => ids.filter((id) => !userSet.has(String(id))).length),
  ]);

  // memberCount drift (stored vs actual ACTIVE memberships)
  const communities = await c('communities').find({}).project({ name: 1, memberCount: 1 }).toArray();
  const memberDrift: { name: string; stored: number; actual: number }[] = [];
  for (const community of communities) {
    const actual = await c('memberships').countDocuments({ communityId: community._id, status: 'ACTIVE' });
    if ((community.memberCount ?? 0) !== actual) memberDrift.push({ name: community.name, stored: community.memberCount ?? 0, actual });
  }

  // event registrationCount drift
  const events = await c('events').find({ deletedAt: null }).project({ title: 1, registrationCount: 1 }).toArray();
  const regDrift: { title: string; stored: number; actual: number }[] = [];
  for (const event of events) {
    const actual = await c('eventregistrations').countDocuments({ eventId: event._id, status: { $nin: ['CANCELLED', 'REJECTED'] } });
    if ((event.registrationCount ?? 0) !== actual) regDrift.push({ title: event.title, stored: event.registrationCount ?? 0, actual });
  }

  // Leftover throwaway/test rows in Atlas
  const [testUsers, testCommunities, testEvents] = await Promise.all([
    c('users').countDocuments({ email: /@(e2etest\.local|test\.local|example\.(com|org))$/i }),
    c('communities').countDocuments({ name: /test|smoke|throwaway|wave |bypass/i }),
    c('events').countDocuments({ title: /test|smoke|regq|bypass|wave /i, deletedAt: null }),
  ]);

  console.log(JSON.stringify({
    orphanRegs, orphanMemberships, orphanPosts, orphanCerts,
    regsPointingAtDeadUsers: regsDeadUsers, membershipsPointingAtDeadUsers: membershipsDeadUsers,
    memberDrift, regDrift,
    leftovers: { testUsers, testCommunities, testEvents },
  }, null, 1));
  await mongoose.disconnect();
}
void main();
