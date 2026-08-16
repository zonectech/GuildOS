/**
 * Wipe all seeded/demo communities and events (fresh-start cleanup).
 * Keeps: real users, the "GuildOS Help" hub (powers /docs + assistant retrieval),
 * institutions, and platform settings.
 * Cascades across every collection referencing the deleted community/event ids.
 * Run: npx tsx --env-file=.env cleanup-demo-data.ts
 */
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';

(async () => {
  await connectDatabase();
  const db = mongoose.connection.db;

  // Demo/test communities by slug pattern — NEVER the official Help hub.
  const communityPattern = /(-demo(-|$))|^wizard-test-guild-|^browser-test-society-|^pending-review-demo-|^cert-seed-guild-|^smoke-test-guild-|^livetest-|^live-test-guild-/;
  const comms = await db
    .collection('communities')
    .find({ slug: { $regex: communityPattern }, $nor: [{ slug: 'guildos-help' }] })
    .project({ _id: 1, slug: 1, name: 1 })
    .toArray();
  const commIds = comms.map((c) => c._id);

  // Their events + standalone demo events.
  const events = await db
    .collection('events')
    .find({
      $or: [
        ...(commIds.length ? [{ communityId: { $in: commIds } }] : []),
        { slug: { $regex: /(-demo(-|$))|^demo-seed-|^livetest-|-live-test-/ } },
      ],
    })
    .project({ _id: 1, slug: 1 })
    .toArray();
  const eventIds = events.map((e) => e._id);

  console.log('Communities to delete:');
  for (const c of comms) console.log('  -', c.slug);
  console.log('Events to delete:');
  for (const e of events) console.log('  -', e.slug);

  const ids = [...commIds, ...eventIds];
  let removed = 0;
  if (ids.length) {
    const orClauses = [
      { _id: { $in: ids } },
      { communityId: { $in: ids } },
      { eventId: { $in: ids } },
    ];
    const collections = await db.listCollections().toArray();
    for (const { name } of collections) {
      try {
        const r = await db.collection(name).deleteMany({ $or: orClauses } as never);
        if (r.deletedCount) console.log(`  ${name}: ${r.deletedCount}`);
        removed += r.deletedCount ?? 0;
      } catch {
        /* collections without these fields / type mismatches are fine */
      }
    }
  }
  console.log(`\nDone. ${comms.length} communities, ${events.length} events, ${removed} documents removed in total.`);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => undefined);
  throw e;
});
