/** Public schedule labels do not open check-in, close registration, or grant attendance. */
export type EventSchedule = {
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  cancellationReason?: string | null;
  attendanceFinalizedAt?: string | null;
};
export type EventLifecycle = 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED' | 'POSTPONED' | 'ANNOUNCED' | 'DRAFT';
const time = (value?: string | null) => value ? new Date(value).getTime() : NaN;
export function eventLifecycle(event: EventSchedule, now = Date.now()): EventLifecycle {
  if (event.status === 'ARCHIVED' && event.cancellationReason) return 'CANCELLED';
  if (event.status === 'POSTPONED') return 'POSTPONED';
  if (event.status === 'DRAFT') return 'DRAFT';
  if (event.status === 'ANNOUNCED') return 'ANNOUNCED';
  if (event.status === 'COMPLETED' || event.status === 'ARCHIVED') return 'ENDED';
  const end = time(event.endDate);
  if (Number.isFinite(end) && now >= end) return 'ENDED';
  const start = time(event.startDate);
  if (Number.isFinite(start)) return now >= start ? 'LIVE' : 'UPCOMING';
  return event.status === 'CHECK_IN' || event.status === 'CHECK_OUT' ? 'LIVE' : 'UPCOMING';
}
export function attendancePending(event: EventSchedule) {
  return !event.attendanceFinalizedAt && event.status !== 'COMPLETED' && event.status !== 'ARCHIVED';
}
/** Registration follows organizer controls; schedule labels never grant or revoke a place. */
export function registrationAvailable(event: EventSchedule & { registrationClosed?: boolean; registrationDeadline?: string | null }, now = Date.now()) {
  return ['PUBLISHED', 'CHECK_IN'].includes(event.status) && !event.registrationClosed
    && (!Number.isFinite(time(event.registrationDeadline)) || now <= time(event.registrationDeadline));
}
