import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ registrations: [] as any[] }));
vi.mock('../../models/event-registration.model', () => ({ EventRegistrationModel: { countDocuments: vi.fn(async q => state.registrations.filter(r => q.status.$in.includes(r.status) && (!q.$or || r.checkInAt || r.externalAttendance?.length) && (!q.attendanceEvidence || r.attendanceEvidence === q.attendanceEvidence)).length) } }));
import { getPublicEventParticipation } from './event-public-participation';
import { EventRegistrationModel } from '../../models/event-registration.model';
const now = new Date('2026-10-27T12:00:00Z');
const event = { _id: 'event', endDate: new Date('2026-10-26T12:00:00Z'), attendanceFinalizedAt: new Date('2026-10-26T13:00:00Z') };
beforeEach(() => { vi.clearAllMocks(); state.registrations = []; });
describe('public event participation totals', () => {
  it('counts confirmed registrations, excluding pending, waiting, canceled and rejected records', async () => {
    state.registrations = ['CONFIRMED','COMPLETED','NO_SHOW','PENDING_APPROVAL','WAITLISTED','CANCELLED','REJECTED'].map(status => ({ status }));
    expect((await getPublicEventParticipation(event, now)).registered).toBe(3);
  });
  it('keeps attendance pending until explicitly finalized, even when the event has ended', async () => {
    state.registrations = [{ status: 'CHECKED_IN', checkInAt: now }];
    expect(await getPublicEventParticipation({ ...event, attendanceFinalizedAt: null }, now)).toEqual({ registered: 1, attended: null, finalized: false, evidence: null });
    expect(EventRegistrationModel.countDocuments).toHaveBeenCalledTimes(1);
  });
  it('does not publish premature attendance before the event end time', async () => {
    expect((await getPublicEventParticipation({ ...event, endDate: new Date('2026-10-28') }, now)).attended).toBeNull();
  });
  it('shows a real zero after finalization instead of treating it as pending', async () => {
    expect(await getPublicEventParticipation(event, now)).toEqual({ registered: 0, attended: 0, finalized: true, evidence: 'GUILDOS' });
  });
  it('counts each attendee once across multiple days and excludes no-shows', async () => {
    state.registrations = [{ status: 'COMPLETED', checkInAt: now, externalAttendance: [{ day: 'a' },{ day: 'b' }] }, { status: 'NO_SHOW' }, { status: 'PARTIAL_ATTENDANCE', checkInAt: now }];
    expect((await getPublicEventParticipation(event, now)).attended).toBe(2);
  });
  it('labels imported and mixed evidence honestly', async () => {
    state.registrations = [{ status: 'COMPLETED', externalAttendance: [{ day: 'a' }], attendanceEvidence: 'ORGANIZER_IMPORT' }];
    expect((await getPublicEventParticipation(event, now)).evidence).toBe('ORGANIZER_IMPORT');
    state.registrations.push({ status: 'COMPLETED', checkInAt: now });
    expect((await getPublicEventParticipation(event, now)).evidence).toBe('MIXED');
  });
  it('returns aggregates without attendee identities', async () => {
    state.registrations = [{ status: 'COMPLETED', checkInAt: now, name: 'Private Name', email: 'private@example.edu' }];
    expect(Object.keys(await getPublicEventParticipation(event, now)).sort()).toEqual(['attended','evidence','finalized','registered']);
  });
});
