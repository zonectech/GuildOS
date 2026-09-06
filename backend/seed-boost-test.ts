/* One-off: seed/cleanup a throwaway event OWNED BY livetest to browser-verify the
 * organizer boost panel + cancel-reason breakdown.
 * seed:    npx tsx --env-file=.env seed-boost-test.ts
 * cleanup: npx tsx --env-file=.env seed-boost-test.ts cleanup */
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { CommunityModel } from './src/models/community.model';
import { UserModel } from './src/models/user.model';

async function main() {
  await connectDatabase();
  if (process.argv[2] === 'cleanup') {
    const events = await EventModel.find({ slug: /^boost-test-/ }).select('_id').lean();
    const ids = events.map((e) => e._id);
    await EventRegistrationModel.deleteMany({ eventId: { $in: ids } });
    await UserModel.deleteMany({ email: /^boost-attendee-/ });
    await EventModel.deleteMany({ _id: { $in: ids } });
    console.log(`cleaned ${events.length} event(s)`);
  } else {
    const owner = await UserModel.findOne({ email: 'livetest@guildos.local' }).select('_id').lean();
    // Must be a community livetest LEADS — canManage comes from membership role, not createdBy.
    const community = await CommunityModel.findOne({ slug: 'robotics-guild-demo' }).select('_id').lean();
    if (!owner || !community) throw new Error('missing fixtures');
    const stamp = Date.now();
    const event = await EventModel.create({
      communityId: community._id, createdBy: owner._id, slug: `boost-test-${stamp}`, status: 'PUBLISHED',
      title: 'Boost Panel Test Conf', shortDescription: 'Throwaway.', description: 'Throwaway — will be deleted.',
      mode: 'PHYSICAL', venue: 'Test Hall', bannerImage: '/uploads/smoke-banner.png', registrationPolicy: 'OPEN',
      ticketPrice: 1500, capacity: 50,
      startDate: new Date(stamp + 3 * 86400_000), endDate: new Date(stamp + 3 * 86400_000 + 3600_000),
    } as any);
    // Cancelled registrations with reasons for the breakdown card.
    const reasons = ['Schedule conflict', 'Schedule conflict', 'Registered by mistake', ''];
    for (const [i, reason] of reasons.entries()) {
      const u = await UserModel.create({
        email: `boost-attendee-${i}-${stamp}@e2etest.local`, fullName: `Boost Attendee ${i + 1}`,
        passwordHash: 'x', passwordSalt: 'x', emailVerified: true, status: 'ACTIVE', role: 'STUDENT',
      } as any);
      await EventRegistrationModel.create({
        eventId: event._id, communityId: community._id, userId: u._id, status: 'CANCELLED',
        cancellationReason: reason, cancelledBy: i === 3 ? 'ORGANIZER' : 'SELF', qrToken: crypto.randomUUID(),
      } as any);
    }
    console.log(`slug: ${event.slug} id: ${event._id}`);
  }
  await mongoose.disconnect();
}
void main();
