import { EventRegistrationModel } from '../../models/event-registration.model';

const REGISTERED = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE', 'NO_SHOW'];
const ATTENDED = ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'];
type EventLike = { _id: unknown; attendanceFinalizedAt?: Date | null; attendanceSource?: string; endDate?: Date | null; status?: string };

/** Aggregate totals only. Call after the event's existing visibility/authorization checks. */
export async function getPublicEventParticipation(event: EventLike, now = new Date()) {
  const registered = await EventRegistrationModel.countDocuments({ eventId: event._id, status: { $in: REGISTERED } });
  const finalized = Boolean(event.attendanceFinalizedAt && (!event.endDate || new Date(event.endDate).getTime() <= now.getTime()));
  if (!finalized) return { registered, attended: null, finalized: false, evidence: null };
  const filter = { eventId: event._id, status: { $in: ATTENDED }, $or: [{ checkInAt: { $ne: null } }, { 'externalAttendance.0': { $exists: true } }] };
  const [attended, imported] = await Promise.all([
    EventRegistrationModel.countDocuments(filter),
    EventRegistrationModel.countDocuments({ ...filter, attendanceEvidence: 'ORGANIZER_IMPORT' }),
  ]);
  const evidence = imported > 0 && imported < attended ? 'MIXED' : imported > 0 || event.attendanceSource === 'EXTERNAL' ? 'ORGANIZER_IMPORT' : 'GUILDOS';
  return { registered, attended, finalized: true, evidence: evidence as 'GUILDOS' | 'ORGANIZER_IMPORT' | 'MIXED' };
}
