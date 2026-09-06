/* One-off READ-ONLY: inventory demo vs real data in Atlas for the pre-launch purge decision. */
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
(async () => {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const events = await db.collection('events').find({ deletedAt: null }).project({ title: 1, slug: 1, status: 1, attendeeChatLink: 1, communityId: 1 }).toArray();
  const communities = await db.collection('communities').find({}).project({ name: 1, slug: 1, verificationStatus: 1, memberCount: 1 }).toArray();
  const localUsers = await db.collection('users').find({ email: /@guildos\.local$/i, deletedAt: null }).project({ email: 1, role: 1 }).toArray();
  const realUsers = await db.collection('users').find({ email: { $not: /@(.*\.local|example\.(com|org))$/i }, deletedAt: null }).project({ email: 1, role: 1 }).toArray();
  console.log('--- EVENTS (live) ---');
  for (const e of events) console.log(`  ${e.status.padEnd(10)} ${e.slug}${e.attendeeChatLink ? '  [chatLink: ' + e.attendeeChatLink + ']' : ''}`);
  console.log('--- COMMUNITIES ---');
  for (const c of communities) console.log(`  ${String(c.verificationStatus).padEnd(9)} ${c.slug} (${c.memberCount} members)`);
  console.log(`--- USERS: ${localUsers.length} @guildos.local fixtures ---`);
  for (const u of localUsers) console.log(`  ${u.role.padEnd(17)} ${u.email}`);
  console.log(`--- USERS: ${realUsers.length} real-email accounts ---`);
  for (const u of realUsers) console.log(`  ${String(u.role ?? '(no role!)').padEnd(17)} ${u.email}`);
  await mongoose.disconnect();
})();
