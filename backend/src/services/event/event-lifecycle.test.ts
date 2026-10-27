import { describe, expect, it } from 'vitest';
import { eventLifecycle, attendancePending, registrationAvailable } from '../../../../frontend/components/guildos/events/event-lifecycle';
import { bucketOf } from '../../../../frontend/app/events/_components/event-discovery';
const start = Date.parse('2026-10-27T09:00:00+01:00');
const end = Date.parse('2026-10-27T11:00:00+01:00');
const event = { status: 'PUBLISHED', startDate: new Date(start).toISOString(), endDate: new Date(end).toISOString() };
describe('public event schedule and separate registration controls', () => {
  it('changes at the exact scheduled start and end without opening check-in', () => {
    expect(eventLifecycle(event, start - 1)).toBe('UPCOMING');
    expect(eventLifecycle(event, start)).toBe('LIVE');
    expect(eventLifecycle(event, end - 1)).toBe('LIVE');
    expect(eventLifecycle(event, end)).toBe('ENDED');
    expect(event.status).toBe('PUBLISHED');
    expect(bucketOf(event as any, start)).toBe('LIVE');
    expect(bucketOf({ ...event, status: 'CHECK_IN' } as any, end)).toBe('ENDED');
  });
  it('honors cancellation, postponement, drafts and announcements despite old dates', () => {
    for (const [status, expected] of [['POSTPONED','POSTPONED'], ['DRAFT','DRAFT'], ['ANNOUNCED','ANNOUNCED']]) expect(eventLifecycle({ ...event, status }, end + 1)).toBe(expected);
    expect(eventLifecycle({ ...event, status: 'ARCHIVED', cancellationReason: 'Cancelled' }, start)).toBe('CANCELLED');
  });
  it('uses a changed schedule and never treats early check-in as a scheduled start', () => {
    expect(eventLifecycle({ ...event, startDate: new Date(end + 1000).toISOString(), endDate: new Date(end + 2000).toISOString() }, start)).toBe('UPCOMING');
    expect(eventLifecycle({ ...event, status: 'CHECK_IN' }, start - 1)).toBe('UPCOMING');
  });
  it('does not infer live status from missing or invalid dates', () => {
    expect(eventLifecycle({ status: 'PUBLISHED', startDate: 'bad', endDate: null }, start)).toBe('UPCOMING');
    expect(eventLifecycle({ status: 'CHECK_IN' }, start)).toBe('LIVE');
  });
  it('keeps ended attendance pending until finalization', () => {
    expect(attendancePending(event)).toBe(true);
    expect(attendancePending({ ...event, attendanceFinalizedAt: new Date(end).toISOString() })).toBe(false);
    expect(attendancePending({ ...event, status: 'COMPLETED' })).toBe(false);
  });
  it('allows late registration while enforcing manual closure and the configured deadline', () => {
    expect(registrationAvailable(event, start + 1000)).toBe(true);
    expect(registrationAvailable({ ...event, registrationClosed: true }, start)).toBe(false);
    expect(registrationAvailable({ ...event, registrationDeadline: new Date(start - 1).toISOString() }, start)).toBe(false);
    expect(registrationAvailable({ ...event, registrationDeadline: new Date(start).toISOString() }, start)).toBe(true);
    expect(registrationAvailable({ ...event, status: 'POSTPONED' }, start)).toBe(false);
    expect(registrationAvailable({ ...event, status: 'COMPLETED' }, end)).toBe(false);
  });
});
