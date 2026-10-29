import { EventModel } from '../models/event.model';
import { CommunityModel } from '../models/community.model';
import { MembershipModel } from '../models/membership.model';
import { EventBookmarkModel } from '../models/event-bookmark.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { UserModel } from '../models/user.model';
import { EventAlertDeliveryModel } from '../models/event-alert-delivery.model';
import { deliverQueuedCommunityEventAlerts } from './community-event-alert-worker';

/** Queue once per recipient/channel. The event stamp means fully queued, not delivered. */
export async function notifyCommunityNewEvent(eventId: string, options: { excludeAnticipated?: boolean } = {}) {
  const event = await EventModel.findOne({ _id: eventId, status: 'PUBLISHED', visibility: 'PUBLIC', registrationPolicy: { $ne: 'INVITE' }, deletedAt: null, communityEventNotifiedAt: null }).lean();
  if (!event || (event.endDate && event.endDate.getTime() <= Date.now())) {
    await EventModel.updateOne({_id:eventId},{$set:{communityEventAlertPending:false}}); return;
  }
  const community = await CommunityModel.findOne({ _id: event.communityId, verificationStatus: 'VERIFIED', visibility: 'PUBLIC', adminSuspended: { $ne: true }, archivedAt: null }).lean();
  if (!community) { await EventModel.updateOne({_id:eventId},{$set:{communityEventAlertPending:false}}); return; }
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
  const attendeeIds = new Set(attendees.map(String));
  const ids = [...new Set([...memberships.filter(item => item.status === 'ACTIVE').map(item => String(item.userId)), ...attendees.map(String)])].filter(id => id !== String(event.createdBy) && !excluded.has(id));
  const users = await UserModel.find({ _id: { $in: ids }, status: 'ACTIVE', deletedAt: null }).select('_id fullName email emailVerified newEventEmailEnabled').lean();

  await EventAlertDeliveryModel.init();
  for (const user of users) {
    const channels = ['NOTIFICATION', 'EMAIL'] as const;
    for (const channel of channels) {
      // Email opt-outs are checked again at delivery, including after a retry.
      if (channel === 'EMAIL' && (user.newEventEmailEnabled === false || !user.emailVerified || /@(.*\.local|example\.(com|org)|test\.local)$/i.test(user.email))) continue;
      await EventAlertDeliveryModel.updateOne({eventId:event._id,userId:user._id,channel},{$setOnInsert:{eventId:event._id,userId:user._id,channel,priorAttendee:attendeeIds.has(String(user._id)),status:'PENDING',attempts:0,nextAttemptAt:new Date()}},{upsert:true});
    }
  }
  await EventModel.updateOne({_id:event._id,communityEventNotifiedAt:null},{$set:{communityEventNotifiedAt:new Date(),communityEventAlertPending:false}});
}
let running = false;
export async function processCommunityEventAlerts() {
  if (running) return;
  running = true;
  try {
    // Only explicit publication intents are recovered: never backfill old published events.
    const pending = await EventModel.find({communityEventAlertPending:true,communityEventNotifiedAt:null}).sort({_id:1}).limit(10).select('_id communityEventAlertExcludeAnticipated').lean();
    for (const event of pending) {
      try { await notifyCommunityNewEvent(String(event._id),{excludeAnticipated:event.communityEventAlertExcludeAnticipated}); }
      catch { console.warn('[GuildOS] event alert queue will retry'); }
    }
    await deliverQueuedCommunityEventAlerts();
  } finally { running = false; }
}
