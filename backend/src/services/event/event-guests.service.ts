import { EventModel } from '../../models/event.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { UserModel } from '../../models/user.model';
import { hasApprovedCommunityAccess } from '../community-access-policy';
import { findEventMemberships, membershipWith } from './event-shared';

/** Registered (going) statuses, and the ones that count once attendance is finalized. */
const GOING = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'];
const LIMIT = 300;
const norm = (s?: string | null) => (s ?? '').trim().toLowerCase().replace(/[,.]/g, '').replace(/\s+/g, ' ');

export interface Guest {
  id: string; name: string; username: string; avatar: string; school: string; department: string; level: string;
  checkedIn: boolean; attended: boolean; isYou: boolean;
  /** Only ever true for the event's hosts: this person is not shown to other students. */
  hidden?: boolean;
}

/**
 * Who is going to an event (or, once attendance is finalized, who attended).
 *
 * Who gets what:
 * - Signed-out visitors: the counts only. Nobody is named.
 * - Students: everyone who chose to be listed, people from their own department who chose
 *   "department only", and themselves. Hidden people and private profiles are counted, never named.
 * - The event's hosts (community leaders with event access): everyone, with `hidden` marking the
 *   people other students cannot see. The hosts' own "hide the guest list" switch does not hide it from them.
 */
export async function listEventGuests(eventId: string, viewerId?: string | null) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null, visibility: { $ne: 'PRIVATE' } })
    .select('guestListVisible attendanceFinalizedAt attendanceSource status communityId').lean();
  if (!event) throw new Error('Event not found');
  const finalized = Boolean(event.attendanceFinalizedAt);
  const statuses = finalized ? ['COMPLETED'] : GOING;
  const [count, checkedIn] = await Promise.all([
    EventRegistrationModel.countDocuments({ eventId, status: { $in: statuses } }),
    EventRegistrationModel.countDocuments({ eventId, checkInAt: { $ne: null }, status: { $in: GOING } }),
  ]);
  const listVisible = !(event.guestListVisible === false || event.attendanceSource === 'EXTERNAL');
  if (!viewerId) return { count, checkedIn, finalized, listVisible, guests: [] as Guest[], more: 0 };

  const isHost = Boolean(membershipWith(await findEventMemberships(event, viewerId).catch(() => []), 'COORDINATOR') && await hasApprovedCommunityAccess(viewerId));
  if (!listVisible && !isHost) return { count, checkedIn, finalized, listVisible: false, guests: [] as Guest[], more: 0 };

  const regs = await EventRegistrationModel.find({ eventId, status: { $in: statuses } })
    .select('userId status checkInAt registeredAt').sort({ registeredAt: 1 }).limit(LIMIT).lean();
  const users = await UserModel.find({ _id: { $in: regs.map((r) => r.userId) }, status: 'ACTIVE', deletedAt: null })
    .select('fullName guestVisibility profile.username profile.avatar profile.university profile.department profile.level profile.profileVisibility').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const viewer = await UserModel.findById(viewerId).select('profile.university profile.department').lean();
  const sameDept = (u: { profile?: { university?: string; department?: string } }) =>
    Boolean(viewer && norm(u.profile?.department) && norm(u.profile?.department) === norm(viewer.profile?.department) && norm(u.profile?.university) === norm(viewer.profile?.university));

  const guests: Guest[] = [];
  for (const r of regs) {
    const id = String(r.userId);
    const u = byId.get(id);
    if (!u) continue;
    const isYou = id === String(viewerId);
    const choice = u.guestVisibility ?? 'VISIBLE';
    // What every signed-in student may see, and what only this viewer may see on top of that.
    const publicly = u.profile?.profileVisibility !== 'PRIVATE' && choice === 'VISIBLE';
    const listed = isYou || publicly || (u.profile?.profileVisibility !== 'PRIVATE' && choice === 'DEPARTMENT_ONLY' && sameDept(u));
    if (!listed && !isHost) continue;
    guests.push({
      id, name: u.fullName, username: u.profile?.username ?? '', avatar: u.profile?.avatar ?? '', school: u.profile?.university ?? '',
      department: u.profile?.department ?? '', level: u.profile?.level ?? '', checkedIn: Boolean(r.checkInAt), attended: r.status === 'COMPLETED', isYou,
      ...(isHost && !publicly ? { hidden: true } : {}),
    });
  }
  return { count, checkedIn, finalized, listVisible, guests, more: Math.max(0, count - regs.length) };
}
