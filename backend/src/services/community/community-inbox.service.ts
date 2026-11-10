import mongoose from 'mongoose';
import { ANNOUNCEMENT_REACTIONS, AnnouncementModel, CommunityThreadMessageModel, CommunityThreadModel, InboxStateModel } from '../../models/community-inbox.model';
import { CommunityModel } from '../../models/community.model';
import { ContentReportModel } from '../../models/content-report.model';
import { EventModel } from '../../models/event.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { MembershipModel } from '../../models/membership.model';
import { UserModel } from '../../models/user.model';
import { createNotification } from '../notification.service';
import { hasCommunityPermission } from './community-shared';

const oid = (v: string) => new mongoose.Types.ObjectId(v);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const REGISTERED = ['CONFIRMED', 'WAITLISTED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'];
/** Announcements: one per 10 minutes, at most 10 a day, per community. Student messages: 20 an hour per chat. */
export const LIMITS = { announceGapMs: 10 * 60_000, announcePerDay: 10, studentPerHour: 20 };

/** Owners and Admins (coordinator and above) answer for the community. */
export async function requireTeam(communityId: string, userId: string) {
  const m = await MembershipModel.findOne({ communityId, userId, status: 'ACTIVE' }).select('role').lean();
  if (!m || !hasCommunityPermission(m.role, 'COORDINATOR')) throw new Error('Only the community’s leaders can do this');
  return m;
}
type InboxState = { announcementsSeenAt: Date; blockedCommunityIds: mongoose.Types.ObjectId[] };
async function state(userId: string): Promise<InboxState> {
  const s = (await InboxStateModel.findOne({ userId }).lean()) as InboxState | null;
  return s ?? { announcementsSeenAt: new Date(0), blockedCommunityIds: [] };
}
const blocked = (s: { blockedCommunityIds?: unknown[] }, communityId: string) => (s.blockedCommunityIds ?? []).some((c) => String(c) === communityId);

/* ── Chats ─────────────────────────────────────────────────────────── */

/** "Contact the host": a student writes to a community. One conversation per student and community. */
export async function messageCommunity(studentId: string, input: { communityId?: unknown; message?: unknown; eventId?: unknown }) {
  const communityId = text(input.communityId, 40);
  const content = text(input.message, 2000);
  if (!mongoose.isValidObjectId(communityId)) throw new Error('Choose a community');
  if (content.length < 2) throw new Error('Write a message');
  const community = await CommunityModel.findOne({ _id: communityId, archivedAt: null }).select('name slug').lean();
  if (!community) throw new Error('Community not found');
  if (await MembershipModel.exists({ communityId, userId: studentId, status: 'ACTIVE', role: { $nin: ['MEMBER', 'VOLUNTEER'] } })) throw new Error('You run this community; reply from its inbox instead');
  const eventId = mongoose.isValidObjectId(input.eventId) ? String(input.eventId) : null;
  const thread = await CommunityThreadModel.findOneAndUpdate(
    { communityId, studentId },
    { $setOnInsert: { communityId, studentId, eventId }, $set: { status: 'OPEN' } },
    { upsert: true, new: true },
  );
  await addMessage(thread, studentId, false, content);
  return thread;
}

/** Add a message to a chat, from the student or from the team (whoever is allowed). */
export async function postInThread(threadId: string, userId: string, input: { content?: unknown }) {
  const content = text(input.content, 2000);
  if (content.length < 1) throw new Error('Write a message');
  const thread = await CommunityThreadModel.findById(threadId);
  if (!thread) throw new Error('Conversation not found');
  const isStudent = String(thread.studentId) === userId;
  if (!isStudent) await requireTeam(String(thread.communityId), userId);
  if (!isStudent && blocked(await state(String(thread.studentId)), String(thread.communityId))) throw new Error('This student has paused messages from your community');
  return addMessage(thread, userId, !isStudent, content);
}

