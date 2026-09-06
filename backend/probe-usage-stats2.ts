/* One-off READ-ONLY probe #2: funnel/content/money signals. */
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';

async function main() {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const c = (name: string) => db.collection(name);
  const count = (name: string, q: object = {}) => c(name).countDocuments(q).catch(() => -1);

  const [
    oppAgg, cvDocs, cvLogs, connections, convos, messages, polls, pollVotes,
    reposts, postsWithImage, comments, likesAgg, followers, joinRequests,
    premiumPaid, sponsorInquiries, sponsorPaid, knowledge, knowledgeViews,
    notifsByType, eventViews, walkIns, waitlistEnabled, certsByStatus,
    credentialDocs, profileViews, searchlessUsers, pushSubs,
  ] = await Promise.all([
    c('opportunities').aggregate([{ $group: { _id: '$status', n: { $sum: 1 }, views: { $sum: '$viewCount' }, saves: { $sum: '$saveCount' }, applies: { $sum: '$applyCount' } } }]).toArray(),
    count('cvdocuments'),
    count('cvgenerationlogs'),
    c('connections').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray().catch(() => []),
    count('conversations'),
    count('messages'),
    count('posts', { poll: { $ne: null } }),
    count('pollvotes'),
    count('posts', { repostOf: { $ne: null } }),
    count('posts', { imageUrl: { $nin: ['', null] } }),
    count('postcomments'),
    c('posts').aggregate([{ $group: { _id: null, likes: { $sum: '$likeCount' }, views: { $sum: '$viewCount' } } }]).toArray(),
    count('communityfollows'),
    count('communityjoinrequests'),
    count('premiumpayments', { status: 'PAID' }),
    c('sponsorshipinquiries').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    count('sponsorshippayments', { status: 'PAID' }),
    count('knowledgeresources'),
    c('knowledgeresources').aggregate([{ $group: { _id: null, views: { $sum: '$viewCount' }, downloads: { $sum: '$downloadCount' } } }]).toArray(),
    c('notifications').aggregate([{ $group: { _id: '$type', n: { $sum: 1 }, read: { $sum: { $cond: ['$read', 1, 0] } } } }, { $sort: { n: -1 } }]).toArray(),
    c('events').aggregate([{ $group: { _id: null, views: { $sum: '$viewCount' } } }]).toArray(),
    count('eventregistrations', { registrationType: 'WALK_IN' }),
    count('events', { waitlistEnabled: true, deletedAt: null }),
    c('certificates').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    count('externalcredentials'),
    count('profileviews'),
    count('users', { $or: [{ 'profile.skills.0': { $exists: false } }, { 'profile.skills': null }], deletedAt: null }),
    count('pushsubscriptions'),
  ]);

  console.log(JSON.stringify({
    opportunities: oppAgg, cvDocs, cvLogs, connections, convos, messages,
    pollPosts: polls, pollVotes, reposts, postsWithImage, comments,
    postEngagement: likesAgg[0] ?? null, followers, joinRequests,
    premiumPaid, sponsorInquiries, sponsorPaid,
    knowledge, knowledgeUsage: knowledgeViews[0] ?? null,
    notifsByType, totalEventViews: eventViews[0]?.views ?? 0, walkIns,
    eventsWithWaitlist: waitlistEnabled, certsByStatus, credentialDocs,
    profileViews, usersWithoutSkills: searchlessUsers, pushSubs,
  }, null, 1));
  await mongoose.disconnect();
}
void main();
