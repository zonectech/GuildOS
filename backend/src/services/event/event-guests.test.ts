import { beforeEach, describe, expect, it, vi } from 'vitest';

// Guest lists: the organizer's switch, each student's choice, private profiles, and "you always see yourself".
const db = vi.hoisted(() => ({ event: null as any, regs: [] as any[], users: [] as any[], viewer: null as any }));
const lean = (v: () => unknown) => ({ select: () => ({ lean: async () => v(), sort: () => ({ limit: () => ({ lean: async () => v() }) }) }), lean: async () => v() });
vi.mock('../../models/event.model', () => ({ EventModel: { findOne: vi.fn(() => lean(() => db.event)) } }));
vi.mock('../../models/event-registration.model', () => ({ EventRegistrationModel: {
  countDocuments: vi.fn(async (q: any) => db.regs.filter((r) => q.status.$in.includes(r.status) && (!q.checkInAt || r.checkInAt)).length),
  find: vi.fn(() => lean(() => db.regs)),
} }));
vi.mock('../../models/user.model', () => ({ UserModel: { find: vi.fn(() => lean(() => db.users)), findById: vi.fn(() => lean(() => db.viewer)) } }));
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
});

describe('event guest list', () => {
  it('signed out: lists only people who chose to be listed; hidden people still count', async () => {
    const r = await listEventGuests('e1', null);
    expect(r.count).toBe(4);
    expect(r.guests.map((g) => g.id)).toEqual(['a']);
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