async function addMessage(thread: any, senderId: string, fromTeam: boolean, content: string) {
  if (!fromTeam) {
    const recent = await CommunityThreadMessageModel.countDocuments({ threadId: thread._id, fromTeam: false, createdAt: { $gte: new Date(Date.now() - 3600_000) } });
    if (recent >= LIMITS.studentPerHour) throw new Error('You’ve sent a lot of messages. Wait for the community to reply');
  }
  const msg = await CommunityThreadMessageModel.create({ threadId: thread._id, senderId, fromTeam, content });
  const wasUnreadTeam = thread.unreadTeam;
  thread.lastMessage = content.slice(0, 160);
  thread.lastMessageAt = msg.createdAt;
  thread.lastFromTeam = fromTeam;
  if (fromTeam) thread.unreadStudent += 1; else { thread.unreadTeam += 1; thread.status = 'OPEN'; }
  await thread.save();

  const community = await CommunityModel.findById(thread.communityId).select('name slug').lean();
  if (fromTeam) {
    await createNotification({ userId: String(thread.studentId), type: 'MESSAGE', actorId: senderId, title: `${community?.name ?? 'A community'} replied`, body: content.slice(0, 140), link: `/inbox?chat=${thread._id}`, deliveryKey: `thread:${thread._id}:${msg._id}` });
  } else if (!wasUnreadTeam) {
    // Tell the leaders once per unanswered conversation, not on every message.
    const leaders = await MembershipModel.find({ communityId: thread.communityId, status: 'ACTIVE', role: { $in: ['FOUNDER', 'PRESIDENT', 'VICE_PRESIDENT'] } }).select('userId').lean();
    const student = await UserModel.findById(senderId).select('fullName').lean();
    for (const l of leaders) await createNotification({ userId: String(l.userId), type: 'MESSAGE', actorId: senderId, title: `New message for ${community?.name ?? 'your community'}`, body: `${student?.fullName ?? 'A student'}: ${content.slice(0, 120)}`, link: `/inbox/team/${community?.slug ?? ''}?chat=${thread._id}` });
  }
  return msg;
}

/** A student's chats with communities. */
export async function studentThreads(studentId: string) {
  const threads = await CommunityThreadModel.find({ studentId }).sort({ lastMessageAt: -1 }).limit(100).lean();
  const communities = await CommunityModel.find({ _id: { $in: threads.map((t) => t.communityId) } }).select('name slug logo verificationStatus').lean();
  const byId = new Map(communities.map((c) => [String(c._id), c]));
  return threads.map((t) => ({ ...t, community: byId.get(String(t.communityId)) ?? null }));
}

/** The team inbox: a community's chats, open or resolved. */
export async function teamThreads(communityId: string, userId: string, status: 'OPEN' | 'RESOLVED' = 'OPEN') {
  await requireTeam(communityId, userId);
  const threads = await CommunityThreadModel.find({ communityId, status }).sort({ lastMessageAt: -1 }).limit(200).lean();
  const students = await UserModel.find({ _id: { $in: threads.map((t) => t.studentId) } }).select('fullName profile.avatar profile.department profile.university').lean();
  const byId = new Map(students.map((s) => [String(s._id), s]));
  return threads.map((t) => ({ ...t, student: byId.get(String(t.studentId)) ?? null }));
}

