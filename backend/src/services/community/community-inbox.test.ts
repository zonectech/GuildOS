import { beforeEach, describe, expect, it, vi } from 'vitest';

// Student <-> community messaging and announcements: who may do what, blocks, limits.
const st = vi.hoisted(() => ({
  role: null as string | null, blockedBy: [] as string[], thread: null as any, lastAnnouncement: null as any, today: 0, event: null as any, members: ['aaaaaaaaaaaaaaaaaaaaaaa1', 'aaaaaaaaaaaaaaaaaaaaaaa2'], announcement: null as any,
}));
const notify = vi.hoisted(() => vi.fn(async () => undefined));
const q = (v: () => unknown) => ({ select: () => ({ lean: async () => v() }), lean: async () => v(), sort: () => ({ select: () => ({ lean: async () => v() }), limit: () => ({ lean: async () => v() }) }) });
vi.mock('../notification.service', () => ({ createNotification: notify }));
vi.mock('../../models/membership.model', async (o) => ({ ...(await o<any>()), MembershipModel: {
  findOne: vi.fn(() => q(() => (st.role ? { role: st.role } : null))),
  exists: vi.fn(async (f: any) => (f.role ? (st.role && !['MEMBER', 'VOLUNTEER'].includes(st.role) ? { _id: 1 } : null) : st.role ? { _id: 1 } : null)),
  find: vi.fn(() => q(() => st.members.map((userId) => ({ userId, communityId: 'c1', role: 'MEMBER' })))),
} }));
vi.mock('../../models/community.model', async (o) => ({ ...(await o<any>()), CommunityModel: { findOne: vi.fn(() => q(() => ({ name: 'AI Builders', slug: 'ai' }))), findById: vi.fn(() => q(() => ({ name: 'AI Builders', slug: 'ai' }))), find: vi.fn(() => q(() => [])) } }));
vi.mock('../../models/user.model', async (o) => ({ ...(await o<any>()), UserModel: { findById: vi.fn(() => q(() => ({ fullName: 'Ada' }))), find: vi.fn(() => q(() => [])) } }));
vi.mock('../../models/event.model', async (o) => ({ ...(await o<any>()), EventModel: { findOne: vi.fn(() => q(() => st.event)), find: vi.fn(() => q(() => [])) } }));
vi.mock('../../models/event-registration.model', async (o) => ({ ...(await o<any>()), EventRegistrationModel: { find: vi.fn(() => q(() => [{ userId: 'bbbbbbbbbbbbbbbbbbbbbbb1' }, { userId: 'bbbbbbbbbbbbbbbbbbbbbbb2' }])) } }));
vi.mock('../../models/content-report.model', async (o) => ({ ...(await o<any>()), ContentReportModel: { updateOne: vi.fn(async () => undefined) } }));
vi.mock('../../models/community-inbox.model', () => ({
  ANNOUNCEMENT_REACTIONS: ['👍', '❤️', '🔥', '🎉', '😂'],
  CommunityThreadModel: { findOneAndUpdate: vi.fn(async () => st.thread), findById: vi.fn(async () => st.thread), find: vi.fn(() => q(() => [])) },
  CommunityThreadMessageModel: { countDocuments: vi.fn(async () => 0), create: vi.fn(async (d: any) => ({ _id: 'msg', createdAt: new Date(), ...d })), find: vi.fn(() => q(() => [])), exists: vi.fn() },
  AnnouncementModel: {
    findOne: vi.fn((f: any) => (f._id ? Promise.resolve(st.announcement) : q(() => st.lastAnnouncement))),
    countDocuments: vi.fn(async () => st.today), create: vi.fn(async (d: any) => ({ _id: 'a1', ...d })), find: vi.fn(() => q(() => [])),
  },
  InboxStateModel: {
    findOne: vi.fn((f: any) => q(() => (st.blockedBy.includes(String(f.userId)) ? { announcementsSeenAt: new Date(0), blockedCommunityIds: [{ toString: () => 'c1' }] } : null))),
    find: vi.fn(() => q(() => st.blockedBy.map((userId) => ({ userId })))),
  },
}));
import { messageCommunity, postAnnouncement, postInThread, react } from './community-inbox.service';

