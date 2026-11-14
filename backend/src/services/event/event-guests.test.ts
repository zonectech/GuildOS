import { beforeEach, describe, expect, it, vi } from 'vitest';

// Guest lists: signed-out visitors get counts only; the organizer's switch, each student's choice,
// private profiles, "you always see yourself", and hosts see everyone (hidden people marked).
const db = vi.hoisted(() => ({ event: null as any, regs: [] as any[], users: [] as any[], viewer: null as any, hostIds: [] as string[] }));
const lean = (v: () => unknown) => ({ select: () => ({ lean: async () => v(), sort: () => ({ limit: () => ({ lean: async () => v() }) }) }), lean: async () => v() });
vi.mock('../../models/event.model', () => ({ EventModel: { findOne: vi.fn(() => lean(() => db.event)) } }));
vi.mock('../../models/event-registration.model', () => ({ EventRegistrationModel: {
  countDocuments: vi.fn(async (q: any) => db.regs.filter((r) => q.status.$in.includes(r.status) && (!q.checkInAt || r.checkInAt)).length),
  find: vi.fn(() => lean(() => db.regs)),
} }));
vi.mock('../../models/user.model', () => ({ UserModel: { find: vi.fn(() => lean(() => db.users)), findById: vi.fn(() => lean(() => db.viewer)) } }));
// A host is someone with a leadership membership in the event's community and event access.
vi.mock('./event-shared', () => ({
  findEventMemberships: vi.fn(async (_event: unknown, userId: string) => (db.hostIds.includes(userId) ? [{ role: 'FOUNDER' }] : [])),
  membershipWith: (memberships: { role: string }[]) => memberships[0] ?? null,
}));
vi.mock('../community-access-policy', () => ({ hasApprovedCommunityAccess: vi.fn(async (userId: string) => db.hostIds.includes(userId)) }));
import { listEventGuests } from './event-guests.service';

const user = (id: string, over: Record<string, unknown> = {}) => ({ _id: id, fullName: `Student ${id}`, guestVisibility: 'VISIBLE', profile: { username: id, university: 'ABU', department: 'Computer Science', profileVisibility: 'PUBLIC' }, ...over });
beforeEach(() => {
  db.event = { guestListVisible: true, attendanceFinalizedAt: null, attendanceSource: 'GUILDOS' };
  db.regs = ['a', 'b', 'c', 'd'].map((id) => ({ userId: id, status: 'CONFIRMED', checkInAt: null }));
  db.users = [
    user('a'),
    user('b', { guestVisibility: 'HIDDEN' }),
    user('c', { guestVisibility: 'DEPARTMENT_ONLY' }),
    user('d', { profile: { username: 'd', university: 'ABU', department: 'Law', profileVisibility: 'PRIVATE' } }),
  ];
  db.viewer = null;
  db.hostIds = [];
});

describe('event guest list', () => {
  it('signed out: the count only, nobody is named', async () => {
    const r = await listEventGuests('e1', null);
    expect(r.count).toBe(4);
    expect(r.guests).toEqual([]);
    expect(r.listVisible).toBe(true);
  });
  it('signed in: lists only people who chose to be listed; hidden people still count', async () => {
    db.viewer = { profile: { university: 'ABU', department: 'Law' } };
    const r = await listEventGuests('e1', 'x');
    expect(r.count).toBe(4);
    expect(r.guests.map((g) => g.id)).toEqual(['a']);
    expect(r.guests[0].hidden).toBeUndefined();
  });
  it('hosts see everyone, with the people other students cannot see marked hidden', async () => {
    db.hostIds = ['host'];
    db.viewer = { profile: { university: 'ABU', department: 'Law' } };
    const r = await listEventGuests('e1', 'host');
    expect(r.guests.map((g) => [g.id, Boolean(g.hidden)])).toEqual([['a', false], ['b', true], ['c', true], ['d', true]]);
  });
  it('hosts still get the list when they switched it off for students', async () => {
    db.hostIds = ['host'];
    db.event.guestListVisible = false;
    const r = await listEventGuests('e1', 'host');
    expect(r.listVisible).toBe(false);
    expect(r.guests).toHaveLength(4);
  });
  it('department-only people appear to classmates in the same department and school', async () => {
    db.viewer = { profile: { university: 'ABU', department: 'computer science' } };
    const r = await listEventGuests('e1', 'x');
    expect(r.guests.map((g) => g.id)).toEqual(['a', 'c']);
  });
  it('you always see yourself, even when hidden', async () => {
    const r = await listEventGuests('e1', 'b');
    expect(r.guests.find((g) => g.id === 'b')?.isYou).toBe(true);
  });
  it('the organizer can switch the list off: counts only', async () => {
    db.event.guestListVisible = false;
    const r = await listEventGuests('e1', 'a');
    expect(r.listVisible).toBe(false);
    expect(r.guests).toEqual([]);
    expect(r.count).toBe(4);
  });
  it('external listings never show a guest list', async () => {
    db.event.attendanceSource = 'EXTERNAL';
    expect((await listEventGuests('e1', null)).listVisible).toBe(false);
  });
});