/** One chat with its messages; reading it clears the reader's unread count. Team messages show who replied. */
export async function openThread(threadId: string, userId: string) {
  const thread = await CommunityThreadModel.findById(threadId);
  if (!thread) throw new Error('Conversation not found');
  const isStudent = String(thread.studentId) === userId;
  if (!isStudent) await requireTeam(String(thread.communityId), userId);
  if (isStudent && thread.unreadStudent) { thread.unreadStudent = 0; await thread.save(); }
  if (!isStudent && thread.unreadTeam) { thread.unreadTeam = 0; await thread.save(); }
  const messages = await CommunityThreadMessageModel.find({ threadId }).sort({ createdAt: 1 }).limit(500).lean();
  const senders = await UserModel.find({ _id: { $in: [...new Set(messages.map((m) => String(m.senderId)))] } }).select('fullName profile.avatar').lean();
  const names = new Map(senders.map((s) => [String(s._id), s]));
  const community = await CommunityModel.findById(thread.communityId).select('name slug logo').lean();
  const student = await UserModel.findById(thread.studentId).select('fullName profile.avatar').lean();
  return {
    thread: thread.toObject(), community, student, viewer: isStudent ? 'STUDENT' : 'TEAM',
    blocked: blocked(await state(String(thread.studentId)), String(thread.communityId)),
    // Students see the community's name on replies; the team also sees which admin answered.
    messages: messages.map((m) => ({ ...m, senderName: names.get(String(m.senderId))?.fullName ?? '', senderAvatar: names.get(String(m.senderId))?.profile?.avatar ?? '' })),
  };
}

export async function setThreadStatus(threadId: string, userId: string, status: unknown) {
  if (status !== 'OPEN' && status !== 'RESOLVED') throw new Error('Choose open or resolved');
  const thread = await CommunityThreadModel.findById(threadId);
  if (!thread) throw new Error('Conversation not found');
  await requireTeam(String(thread.communityId), userId);
  thread.status = status;
  thread.resolvedBy = status === 'RESOLVED' ? (userId as never) : null;
  await thread.save();
  return thread;
}

/* ── Announcements ─────────────────────────────────────────────────── */

/** Who an announcement would reach. ALL = active members who haven't blocked the community. */
export async function audienceOf(communityId: string, audience: { kind?: unknown; eventId?: unknown }) {
  const kind = audience.kind === 'REGISTERED' || audience.kind === 'ATTENDED' ? audience.kind : 'ALL';
  let ids: string[];
  let eventId: string | null = null;
  if (kind === 'ALL') {
    ids = (await MembershipModel.find({ communityId, status: 'ACTIVE' }).select('userId').lean()).map((m) => String(m.userId));
  } else {
    eventId = mongoose.isValidObjectId(audience.eventId) ? String(audience.eventId) : '';
    const event = eventId ? await EventModel.findOne({ _id: eventId, communityId, deletedAt: null }).select('_id').lean() : null;
    if (!event) throw new Error('Choose one of your community’s events');
    const statuses = kind === 'ATTENDED' ? ['COMPLETED'] : REGISTERED;
    ids = (await EventRegistrationModel.find({ eventId, status: { $in: statuses } }).select('userId').lean()).map((r) => String(r.userId));
  }
  const blockers = new Set((await InboxStateModel.find({ userId: { $in: ids.map(oid) }, blockedCommunityIds: oid(communityId) }).select('userId').lean()).map((s) => String(s.userId)));
  return { kind, eventId, ids: [...new Set(ids)].filter((id) => !blockers.has(id)) };
}

export async function postAnnouncement(communityId: string, authorId: string, input: { text?: unknown; image?: unknown; eventId?: unknown; audience?: { kind?: unknown; eventId?: unknown } }) {
  await requireTeam(communityId, authorId);
  const body = text(input.text, 2000);
  if (body.length < 3) throw new Error('Write your announcement');
  const image = text(input.image, 300);
  if (image && !/^(\/uploads\/|https:\/\/)/.test(image)) throw new Error('Upload the image first');
  const attach = mongoose.isValidObjectId(input.eventId) ? await EventModel.findOne({ _id: input.eventId, communityId, deletedAt: null }).select('_id').lean() : null;
  const last = (await AnnouncementModel.findOne({ communityId }).sort({ createdAt: -1 }).select('createdAt').lean()) as { createdAt: Date } | null;
  if (last && Date.now() - new Date(last.createdAt).getTime() < LIMITS.announceGapMs) throw new Error('One announcement every 10 minutes. Try again shortly');
  const today = await AnnouncementModel.countDocuments({ communityId, createdAt: { $gte: new Date(Date.now() - 86400_000) } });
  if (today >= LIMITS.announcePerDay) throw new Error('That’s 10 announcements today. Try again tomorrow');

  const aud = await audienceOf(communityId, input.audience ?? {});
  const a = await AnnouncementModel.create({
    communityId, authorId, text: body, image, eventId: attach?._id ?? null,
    audience: { kind: aud.kind, eventId: aud.eventId }, recipientIds: aud.kind === 'ALL' ? [] : aud.ids.map(oid), deliveredCount: aud.ids.length,
  });
  const community = await CommunityModel.findById(communityId).select('name').lean();
  // A notification each (bounded), so phones buzz; the inbox shows the post itself.
  for (const id of aud.ids.slice(0, 2000)) {
    if (id === authorId) continue;
    await createNotification({ userId: id, type: 'SYSTEM', actorId: authorId, title: `${community?.name ?? 'A community'} posted an announcement`, body: body.slice(0, 140), link: '/inbox?tab=announcements', deliveryKey: `announcement:${a._id}:${id}` });
  }
  return a;
}