const C1 = '6af1e0c7ddc296b34accfb2b';
const thread = () => ({ _id: 't1', communityId: { toString: () => 'c1' }, studentId: { toString: () => 'student' }, unreadTeam: 0, unreadStudent: 0, status: 'OPEN', save: vi.fn(async () => undefined) });
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(st, { role: null, blockedBy: [], thread: thread(), lastAnnouncement: null, today: 0, event: null, members: ['aaaaaaaaaaaaaaaaaaaaaaa1', 'aaaaaaaaaaaaaaaaaaaaaaa2'], announcement: null });
});

describe('students message communities', () => {
  it('a student starts a chat; the leaders are told once', async () => {
    await messageCommunity('student', { communityId: C1, message: 'Is the workshop beginner friendly?' });
    expect(st.thread.unreadTeam).toBe(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'New message for AI Builders' }));
  });
  it("a community's own leaders can't message it as a student", async () => {
    st.role = 'FOUNDER';
    await expect(messageCommunity('lead', { communityId: C1, message: 'hello' })).rejects.toThrow(/reply from its inbox/);
  });
  it('only leaders can reply for the community, and the reply notifies the student', async () => {
    st.role = 'MEMBER';
    await expect(postInThread('t1', 'someone', { content: 'Yes!' })).rejects.toThrow(/leaders/);
    st.role = 'VICE_PRESIDENT';
    await postInThread('t1', 'admin', { content: 'Yes, bring your laptop.' });
    expect(st.thread.unreadStudent).toBe(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'student', title: 'AI Builders replied' }));
  });
  it("if the student blocked the community, replies don't go through", async () => {
    st.role = 'FOUNDER'; st.blockedBy = ['student'];
    await expect(postInThread('t1', 'admin', { content: 'Hello?' })).rejects.toThrow(/paused messages/);
  });
});

describe('announcements', () => {
  it('reaches members who have not blocked the community', async () => {
    st.role = 'FOUNDER'; st.blockedBy = ['aaaaaaaaaaaaaaaaaaaaaaa2'];
    const a = await postAnnouncement(C1, 'lead', { text: 'Workshop moved to LT 3.' });
    expect(a.deliveredCount).toBe(1);
  });
  it('can target people registered for one of the community’s events', async () => {
    st.role = 'FOUNDER'; st.event = { _id: 'e1' };
    const a = await postAnnouncement(C1, 'lead', { text: 'Bring your laptop!', audience: { kind: 'REGISTERED', eventId: C1 } });
    expect(a.deliveredCount).toBe(2);
    st.event = null;
    await expect(postAnnouncement(C1, 'lead', { text: 'x y z', audience: { kind: 'ATTENDED', eventId: C1 } })).rejects.toThrow(/your community’s events/);
  });
  it('is limited: one every 10 minutes, ten a day; members cannot post', async () => {
    st.role = 'MEMBER';
    await expect(postAnnouncement(C1, 'm1', { text: 'hello all' })).rejects.toThrow(/leaders/);
    st.role = 'FOUNDER'; st.lastAnnouncement = { createdAt: new Date(Date.now() - 60_000) };
    await expect(postAnnouncement(C1, 'lead', { text: 'hello all' })).rejects.toThrow(/every 10 minutes/);
    st.lastAnnouncement = null; st.today = 10;
    await expect(postAnnouncement(C1, 'lead', { text: 'hello all' })).rejects.toThrow(/10 announcements today/);
  });
  it('reactions: only the offered emoji, only for people it was sent to', async () => {
    await expect(react('a1', 'x', '💩')).rejects.toThrow(/Pick one/);
    st.announcement = { recipientIds: [], audience: { kind: 'ALL' }, communityId: 'c1', reactions: [], save: vi.fn() };
    await expect(react('a1', 'outsider', '👍')).rejects.toThrow(/not found/);
  });
});
