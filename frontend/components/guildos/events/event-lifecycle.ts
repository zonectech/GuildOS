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

/** Calendar labels use the event timezone and show the full span of multi-day events. */
export function eventDateLabel(event: EventSchedule & {timezone?:string|null}) {
 const start=event.startDate?new Date(event.startDate):null;
 if(!start || !Number.isFinite(start.getTime()))return 'Date TBA';
 const end=event.endDate?new Date(event.endDate):null;
 let zone=event.timezone||undefined;
 try{new Intl.DateTimeFormat('en-NG',{timeZone:zone}).format(start);}catch{zone=undefined;}
 const format=(date:Date)=>date.toLocaleDateString('en-NG',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:zone});
 const day=(date:Date)=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:zone}).format(date);
 return end && Number.isFinite(end.getTime()) && day(start)!==day(end) ? 'Starts from '+format(start)+' · Ends '+format(end) : format(start);
}
