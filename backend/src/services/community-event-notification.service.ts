import { EventModel } from '../models/event.model';
import { CommunityModel } from '../models/community.model';
import { MembershipModel } from '../models/membership.model';
import { EventBookmarkModel } from '../models/event-bookmark.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { UserModel } from '../models/user.model';
import { createNotification } from './notification.service';
import { sendEmail, categoryEmail } from '../utils/email';
import { config } from '../config';

/** First publication only. Never announces private/unlisted/invite-only events. */
export async function notifyCommunityNewEvent(eventId: string, options: { excludeAnticipated?: boolean } = {}) {
  const candidate = await EventModel.findOne({ _id: eventId, status: 'PUBLISHED', visibility: 'PUBLIC', registrationPolicy: { $ne: 'INVITE' }, deletedAt: null }).lean();
  if (!candidate || (candidate.endDate && candidate.endDate.getTime() <= Date.now())) return;
  const community = await CommunityModel.findOne({ _id: candidate.communityId, verificationStatus: 'VERIFIED', visibility: 'PUBLIC', adminSuspended: { $ne: true }, archivedAt: null }).lean();
  if (!community) return;
  // Atomic persisted claim prevents duplicate publication requests from sending twice.
  const event = await EventModel.findOneAndUpdate({ _id: candidate._id, status: 'PUBLISHED', visibility: 'PUBLIC', registrationPolicy: { $ne: 'INVITE' }, deletedAt: null, communityEventNotifiedAt: null }, { $set: { communityEventNotifiedAt: new Date() } }, { new: true }).lean();
  if (!event) return;
  const [memberships, previousEvents] = await Promise.all([
    MembershipModel.find({ communityId: community._id }).select('userId status').lean(),
    EventModel.find({ communityId: community._id, _id: { $ne: event._id }, endDate: { $lt: new Date() }, deletedAt: null, cancellationReason: { $in: ['', null] } }).select('_id').lean(),
  ]);
  const attendees = previousEvents.length ? await EventRegistrationModel.distinct('userId', {
    eventId: { $in: previousEvents.map(item => item._id) },
    status: { $in: ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] },
    $or: [{ checkInAt: { $ne: null } }, { 'attendanceDays.checkInAt': { $ne: null } }, { 'externalAttendance.0': { $exists: true } }],
  }) : [];
  const anticipated = options.excludeAnticipated ? await EventBookmarkModel.find({ eventId: event._id }).select('userId').lean() : [];
  const excluded = new Set(memberships.filter(item => item.status === 'SUSPENDED' || item.status === 'REMOVED').map(item => String(item.userId)).concat(anticipated.map(item => String(item.userId))));
  const ids = [...new Set([...memberships.filter(item => item.status === 'ACTIVE').map(item => String(item.userId)), ...attendees.map(String)])].filter(id => id !== String(event.createdBy) && !excluded.has(id));
  const users = await UserModel.find({ _id: { $in: ids }, status: 'ACTIVE', deletedAt: null }).select('_id fullName email emailVerified newEventEmailEnabled').lean();
  const title = community.name + ' has a new event';
  const link = '/events/' + encodeURIComponent(event.slug);
  for (const user of users) {
    await createNotification({ userId: String(user._id), actorId: String(event.createdBy), type: 'SYSTEM', title, body: event.title, link });
    if (user.newEventEmailEnabled === false || !user.emailVerified || /@(.*\.local|example\.(com|org)|test\.local)$/i.test(user.email)) continue;
    await sendEmail(user.email, categoryEmail('INFO', { name: user.fullName, subject: title + ': ' + event.title, heading: title, message: event.title + '\n\nYou are receiving this because you belong to this community or attended one of its events.', ctaLabel: 'View event', ctaUrl: config.frontendUrl + link, note: 'Manage new-event emails at ' + config.frontendUrl + '/notifications' })).catch(() => undefined);
  }
}
