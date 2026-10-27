import { EventPersonHostModel } from '../models/event-person-host.model';
import { EventModel } from '../models/event.model';
import { UserModel } from '../models/user.model';
import { requireEventManager } from './event/event-shared';
import { createNotification } from './notification.service';
import { isBlockedBetween } from './user-safety.service';

const publicQuery = { status: 'ACTIVE', deletedAt: null, 'profile.profileVisibility': 'PUBLIC', 'profile.username': { $ne: '' } };
export function publicHostPerson(user: any) {
  if (!user || user.status !== 'ACTIVE' || user.deletedAt || user.profile?.profileVisibility !== 'PUBLIC' || !user.profile?.username) return null;
  return { id: String(user._id), name: user.fullName, username: user.profile.username, avatar: user.profile.avatar || '' };
}

/** Person credits never grant event-management or community access. */
export async function invitePersonHost(eventId: string, actorId: string, username: string) {
  const event = await requireEventManager(eventId, actorId);
  const normalized = String(username || '').trim().toLowerCase().replace(/^@/, '');
  if (!/^[a-z0-9_.-]{1,60}$/.test(normalized)) throw new Error('Enter a valid GuildOS username');
  if (event.cancellationReason || event.status === 'ARCHIVED') throw new Error('This event is no longer accepting co-hosts');
  const user = await UserModel.findOne({ ...publicQuery, 'profile.username': normalized }).select('_id fullName').lean();
  if (!user || await isBlockedBetween(actorId, String(user._id))) throw new Error('Public profile not found');
  if (String(user._id) === String(event.createdBy)) throw new Error('That person is already the organizer');
  const existing = await EventPersonHostModel.findOne({ eventId, userId: user._id });
  if (existing && existing.status !== 'DECLINED') throw new Error('That person already has a co-host invitation');
  if (await EventPersonHostModel.countDocuments({ eventId, status: { $in: ['PENDING', 'ACCEPTED'] } }) >= 20) throw new Error('An event can have up to 20 personal co-host invitations');
  let invite;
  if (existing) { existing.status = 'PENDING'; existing.invitedBy = actorId as any; existing.respondedAt = null; invite = await existing.save(); }
  else {
    try { invite = await EventPersonHostModel.create({ eventId, userId: user._id, invitedBy: actorId }); }
    catch (error: any) { if (error?.code === 11000) throw new Error('That person already has a co-host invitation'); throw error; }
  }
  await createNotification({ userId: String(user._id), actorId, type: 'SYSTEM', title: 'Co-host invitation', body: 'You have been invited to co-host an event. Open it to accept or decline.', link: '/events/' + encodeURIComponent(event.slug) });
  return { id: String(invite._id), status: invite.status };
}

export async function listPersonHosts(eventId: string, actorId: string) {
  await requireEventManager(eventId, actorId);
  const invites = await EventPersonHostModel.find({ eventId }).sort({ createdAt: 1 }).lean();
  const users = await UserModel.find({ _id: { $in: invites.map(i => i.userId) } }).select('_id fullName profile.username profile.avatar profile.profileVisibility status deletedAt').lean();
  const byId = new Map(users.map(u => [String(u._id), u]));
  return invites.map(i => ({ id: String(i._id), status: i.status, person: publicHostPerson(byId.get(String(i.userId))) }));
}

export async function respondPersonHost(eventId: string, inviteId: string, actorId: string, accept: boolean) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null }).select('cancellationReason status').lean();
  if (!event) throw new Error('Event not found');
  if (accept && (event.cancellationReason || event.status === 'ARCHIVED')) throw new Error('This event is no longer accepting co-hosts');
  const invite = await EventPersonHostModel.findOneAndUpdate({ _id: inviteId, eventId, userId: actorId, status: 'PENDING' }, { $set: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() } }, { new: true });
  if (!invite) throw new Error('Pending invitation not found');
  return { id: String(invite._id), status: invite.status };
}

export async function removePersonHost(eventId: string, inviteId: string, actorId: string) {
  const invite = await EventPersonHostModel.findOne({ _id: inviteId, eventId });
  if (!invite) throw new Error('Invitation not found');
  if (String(invite.userId) !== actorId) await requireEventManager(eventId, actorId);
  await invite.deleteOne();
  return { removed: true };
}

export async function publicEventHosts(event: { _id: unknown; createdBy: unknown }, viewerId?: string) {
  const invites = await EventPersonHostModel.find({ eventId: event._id, status: { $in: ['ACCEPTED', 'PENDING'] } }).lean();
  const users = await UserModel.find({ _id: { $in: [event.createdBy, ...invites.filter(i => i.status === 'ACCEPTED').map(i => i.userId)] }, ...publicQuery }).select('_id fullName profile.username profile.avatar profile.profileVisibility status deletedAt').lean();
  const byId = new Map(users.map(u => [String(u._id), u]));
  const pending = viewerId ? invites.find(i => i.status === 'PENDING' && String(i.userId) === viewerId) : null;
  const own = viewerId ? invites.find(i => i.status === 'ACCEPTED' && String(i.userId) === viewerId) : null;
  return { organizer: publicHostPerson(byId.get(String(event.createdBy))), personCoHosts: invites.filter(i => i.status === 'ACCEPTED').map(i => publicHostPerson(byId.get(String(i.userId)))).filter((p): p is NonNullable<typeof p> => Boolean(p)), viewerPersonHostInvite: pending ? { id: String(pending._id) } : null, viewerPersonHostCredit: own ? { id: String(own._id) } : null };
}
