import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fixing a missing check-out by hand: needs a reason, follows the normal check-out rule, and is audited.
const shared = vi.hoisted(() => ({ requireEventManager: vi.fn(), recalcEventCounters: vi.fn(async () => undefined) }));
vi.mock('./event-shared', async (original) => ({ ...(await original<any>()), ...shared }));
vi.mock('../../models/event-registration.model', async (original) => {
  const actual = await original<any>();
  return { ...actual, EventRegistrationModel: { ...actual.EventRegistrationModel, findById: vi.fn() } };
});
vi.mock('../../models/attendance-correction.model', () => ({ AttendanceCorrectionModel: { create: vi.fn(async () => undefined), find: vi.fn() } }));
import { EventRegistrationModel } from '../../models/event-registration.model';
import { AttendanceCorrectionModel } from '../../models/attendance-correction.model';
import { correctMissingCheckOut } from './event-attendance.service';

const H = 3600_000;
const end = new Date(Date.now() - 2 * H);
const start = new Date(end.getTime() - 3 * H);
const event = (over: Record<string, unknown> = {}) => ({ _id: 'e1', startDate: start, endDate: end, days: [], attendanceSource: 'GUILDOS', minimumAttendanceDuration: 0, timezone: 'Africa/Lagos', ...over });
const reg = (over: Record<string, unknown> = {}) => ({
  _id: 'r1', eventId: { toString: () => 'e1' }, status: 'CHECKED_IN', checkInAt: new Date(start.getTime() + 10 * 60000), checkOutAt: null,
  attendanceMinutes: 0, certificateEligible: false, save: vi.fn(async () => undefined), ...over,
});
const reason = 'Scanner battery died at the door; left with everyone at the end.';

beforeEach(() => { vi.clearAllMocks(); shared.requireEventManager.mockResolvedValue(event()); });

describe('correcting a missing check-out', () => {
  it('stayed to the end: completes, becomes eligible, and records the audit trail', async () => {
    const r = reg();
    vi.mocked(EventRegistrationModel.findById).mockResolvedValue(r as never);
    const out = await correctMissingCheckOut('e1', 'r1', 'admin', { checkOutAt: end.toISOString(), reason });
    expect(out.completed).toBe(true);
    expect(r.status).toBe('COMPLETED');
    expect(r.certificateEligible).toBe(true);
    expect(r.attendanceMinutes).toBe(170);
    expect(AttendanceCorrectionModel.create).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'MANUAL', actorId: 'admin', reason, previousStatus: 'CHECKED_IN', status: 'COMPLETED',
      beforeTimes: expect.objectContaining({ checkOutAt: null }), afterTimes: expect.objectContaining({ checkOutAt: end }),
    }));
  });
  it('left early: stays incomplete and not eligible (same rule as a scan)', async () => {
    const r = reg({ status: 'PARTIAL_ATTENDANCE' });
    vi.mocked(EventRegistrationModel.findById).mockResolvedValue(r as never);
    await correctMissingCheckOut('e1', 'r1', 'admin', { checkOutAt: new Date(end.getTime() - H).toISOString(), reason });
    expect(r.status).toBe('PARTIAL_ATTENDANCE');
    expect(r.certificateEligible).toBe(false);
  });
  it('needs a real reason', async () => {
    vi.mocked(EventRegistrationModel.findById).mockResolvedValue(reg() as never);
    await expect(correctMissingCheckOut('e1', 'r1', 'admin', { checkOutAt: end.toISOString(), reason: 'fix' })).rejects.toThrow(/reason/);
  });
  it('refuses impossible times', async () => {
    vi.mocked(EventRegistrationModel.findById).mockResolvedValue(reg() as never);
    await expect(correctMissingCheckOut('e1', 'r1', 'admin', { checkOutAt: start.toISOString(), reason })).rejects.toThrow(/after they checked in/);
    await expect(correctMissingCheckOut('e1', 'r1', 'admin', { checkOutAt: new Date(Date.now() + H).toISOString(), reason })).rejects.toThrow(/future/);
  });
  it('only for someone who checked in and has no check-out', async () => {
    vi.mocked(EventRegistrationModel.findById).mockResolvedValue(reg({ checkInAt: null }) as never);
    await expect(correctMissingCheckOut('e1', 'r1', 'admin', { checkOutAt: end.toISOString(), reason })).rejects.toThrow(/never checked in/);
    vi.mocked(EventRegistrationModel.findById).mockResolvedValue(reg({ checkOutAt: end }) as never);
    await expect(correctMissingCheckOut('e1', 'r1', 'admin', { checkOutAt: end.toISOString(), reason })).rejects.toThrow(/already has a check-out/);
    expect(AttendanceCorrectionModel.create).not.toHaveBeenCalled();
  });
  it('not for external events', async () => {
    shared.requireEventManager.mockResolvedValue(event({ attendanceSource: 'EXTERNAL' }));
    await expect(correctMissingCheckOut('e1', 'r1', 'admin', { checkOutAt: end.toISOString(), reason })).rejects.toThrow(/external report/);
  });
});
