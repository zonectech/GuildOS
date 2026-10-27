import { beforeEach, describe, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ event: {} as any, rows: [] as any[], users: [] as any[], aliases: [] as any[], regs: [] as any[], covered: null as number[] | null, conflict: false }));
vi.mock('../../models/external-report.model', () => ({ ExternalReportModel: {
  findOne: vi.fn(() => ({ lean: async () => ({ _id: 'report', eventId: 'event', filename: 'report.csv', kind: state.event.kind || 'ATTENDANCE', rows: state.rows, appliedAt: null }) })),
  findOneAndUpdate: vi.fn(async (_q, update) => { state.rows = update.$setOnInsert.rows; return { _id: 'report' }; }),
  updateOne: vi.fn(async () => ({})),
} }));
vi.mock('../../models/event.model', () => ({ EventModel: { findOne: vi.fn(() => ({ lean: async () => state.event })) } }));
vi.mock('../../models/event-registration.model', () => ({ EventRegistrationModel: { find: vi.fn(q => { const rows = q.$or ? state.regs.filter(r => r.checkOutAt || (r.attendanceEvidence === 'ORGANIZER_IMPORT' && r.externalAttendance.length)) : q.checkOutAt ? state.regs.filter(r => r.checkOutAt) : state.regs; return { lean: async () => rows, select: () => ({ lean: async () => rows }) }; }), countDocuments: vi.fn(async () => 0), updateOne: vi.fn(async () => ({ modifiedCount: state.conflict ? 0 : 1 })), findOne: vi.fn(async q => state.regs.find(r => r._id === q._id)) } }));
vi.mock('../../models/user.model', () => ({ UserModel: { find: vi.fn(() => ({ select: () => ({ lean: async () => state.users }) })) } }));
vi.mock('../../models/member-email.model', () => ({ MemberEmailModel: { find: vi.fn(() => ({ lean: async () => state.aliases })) } }));
vi.mock('./event-ticket.service', () => ({ ticketCoveredDays: vi.fn(async () => state.covered) }));
vi.mock('./event-shared', () => ({
  findEventMemberships: vi.fn(async () => [{ role: 'COORDINATOR' }]), membershipWith: vi.fn(() => true),
  requireEventManager: vi.fn(async () => state.event), recalcEventCounters: vi.fn(async () => {}),
  isMultiDayEvent: (e: any) => e.multi || false,
  requiredAttendanceDays: (e: any) => e.required || 1,
  cancelledEventDays: (e: any) => e.cancelled || [],
  dayKeyOf: (d: Date) => new Date(d).toISOString().slice(0, 10),
}));
import { inspectExternalReport, applyExternalReport, previewExternalReport, reportDayNumber } from './external-report.service';
import { requireEventManager } from './event-shared';
import { getEventAnalytics } from './event-analytics.service';
beforeEach(() => {
  vi.clearAllMocks();
  state.event = { attendanceSource: 'EXTERNAL', startDate: new Date('2026-01-10T09:00:00Z'), endDate: new Date('2026-01-10T12:00:00Z'), minimumAttendanceDuration: 30, status: 'PUBLISHED' };
  state.rows = [{ row: 2, email: 'ada@school.edu', minutes: 45, day: '' }];
  state.conflict = false;
  state.users = [{ _id: 'ada', email: 'ada@school.edu', emailVerified: true }]; state.aliases = []; state.covered = null;
  state.regs = [{ _id: 'reg', userId: 'ada', status: 'CONFIRMED', checkInAt: null, certificateIssued: false, externalAttendance: [], save: vi.fn(async () => {}) }];
});
describe('external report identity and eligibility', () => {
  it('does not count a concurrent cancellation or conflicting import as applied', async () => {
    state.conflict = true; const result = await applyExternalReport('event', 'actor', 'report');
    expect(result.applied).toBe(0); expect(result.conflicts).toBe(1); expect(result.needsReview).toBe(1);
  });
  it('includes imported attendance in average duration without inventing checkout times', async () => {
    state.regs[0].attendanceEvidence = 'ORGANIZER_IMPORT'; state.regs[0].externalAttendance = [{ day: '2026-01-10', minutes: 45 }]; state.regs[0].attendanceMinutes = 45;
    expect((await getEventAnalytics('event', 'actor')).averageAttendanceDuration).toBe(45);
  });
  it('requires manager access before reading reports', async () => {
    vi.mocked(requireEventManager).mockRejectedValueOnce(new Error('Insufficient permissions'));
    await expect(inspectExternalReport('event', 'visitor', 'report')).rejects.toThrow(/permissions/);
  });
  it('matches a verified primary email and preserves evidence provenance', async () => {
    expect((await inspectExternalReport('event', 'actor', 'report')).matched).toBe(1);
    await applyExternalReport('event', 'actor', 'report');
    expect(state.regs[0]).toMatchObject({ status: 'COMPLETED', certificateEligible: true, attendanceMinutes: 45, attendanceVerified: false, attendanceEvidence: 'ORGANIZER_IMPORT', externalReportId: 'report', checkInAt: null });
  });
  it('leaves unverified email unmatched even when the name would match', async () => {
    state.users[0].emailVerified = false;
    expect((await inspectExternalReport('event', 'actor', 'report')).needsReview).toBe(1);
    expect((await applyExternalReport('event', 'actor', 'report')).applied).toBe(0);
  });
  it('resolves an unmatched record after an alternate email is verified', async () => {
    state.users[0].email = 'ada@personal.com';
    expect((await inspectExternalReport('event', 'actor', 'report')).matched).toBe(0);
    state.aliases = [{ userId: 'ada', email: 'ada@school.edu' }];
    expect((await inspectExternalReport('event', 'actor', 'report')).matched).toBe(1);
  });
  it('rejects ambiguous email ownership', async () => {
    state.users.push({ _id: 'other', email: 'other@school.edu', emailVerified: true }); state.aliases.push({ userId: 'other', email: 'ada@school.edu' });
    expect((await inspectExternalReport('event', 'actor', 'report')).rows[0].reason).toMatch(/Ambiguous/);
  });
  it.each(['CANCELLED','REJECTED','WAITLISTED','PENDING_APPROVAL'])('does not certify %s registrations', async status => {
    state.regs[0].status = status;
    expect((await inspectExternalReport('event', 'actor', 'report')).matched).toBe(0);
  });
  it('never turns a registration list into attendance', async () => {
    state.event.kind = 'REGISTRATION'; await applyExternalReport('event', 'actor', 'report');
    expect(state.regs[0].externalRegistrationConfirmedAt).toBeInstanceOf(Date);
    expect(state.regs[0].status).toBe('CONFIRMED'); expect(state.regs[0].certificateEligible).toBeUndefined();
  });
  it('does not add attendance duration twice on replay', async () => {
    await applyExternalReport('event', 'actor', 'report'); await applyExternalReport('event', 'actor', 'report');
    expect(state.regs[0].attendanceMinutes).toBe(45); expect(state.regs[0].externalAttendance).toHaveLength(1);
  });
  it('requires enough duration for a certificate', async () => {
    state.rows[0].minutes = 20; await applyExternalReport('event', 'actor', 'report');
    expect(state.regs[0].status).toBe('PARTIAL_ATTENDANCE'); expect(state.regs[0].certificateEligible).toBe(false);
  });
  it('does not treat missing or zero duration as qualifying time', async () => {
    state.rows[0].minutes = null; expect((await inspectExternalReport('event', 'actor', 'report')).matched).toBe(0);
    state.rows[0].minutes = 0; state.event.minimumAttendanceDuration = 0; expect((await inspectExternalReport('event', 'actor', 'report')).matched).toBe(0);
  });
  it('requires each scheduled day for multi-day attendance', async () => {
    state.event.multi = true; state.event.required = 2; state.event.endDate = new Date('2026-01-11T12:00:00Z'); state.rows[0].day = '2026-01-10';
    await applyExternalReport('event', 'actor', 'report'); expect(state.regs[0].status).toBe('PARTIAL_ATTENDANCE');
    state.rows[0].day = '2026-01-11'; await applyExternalReport('event', 'actor', 'report'); expect(state.regs[0].status).toBe('COMPLETED'); expect(state.regs[0].attendanceMinutes).toBe(90);
  });
  it('rejects out-of-schedule dates again at apply time', async () => {
    state.rows[0].day = '2026-01-12'; expect((await applyExternalReport('event', 'actor', 'report')).applied).toBe(0);
  });
  it('does not modify issued certificates or existing GuildOS attendance', async () => {
    state.regs[0].certificateIssued = true; expect((await applyExternalReport('event', 'actor', 'report')).applied).toBe(0);
    state.regs[0].certificateIssued = false; state.regs[0].checkInAt = new Date(); expect((await applyExternalReport('event', 'actor', 'report')).applied).toBe(0);
  });
  it('blocks attendance imports before event end and on GuildOS attendance events', async () => {
    state.event.endDate = new Date(Date.now() + 60000); await expect(applyExternalReport('event', 'actor', 'report')).rejects.toThrow(/after the event/);
    state.event.endDate = new Date('2026-01-10'); state.event.attendanceSource = 'GUILDOS'; await expect(previewExternalReport('event', 'actor', { kind: 'ATTENDANCE', text: 'email,minutes\nada@school.edu,45' })).rejects.toThrow(/external attendance/);
  });
  it('maps explicit agenda dates and event spans consistently', () => {
    expect(reportDayNumber(state.event, '2026-01-10')).toBe(1); expect(reportDayNumber(state.event, '2026-01-09')).toBe(0);
  });
});
