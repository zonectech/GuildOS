/* One-off: clean integrity debris found by probe-integrity.ts (backup taken first: guildos-2026-09-05).
 * - posts whose community no longer exists (deleted test communities left them behind)
 * - registrations whose event no longer exists
 * - @e2etest.local users from crashed live-test runs, plus their memberships/registrations/
 *   notifications/reputation rows/posts/comments/connections/conversations. */
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';

async function main() {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const c = (n: string) => db.collection(n);

  const [communityIds, eventIds] = await Promise.all([
    c('communities').distinct('_id'),
    c('events').distinct('_id'),
  ]);

  const orphanPosts = await c('posts').deleteMany({ communityId: { $nin: [...communityIds, null] } });
  const orphanRegs = await c('eventregistrations').deleteMany({ eventId: { $nin: eventIds } });

  const testUsers = await c('users').find({ email: /@e2etest\.local$/i }).project({ _id: 1, email: 1 }).toArray();
  const ids = testUsers.map((u) => u._id);
  console.log('test users to remove:', testUsers.map((u) => u.email).join(', ') || '(none)');

  let removed: Record<string, number> = {};
  if (ids.length) {
    const targets: [string, object][] = [
      ['memberships', { userId: { $in: ids } }],
      ['eventregistrations', { userId: { $in: ids } }],
      ['notifications', { userId: { $in: ids } }],
      ['reputationactivities', { userId: { $in: ids } }],
      ['reputationscores', { userId: { $in: ids } }],
      ['posts', { userId: { $in: ids } }],
      ['postcomments', { userId: { $in: ids } }],
      ['connections', { $or: [{ requesterId: { $in: ids } }, { addresseeId: { $in: ids } }] }],
      ['conversations', { participants: { $in: ids } }],
      ['messages', { senderId: { $in: ids } }],
      ['ticketpayments', { userId: { $in: ids } }],
      ['eventbookmarks', { userId: { $in: ids } }],
      ['users', { _id: { $in: ids } }],
    ];
    for (const [name, query] of targets) {
      const r = await c(name).deleteMany(query);
      if (r.deletedCount) removed[name] = r.deletedCount;
    }
  }

  console.log(JSON.stringify({ orphanPosts: orphanPosts.deletedCount, orphanRegs: orphanRegs.deletedCount, removed }, null, 1));
  await mongoose.disconnect();
}
void main();
