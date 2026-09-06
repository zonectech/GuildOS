/* One-off: seed/cleanup a throwaway free event for browser-testing the share prompt.
 * `npx tsx --env-file=.env seed-share-test.ts` → prints slug
 * `npx tsx --env-file=.env seed-share-test.ts cleanup` → removes event + registration + share post */
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { CommunityModel } from './src/models/community.model';
import { UserModel } from './src/models/user.model';
import { PostModel } from './src/models/post.model';

async function main() {
  await connectDatabase();
  if (process.argv[2] === 'cleanup') {
    const events = await EventModel.find({ slug: /^share-test-/ }).select('_id title').lean();
    const ids = events.map((e) => e._id);
    const regs = await EventRegistrationModel.deleteMany({ eventId: { $in: ids } });
    const posts = await PostModel.deleteMany({ content: /share-test-/ });
    await EventModel.deleteMany({ _id: { $in: ids } });
    console.log(`cleaned: ${events.length} event(s), ${regs.deletedCount} reg(s), ${posts.deletedCount} post(s)`);
  } else {
    const user = await UserModel.findOne({ email: 'livetest@guildos.local' }).select('_id').lean();
    const community = await CommunityModel.findOne({ verificationStatus: 'VERIFIED', founder: { $ne: user?._id } }).select('_id name founder').lean();
    if (!user || !community) throw new Error('missing livetest user or verified community');
    const stamp = Date.now();
    const event = await EventModel.create({
      communityId: community._id, createdBy: community.founder, slug: `share-test-${stamp}`, status: 'PUBLISHED',
      title: 'Share Prompt Test Meetup', shortDescription: 'Throwaway event for testing the share-after-register prompt.',
      description: 'Throwaway — will be deleted.', mode: 'PHYSICAL', venue: 'Test Hall',
      bannerImage: '/uploads/smoke-banner.png', registrationPolicy: 'OPEN',
      startDate: new Date(stamp + 3 * 86400_000), endDate: new Date(stamp + 3 * 86400_000 + 3600_000),
    } as any);
    console.log(`slug: ${event.slug} (community: ${community.name})`);
  }
  await mongoose.disconnect();
}
void main();
