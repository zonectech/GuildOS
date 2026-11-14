import { beforeEach, describe, expect, it, vi } from 'vitest';

// "Report an attendance issue": only after the event, only if registered, one open report at a time; organizers reply.
const st = vi.hoisted(() => ({ event: null as any, reg: null as any, open: false, issue: null as any }));
const chain = (v: () => unknown) => ({ select: () => ({ lean: async () => v() }), lean: async () => v() });
const notify = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../notification.service', () => ({ createNotification: notify }));
vi.mock('../../models/event.model', () => ({ EventModel: { findOne: vi.fn(() => chain(() => st.event)), find: vi.fn(() => chain(() => [])) } }));
vi.mock('../../models/event-registration.model', () => ({ EventRegistrationModel: { findOne: vi.fn(() => chain(() => st.reg)) } }));
vi.mock('../../models/user.model', () => ({ UserModel: { findById: vi.fn(() => chain(() => ({ fullName: 'Ada Demo' }))), find: vi.fn(() => chain(() => [])) } }));
vi.mock('../../models/membership.model', () => ({ MembershipModel: { find: vi.fn(() => chain(() => [{ userId: 'lead' }])) } }));
vi.mock('./event-shared', () => ({ requireEventManager: vi.fn(async () => ({ title: 'Study Jam' })) }));
vi.mock('../../models/attendance-issue.model', () => ({ AttendanceIssueModel: {
  exists: vi.fn(async () => (st.open ? { _id: 'i' } : null)),
  create: vi.fn(async (d: any) => ({ _id: 'i1', status: 'SENT', ...d })),
  findOne: vi.fn(async () => st.issue),
} }));
import { reportAttendanceIssue, reviewAttendanceIssue } from './attendance-issue.service';

beforeEach(() => {
  vi.clearAllMocks();
  st.event = { _id: 'e1', title: 'Study Jam', slug: 'study-jam', endDate: new Date(Date.now() - 3600_000), communityId: 'c1', createdBy: 'creator' };
  st.reg = { _id: 'r1' };
  st.open = false;
  st.issue = { userId: 'u1', status: 'SENT', response: '', save: vi.fn(async () => undefined) };
});
const message = 'I was there until the end but nobody scanned me out.';

describe('report an attendance issue', () => {
  it('sends the report and tells the creator and senior leaders', async () => {
    const issue = await reportAttendanceIssue('e1', 'u1', { message });
    expect(issue.status).toBe('SENT');
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ link: '/events/study-jam/manage' }));
  });
  it('only after the event has ended', async () => {
    st.event.endDate = new Date(Date.now() + 3600_000);
    await expect(reportAttendanceIssue('e1', 'u1', { message })).rejects.toThrow(/once the event has ended/);
  });
  it('only if you were registered', async () => {
    st.reg = null;
    await expect(reportAttendanceIssue('e1', 'u1', { message })).rejects.toThrow(/not registered/);
  });
  it('one open report at a time, and it needs a real message', async () => {
    await expect(reportAttendanceIssue('e1', 'u1', { message: 'help' })).rejects.toThrow(/at least a sentence/);
    st.open = true;
    await expect(reportAttendanceIssue('e1', 'u1', { message })).rejects.toThrow(/already have a report/);
  });
  it('organizers mark it reviewed with a reply; the student is told', async () => {
    await reviewAttendanceIssue('e1', 'i1', 'lead', { response: 'Fixed: we corrected your check-out.' });
    expect(st.issue.status).toBe('REVIEWED');
    expect(st.issue.response).toMatch(/corrected/);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
    await expect(reviewAttendanceIssue('e1', 'i1', 'lead', { response: 'Again' })).rejects.toThrow(/already reviewed/);
  });
});
