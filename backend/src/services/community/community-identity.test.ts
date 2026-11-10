import { beforeEach, describe, expect, it, vi } from 'vitest';

// Team identity: titles set by the Owner, kept on what was sent, "former" when no longer held, "Title only".
const st = vi.hoisted(() => ({ actorRole: 'FOUNDER' as string | null, target: null as any, community: { replyIdentity: 'NAME_AND_TITLE' } as any, membershipsNow: [] as any[], messages: [] as any[] }));
const q = (v: () => unknown) => ({ select: () => ({ lean: async () => v() }), lean: async () => v(), sort: () => ({ limit: () => ({ lean: async () => v() }) }) });
vi.mock('../notification.service', () => ({ createNotification: vi.fn() }));
vi.mock('../../models/community.model', async (o) => ({ ...(await o<any>()), CommunityModel: { findById: vi.fn(() => q(() => ({ founder: 'owner', archivedAt: null, name: 'AI Builders', slug: 'ai', ...st.community }))) } }));
vi.mock('../../models/membership.model', async (o) => ({ ...(await o<any>()), MembershipModel: {
  findOne: vi.fn((f: any) => (f._id ? Promise.resolve(st.target) : q(() => (st.actorRole ? { role: st.actorRole } : null)))),
  find: vi.fn(() => q(() => st.membershipsNow)),
} }));
vi.mock('../../models/user.model', async (o) => ({ ...(await o<any>()), UserModel: { find: vi.fn(() => q(() => [{ _id: 'admin', fullName: 'Amina Yusuf', pronouns: 'she/her' }])), findById: vi.fn(() => q(() => ({ fullName: 'Ada' }))) } }));
vi.mock('../../models/community-inbox.model', () => ({
  ANNOUNCEMENT_REACTIONS: [],
  CommunityThreadModel: { findById: vi.fn(async () => ({ _id: 't1', communityId: { toString: () => 'c1' }, studentId: { toString: () => 'student' }, unreadStudent: 0, unreadTeam: 0, viewers: [], toObject: () => ({}) })) },
  CommunityThreadMessageModel: { find: vi.fn(() => q(() => st.messages)) },
  AnnouncementModel: {}, InboxStateModel: { findOne: vi.fn(() => q(() => null)) },
}));
import { setMemberTitle } from './community-membership.service';
import { openThread } from './community-inbox.service';

const M = 'aaaaaaaaaaaaaaaaaaaaaaa1';
beforeEach(() => {
  vi.clearAllMocks();
  st.actorRole = 'FOUNDER';
  st.target = { role: 'VICE_PRESIDENT', title: '', save: vi.fn(async () => undefined) };
  st.community = { replyIdentity: 'NAME_AND_TITLE' };
  st.membershipsNow = [{ _id: M, role: 'VICE_PRESIDENT', title: 'Publicity Secretary', status: 'ACTIVE' }];
  st.messages = [{ _id: 'm1', fromTeam: true, senderId: 'admin', content: 'Yes!', createdAt: new Date(), senderMembershipId: M, senderTitle: 'Publicity Secretary' }];
});

describe('team titles', () => {
  it('the Owner sets a title on a team member', async () => {
    await setMemberTitle('c1', M, 'owner', '  Publicity   Secretary ');
    expect(st.target.title).toBe('Publicity Secretary');
  });
  it('only the Owner, only team members, and not too long', async () => {
    st.actorRole = 'VICE_PRESIDENT';
    await expect(setMemberTitle('c1', M, 'vp', 'President')).rejects.toThrow(/Only the Owner/);
    st.actorRole = 'FOUNDER'; st.target.role = 'MEMBER';
    await expect(setMemberTitle('c1', M, 'owner', 'Treasurer')).rejects.toThrow(/team role first/);
    st.target.role = 'VOLUNTEER';
    await expect(setMemberTitle('c1', M, 'owner', 'x'.repeat(61))).rejects.toThrow(/under 60/);
  });
});

describe('how replies are signed', () => {
  it('students see name, pronouns and title by default', async () => {
    const r = await openThread('t1', 'student');
    expect(r.messages[0]).toMatchObject({ senderName: 'Amina Yusuf', senderPronouns: 'she/her', senderTitle: 'Publicity Secretary', former: false });
  });
  it('"Title only": students see just the title; the team still sees who', async () => {
    st.community = { replyIdentity: 'TITLE_ONLY' };
    expect((await openThread('t1', 'student')).messages[0]).toMatchObject({ senderName: '', senderTitle: 'Publicity Secretary' });
    st.actorRole = 'VICE_PRESIDENT';
    expect((await openThread('t1', 'other-admin')).messages[0]).toMatchObject({ senderName: 'Amina Yusuf' });
  });
  it('keeps the title from when it was sent, marked "former" once it changes or they leave', async () => {
    st.membershipsNow = [{ _id: M, role: 'VICE_PRESIDENT', title: 'Treasurer', status: 'ACTIVE' }];
    expect((await openThread('t1', 'student')).messages[0]).toMatchObject({ senderTitle: 'Publicity Secretary', former: true });
    st.membershipsNow = [{ _id: M, role: 'VICE_PRESIDENT', title: 'Publicity Secretary', status: 'LEFT' }];
    expect((await openThread('t1', 'student')).messages[0].former).toBe(true);
  });
});
