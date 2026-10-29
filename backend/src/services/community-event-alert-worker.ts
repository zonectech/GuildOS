import { randomUUID } from 'node:crypto';
import { EventAlertDeliveryModel, type EventAlertDelivery } from '../models/event-alert-delivery.model';
import { EventModel } from '../models/event.model';
import { CommunityModel } from '../models/community.model';
import { MembershipModel } from '../models/membership.model';
import { UserModel } from '../models/user.model';
import { createNotification } from './notification.service';
import { sendEmail, categoryEmail } from '../utils/email';
import { config } from '../config';
export const ALERT_LEASE_MS = 15 * 60_000;
export function alertRetryDelay(attempt: number) { return Math.min(6 * 3600_000, 60_000 * 2 ** Math.min(Math.max(0, attempt - 1), 10)); }
export async function deliverCommunityEventAlert(job: EventAlertDelivery & {_id:unknown}, leaseToken: string) {
  const owned = {_id:job._id,status:'PROCESSING',leaseToken};
  try {
    const [event,user] = await Promise.all([
      EventModel.findOne({_id:job.eventId,deletedAt:null,visibility:'PUBLIC',registrationPolicy:{$ne:'INVITE'},status:{$in:['PUBLISHED','CHECK_IN','CHECK_OUT']}}).lean(),
      UserModel.findOne({_id:job.userId,status:'ACTIVE',deletedAt:null}).select('_id fullName email emailVerified newEventEmailEnabled').lean(),
    ]);
    const community = event ? await CommunityModel.findOne({_id:event.communityId,verificationStatus:'VERIFIED',visibility:'PUBLIC',adminSuspended:{$ne:true},archivedAt:null}).lean() : null;
    const membership = event ? await MembershipModel.findOne({communityId:event.communityId,userId:job.userId}).select('status').lean() : null;
    const skip = !event || !user || !community || String(event.createdBy) === String(job.userId) || (event.endDate && event.endDate.getTime() <= Date.now()) || ['SUSPENDED','REMOVED'].includes(membership?.status ?? '') || (membership?.status !== 'ACTIVE' && !job.priorAttendee);
    const skipEmail = job.channel === 'EMAIL' && (!user?.emailVerified || user.newEventEmailEnabled === false || /@(.*\.local|example\.(com|org)|test\.local)$/i.test(user.email));
    if (skip || skipEmail) {
      await EventAlertDeliveryModel.updateOne(owned,{$set:{status:'SKIPPED',leaseUntil:null,leaseToken:'',lastError:''}}); return;
    }
    const title = community!.name + ' has a new event';
    const link = '/events/' + encodeURIComponent(event!.slug);
    const key = 'community-event:' + String(job.eventId) + ':' + String(job.userId);
    if (job.channel === 'NOTIFICATION') {
      await createNotification({userId:String(job.userId),actorId:String(event!.createdBy),type:'SYSTEM',title,body:event!.title,link,deliveryKey:key});
    } else {
      await sendEmail(user!.email,categoryEmail('INFO',{name:user!.fullName,subject:title+': '+event!.title,heading:title,message:event!.title+'\n\nYou are receiving this because you belong to this community or attended one of its events.',ctaLabel:'View event',ctaUrl:config.frontendUrl+link,note:'Manage new-event emails at '+config.frontendUrl+'/notifications'}),undefined,{requireConfigured:true,messageId:'<'+key.replace(/:/g,'-')+'@'+new URL(config.frontendUrl).hostname+'>'});
    }
    await EventAlertDeliveryModel.updateOne(owned,{$set:{status:'SENT',sentAt:new Date(),leaseUntil:null,leaseToken:'',lastError:''}});
  } catch {
    // Each channel retries independently; successful channels are never selected again.
    await EventAlertDeliveryModel.updateOne(owned,{$set:{status:'PENDING',nextAttemptAt:new Date(Date.now()+alertRetryDelay(job.attempts)),leaseUntil:null,leaseToken:'',lastError:'Delivery failed; scheduled for retry'}});
  }
}
export async function deliverQueuedCommunityEventAlerts(limit=20) {
  await EventAlertDeliveryModel.init();
  for(let i=0;i<limit;i+=1) {
    const now = new Date(); const token = randomUUID();
    const job = await EventAlertDeliveryModel.findOneAndUpdate({$or:[{status:'PENDING',nextAttemptAt:{$lte:now}},{status:'PROCESSING',leaseUntil:{$lte:now}}]},{$set:{status:'PROCESSING',leaseToken:token,leaseUntil:new Date(now.getTime()+ALERT_LEASE_MS)},$inc:{attempts:1}},{new:true,sort:{nextAttemptAt:1,_id:1}}).lean();
    if(!job) break;
    await deliverCommunityEventAlert(job,token);
  }
}
