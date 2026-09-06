/* One-off READ-ONLY probe: platform usage stats to ground feature proposals. */
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';

async function main() {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const c = (name: string) => db.collection(name);

  const [users, communities, events, regs, payments, feedback, posts, notifs] = await Promise.all([
    c('users').countDocuments({}),
    c('communities').aggregate([{ $group: { _id: '$verificationStatus', n: { $sum: 1 } } }]).toArray(),
    c('events').aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    c('eventregistrations').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    c('ticketpayments').aggregate([{ $group: { _id: '$status', n: { $sum: 1 }, ngn: { $sum: '$organizerAmount' } } }]).toArray(),
    c('eventfeedbacks').countDocuments({}),
    c('posts').countDocuments({}),
    c('notifications').aggregate([{ $group: { _id: '$read', n: { $sum: 1 } } }]).toArray(),
  ]);

  const [certs, bookmarks, anticipations, referrals, promos, waitlisted, profiles, cvs, opportunities, messages, sponsors] = await Promise.all([
    c('certificates').countDocuments({}),
    c('eventbookmarks').countDocuments({}),
    c('eventanticipations').countDocuments({}).catch(() => -1),
    c('ticketpayments').countDocuments({ referrer: { $nin: ['', null] } }),
    c('ticketpayments').countDocuments({ promoCode: { $nin: ['', null] } }),
    c('eventregistrations').countDocuments({ status: 'WAITLISTED' }),
    c('users').countDocuments({ 'profile.headline': { $nin: ['', null] } }),
    c('users').countDocuments({ 'cv.sections.0': { $exists: true } }).catch(() => -1),
    c('opportunities').countDocuments({}).catch(() => -1),
    c('messages').countDocuments({}).catch(() => -1),
    c('eventsponsors').countDocuments({}),
  ]);

  // Events with zero feedback despite completions
  const completedEvents = await c('events').countDocuments({ deletedAt: null, status: { $in: ['COMPLETED', 'CHECK_OUT'] } });
  const eventsWithFeedback = (await c('eventfeedbacks').distinct('eventId')).length;
  // Upcoming events lacking a banner/description quality signals
  const upcoming = await c('events').find({ deletedAt: null, status: 'PUBLISHED', startDate: { $gt: new Date() } }).project({ title: 1, startDate: 1, registrationCount: 1, ticketPrice: 1, attendeeChatLink: 1 }).toArray();
  // Users who registered for events but never posted
  const activeUserIds = await c('eventregistrations').distinct('userId');
  const posters = await c('posts').distinct('userId');
  const posterSet = new Set(posters.map(String));
  const regButNeverPosted = activeUserIds.filter((id) => !posterSet.has(String(id))).length;
  // Login recency
  const now = Date.now();
  const [active7, active30] = await Promise.all([
    c('users').countDocuments({ lastLoginAt: { $gt: new Date(now - 7 * 86400_000) } }).catch(() => -1),
    c('users').countDocuments({ lastLoginAt: { $gt: new Date(now - 30 * 86400_000) } }).catch(() => -1),
  ]);

  console.log(JSON.stringify({
    users, active7, active30, communities, events, regs,
    payments: payments.map((p) => ({ ...p, ngn: Math.round((p.ngn ?? 0) / 100) })),
    feedback, completedEvents, eventsWithFeedback, posts,
    notifs, certs, bookmarks, anticipations, referrals, promos, waitlisted,
    profilesWithHeadline: profiles, cvs, opportunities, messages, sponsors,
    regButNeverPosted, upcomingCount: upcoming.length,
    upcoming: upcoming.map((e) => ({ t: e.title, regs: e.registrationCount, paid: (e.ticketPrice ?? 0) > 0, chat: Boolean(e.attendeeChatLink) })),
  }, null, 1));
  await mongoose.disconnect();
}
void main();