const shapeAnnouncement = (a: any, userId: string | null, community?: any, event?: any) => {
  const counts: Record<string, number> = {};
  for (const r of a.reactions ?? []) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
  return {
    id: String(a._id), communityId: String(a.communityId), text: a.text, image: a.image, createdAt: a.createdAt, audience: a.audience, deliveredCount: a.deliveredCount,
    reactions: ANNOUNCEMENT_REACTIONS.map((emoji) => ({ emoji, count: counts[emoji] ?? 0, mine: Boolean(userId && (a.reactions ?? []).some((r: any) => String(r.userId) === userId && r.emoji === emoji)) })),
    community: community ? { id: String(community._id), name: community.name, slug: community.slug, logo: community.logo, verified: community.verificationStatus === 'VERIFIED' } : null,
    event: event ? { id: String(event._id), title: event.title, slug: event.slug, startDate: event.startDate, venue: event.venue, bannerImage: event.bannerImage, type: event.type } : null,
  };
};
async function decorate(list: any[], userId: string | null) {
  const communities = await CommunityModel.find({ _id: { $in: list.map((a) => a.communityId) } }).select('name slug logo verificationStatus').lean();
  const events = await EventModel.find({ _id: { $in: list.map((a) => a.eventId).filter(Boolean) } }).select('title slug startDate venue bannerImage type').lean();
  const c = new Map(communities.map((x) => [String(x._id), x]));
  const e = new Map(events.map((x) => [String(x._id), x]));
  return list.map((a) => shapeAnnouncement(a, userId, c.get(String(a.communityId)), a.eventId ? e.get(String(a.eventId)) : null));
}

/** Announcements for a student: everything from communities they're in, plus event-targeted ones sent to them. */
export async function myAnnouncements(userId: string, before?: string) {
  const s = await state(userId);
  const memberOf = (await MembershipModel.find({ userId, status: 'ACTIVE' }).select('communityId').lean()).map((m) => m.communityId);
  const blockedIds = (s.blockedCommunityIds ?? []).map(String);
  const q: Record<string, unknown> = {
    hiddenAt: null,
    communityId: { $nin: blockedIds.map(oid) },
    $or: [{ 'audience.kind': 'ALL', communityId: { $in: memberOf } }, { recipientIds: oid(userId) }],
  };
  if (before && !Number.isNaN(new Date(before).getTime())) q.createdAt = { $lt: new Date(before) };
  const list = await AnnouncementModel.find(q).sort({ createdAt: -1 }).limit(20).lean();
  return { announcements: await decorate(list, userId), seenAt: s.announcementsSeenAt, next: list.length === 20 ? list[list.length - 1].createdAt : null };
}
export async function markAnnouncementsSeen(userId: string) {
  await InboxStateModel.updateOne({ userId }, { $set: { announcementsSeenAt: new Date() } }, { upsert: true });
}
/** A community's own announcements (for its leaders). */
export async function communityAnnouncements(communityId: string, userId: string) {
  await requireTeam(communityId, userId);
  const list = await AnnouncementModel.find({ communityId }).sort({ createdAt: -1 }).limit(50).lean();
  return decorate(list, userId);
}

