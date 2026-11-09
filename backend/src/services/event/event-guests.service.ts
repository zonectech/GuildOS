import { EventModel } from '../../models/event.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { UserModel } from '../../models/user.model';

/** Registered (going) statuses, and the ones that count once attendance is finalized. */
const GOING = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'];
const LIMIT = 300;
const norm = (s?: string | null) => (s ?? '').trim().toLowerCase().replace(/[,.]/g, '').replace(/\s+/g, ' ');

export interface Guest {
  id: string; name: string; username: string; avatar: string; school: string; department: string; level: string;
  checkedIn: boolean; attended: boolean; isYou: boolean;
}

/**
 * Who is going to an event (or, once attendance is finalized, who attended).
 * Rules: the organizer can switch the list off; each student chooses to be listed for everyone,
 * for their department only, or not at all (hidden people are still counted, never named);
 * private profiles are never listed. You always see yourself.
 */
export async function listEventGuests(eventId: string, viewerId?: string | null) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null, visibility: { $ne: 'PRIVATE' } })
    .select('guestListVisible attendanceFinalizedAt attendanceSource status').lean();
  if (!event) throw new Error('Event not found');
  const finalized = Boolean(event.attendanceFinalizedAt);
  const statuses = finalized ? ['COMPLETED'] : GOING;
  const [count, checkedIn] = await Promise.all([
    EventRegistrationModel.countDocuments({ eventId, status: { $in: statuses } }),
    EventRegistrationModel.countDocuments({ eventId, checkInAt: { $ne: null }, status: { $in: GOING } }),
  ]);
  if (event.guestListVisible === false || event.attendanceSource === 'EXTERNAL') {
    return { count, checkedIn, finalized, listVisible: false, guests: [] as Guest[], more: 0 };
  }

  const regs = await EventRegistrationModel.find({ eventId, status: { $in: statuses } })
    .select('userId status checkInAt registeredAt').sort({ registeredAt: 1 }).limit(LIMIT).lean();
  const users = await UserModel.find({ _id: { $in: regs.map((r) => r.userId) }, status: 'ACTIVE', deletedAt: null })
    .select('fullName guestVisibility profile.username profile.avatar profile.university profile.department profile.level profile.profileVisibility').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const viewer = viewerId ? await UserModel.findById(viewerId).select('profile.university profile.department').lean() : null;
  const sameDept = (u: { profile?: { university?: string; department?: string } }) =>
    Boolean(viewer && norm(u.profile?.department) && norm(u.profile?.department) === norm(viewer.profile?.department) && norm(u.profile?.university) === norm(viewer.profile?.university));

  const guests: Guest[] = [];
  for (const r of regs) {
    const id = String(r.userId);
    const u = byId.get(id);
    if (!u) continue;
    const isYou = Boolean(viewerId && id === String(viewerId));
    const choice = u.guestVisibility ?? 'VISIBLE';
    const listed = isYou || (u.profile?.profileVisibility !== 'PRIVATE' && (choice === 'VISIBLE' || (choice === 'DEPARTMENT_ONLY' && sameDept(u))));
    if (!listed) continue;
    guests.push({
      id, name: u.fullName, username: u.profile?.username ?? '', avatar: u.profile?.avatar ?? '', school: u.profile?.university ?? '',
      department: u.profile?.department ?? '', level: u.profile?.level ?? '', checkedIn: Boolean(r.checkInAt), attended: r.status === 'COMPLETED', isYou,
    });
  }
  return { count, checkedIn, finalized, listVisible: true, guests, more: Math.max(0, count - regs.length) };
}
