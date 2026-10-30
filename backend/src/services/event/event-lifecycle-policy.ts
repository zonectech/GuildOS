type EventState = { status: string; attendanceSource?: string; endDate?: Date | null; qrEnabled?: boolean };
export function assertEventFinalizable(event: EventState, now = Date.now()) {
  if (!['PUBLISHED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED'].includes(event.status)) throw new Error('Only a published event can have attendance finalized');
  if (!event.endDate || event.endDate.getTime() > now) throw new Error('Wait until the event ends before finalizing attendance');
}
export function assertAttendanceTransition(event: EventState, next: string, now = Date.now()) {
  if (!['CHECK_IN', 'CHECK_OUT'].includes(next)) throw new Error('Use the dedicated publish or finalize action');
  if (event.attendanceSource === 'EXTERNAL') throw new Error('Attendance is recorded on the external platform');
  if (!event.qrEnabled) throw new Error('Enable GuildOS check-in before opening attendance');
  if (!['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'].includes(event.status)) throw new Error('Only a published event can open attendance');
  if (next === 'CHECK_OUT' && !['CHECK_IN', 'CHECK_OUT'].includes(event.status)) throw new Error('Open check-in before check-out');
  if (next === 'CHECK_IN' && event.endDate && event.endDate.getTime() <= now) throw new Error('The event has ended. Finalize attendance instead');
}

/** Single-day events are stay-to-the-end, so check-out only opens at the end time. Multi-day check-outs stay per day. */
export function assertCheckOutOpen(event: { endDate?: Date | null }, multiDay: boolean, now = Date.now()) {
  if (multiDay || !event.endDate) return;
  if (new Date(event.endDate).getTime() > now) throw new Error('Check-out opens at the event end time. If the event finished early, the organizer can use End event now');
}
/** End-time changes on a running event. The schedule lock stops ordinary edits once attendance is recorded. */
export function assertEventEndAdjustable(event: EventState, multiDay: boolean) {
  if (event.attendanceSource === 'EXTERNAL') throw new Error('Attendance is recorded on the external platform');
  if (multiDay) throw new Error('Multi-day events follow their day schedule');
  if (!['CHECK_IN', 'CHECK_OUT'].includes(event.status)) throw new Error('Open check-in before changing the end time');
}

type RecordedDay = { day:string; checkInAt?:Date|null; checkOutAt?:Date|null; minutes?:number };
export function recordedMultiDayAttendance(registration:{attendanceDays?:RecordedDay[];checkInAt?:Date|null;checkOutAt?:Date|null}) {
  const days = (registration.attendanceDays ?? []).map(day => ({day:day.day,checkInAt:day.checkInAt ?? null,checkOutAt:day.checkOutAt ?? null,minutes:day.checkInAt && day.checkOutAt ? Math.max(0,Math.round((new Date(day.checkOutAt).getTime()-new Date(day.checkInAt).getTime())/60000)) : 0}));
  const valid = days.filter(day => day.checkInAt && day.checkOutAt && new Date(day.checkOutAt) >= new Date(day.checkInAt));
  const legacyPair = !days.length && registration.checkInAt && registration.checkOutAt && registration.checkOutAt >= registration.checkInAt;
  return {days,minutes:days.length ? valid.reduce((sum,day)=>sum+day.minutes,0) : legacyPair ? Math.round((registration.checkOutAt!.getTime()-registration.checkInAt!.getTime())/60000) : 0,completedDays:legacyPair ? 1 : new Set(valid.map(day=>day.day)).size};
}