/** Toggle a reaction (one of a few emoji). */
export async function react(announcementId: string, userId: string, emoji: unknown) {
  if (!(ANNOUNCEMENT_REACTIONS as readonly string[]).includes(String(emoji))) throw new Error('Pick one of the reactions');
  const a = await AnnouncementModel.findOne({ _id: announcementId, hiddenAt: null });
  if (!a) throw new Error('Announcement not found');
  const canSee = a.recipientIds.some((r: unknown) => String(r) === userId) || (a.audience?.kind === 'ALL' && await MembershipModel.exists({ communityId: a.communityId, userId, status: 'ACTIVE' }));
  if (!canSee) throw new Error('Announcement not found');
  const i = a.reactions.findIndex((r: any) => String(r.userId) === userId && r.emoji === emoji);
  if (i >= 0) a.reactions.splice(i, 1); else a.reactions.push({ userId: oid(userId), emoji: String(emoji) });
  await a.save();
  return (await decorate([a.toObject()], userId))[0];
}

/** Report an announcement or a message to the platform moderators. */
export async function reportContent(kind: 'ANNOUNCEMENT' | 'COMMUNITY_MESSAGE', targetId: string, reporterId: string, reason: unknown) {
  if (!mongoose.isValidObjectId(targetId)) throw new Error('Not found');
  const exists = kind === 'ANNOUNCEMENT' ? await AnnouncementModel.exists({ _id: targetId }) : await CommunityThreadMessageModel.exists({ _id: targetId });
  if (!exists) throw new Error('Not found');
  await ContentReportModel.updateOne({ targetType: kind, targetId, reporterId }, { $setOnInsert: { targetType: kind, targetId, reporterId, reason: text(reason, 500) } }, { upsert: true });
  return { reported: true };
}

/* ── Blocking and unread ───────────────────────────────────────────── */

export async function setBlocked(userId: string, communityId: string, on: boolean) {
  if (!mongoose.isValidObjectId(communityId)) throw new Error('Community not found');
  await InboxStateModel.updateOne({ userId }, on ? { $addToSet: { blockedCommunityIds: oid(communityId) } } : { $pull: { blockedCommunityIds: oid(communityId) } }, { upsert: true });
  return { blocked: on };
}
export async function blockedCommunities(userId: string) {
  const s = await state(userId);
  return CommunityModel.find({ _id: { $in: s.blockedCommunityIds ?? [] } }).select('name slug logo').lean();
}

/** Unread counts for the nav and the inbox tabs. */
export async function unreadCounts(userId: string) {
  const s = await state(userId);
  const chats = (await CommunityThreadModel.find({ studentId: userId, unreadStudent: { $gt: 0 } }).select('unreadStudent').lean()).reduce((n, t) => n + t.unreadStudent, 0);
  const memberOf = (await MembershipModel.find({ userId, status: 'ACTIVE' }).select('communityId role').lean());
  const blockedIds = (s.blockedCommunityIds ?? []).map(String);
  const announcements = await AnnouncementModel.countDocuments({
    hiddenAt: null, createdAt: { $gt: s.announcementsSeenAt }, authorId: { $ne: oid(userId) }, communityId: { $nin: blockedIds.map(oid) },
    $or: [{ 'audience.kind': 'ALL', communityId: { $in: memberOf.map((m) => m.communityId) } }, { recipientIds: oid(userId) }],
  });
  const led = memberOf.filter((m) => hasCommunityPermission(m.role, 'COORDINATOR')).map((m) => m.communityId);
  const team = led.length ? (await CommunityThreadModel.find({ communityId: { $in: led }, unreadTeam: { $gt: 0 }, status: 'OPEN' }).select('unreadTeam').lean()).reduce((n, t) => n + t.unreadTeam, 0) : 0;
  return { chats, announcements, team, total: chats + announcements + team };
}
