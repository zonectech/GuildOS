import { config } from '../config';
import { UserModel } from '../models/user.model';
import { CommunityModel } from '../models/community.model';
import { EventModel } from '../models/event.model';
import { MembershipModel } from '../models/membership.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { recommendationEmail, sendEmail } from '../utils/email';
import { recommendationToken } from '../utils/recommendation-token';
import { siteLink } from '../utils/site-link';

export const RECOMMENDATION_GAP_MS = 7 * 24 * 60 * 60 * 1000;
const normal = (s: string) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Exact phrases, not substring matches: "AI" must not match "training". */
export function recommendationMatch(profile: { interests?: string[]; skills?: string[]; university?: string }, item: { title: string; category?: string; tags?: string[]; school?: string }) {
  const text = ` ${normal([item.title, item.category, ...(item.tags ?? [])].filter(Boolean).join(' '))} `;
  const interests = [...new Set([...(profile.interests ?? []), ...(profile.skills ?? [])].map(normal).filter(k=>k.length>=2))];
  const match = interests.find(k=>text.includes(` ${k} `));
  const school = Boolean(normal(profile.university ?? '') && normal(profile.university ?? '') === normal(item.school ?? ''));
  return { score: (match ? 2 : 0) + (school ? 1 : 0), reason: match ? `Matches your interest in ${match}` : school ? 'From your school' : '' };
}

/** Per-person atomic claim keeps multiple workers/restarts inside a strict seven-day cap.
 * Claim before SMTP: uncertain delivery is never retried immediately and cannot flood an inbox.
 */
export async function sendRecommendationEmails() {
  if (!config.smtpHost) return { sent: 0, skipped: true };
  const now = new Date();
  const cutoff = new Date(now.getTime() - RECOMMENDATION_GAP_MS);
  const eligible = { status: 'ACTIVE', deletedAt: null, emailVerified: true, recommendationEmailEnabled: true,
    role: { $in: ['STUDENT', 'COMMUNITY_LEADER'] },
    email: { $not: /@(.*\.local|example\.(com|org)|test\.local)$/i },
    $or: [{ lastRecommendationEmailAt: null }, { lastRecommendationEmailAt: { $lte: cutoff } }],
  };
  // Public, verified, available communities only; private names never enter a mailing.
  const communities = await CommunityModel.find({ visibility:'PUBLIC', verificationStatus:'VERIFIED', adminSuspended:{$ne:true}, archivedAt:null })
    .select('_id name slug category university').sort({createdAt:-1}).limit(1000).lean();
  const events = await EventModel.find({ communityId:{$in:communities.map(c=>c._id)}, deletedAt:null, visibility:'PUBLIC', registrationPolicy:{$ne:'INVITE'}, status:'PUBLISHED',
    startDate:{$gt:now,$lte:new Date(now.getTime()+30*24*60*60*1000)}, createdAt:{$gte:cutoff}, registrationClosed:{$ne:true},
    $or:[{registrationDeadline:null},{registrationDeadline:{$gt:now}}],
  }).select('_id communityId title slug type tags startDate mode venue createdBy').sort({startDate:1}).limit(1000).lean();
  if (!events.length) return { sent:0, skipped:true };
  const byCommunity=new Map(communities.map(c=>[String(c._id),c]));
  let sent=0;
  for await (const user of UserModel.find(eligible).select('_id fullName email profile.interests profile.skills profile.university recommendationEmailItems').lean().cursor()) {
    try {
      const [memberships,registrations]=await Promise.all([
        MembershipModel.find({userId:user._id,status:{$in:['ACTIVE','SUSPENDED','REMOVED']}}).select('communityId').lean(),
        EventRegistrationModel.find({userId:user._id}).select('eventId').lean(),
      ]);
      const joined=new Set(memberships.map(m=>String(m.communityId)));
      const registered=new Set(registrations.map(r=>String(r.eventId)));
      const seen=new Set(user.recommendationEmailItems ?? []);
      const eventPicks=events.filter(e=>!joined.has(String(e.communityId))&&!registered.has(String(e._id))&&!seen.has(`event:${e._id}`)&&String(e.createdBy)!==String(user._id))
        .map(e=>({item:e,...recommendationMatch(user.profile,{title:e.title,category:[e.type,byCommunity.get(String(e.communityId))?.category].filter(Boolean).join(' '),tags:e.tags,school:byCommunity.get(String(e.communityId))?.university})}))
        .filter(p=>p.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
      if(!eventPicks.length) continue;
      const communityPicks=communities.filter(c=>!joined.has(String(c._id))&&!seen.has(`community:${c._id}`))
        .map(c=>({item:c,...recommendationMatch(user.profile,{title:c.name,category:c.category,school:c.university})}))
        .filter(p=>p.score>0).sort((a,b)=>b.score-a.score).slice(0,2);
      const ids=[...eventPicks.map(p=>`event:${p.item._id}`),...communityPicks.map(p=>`community:${p.item._id}`)];
      const claimed=await UserModel.findOneAndUpdate({_id:user._id,...eligible},{$set:{lastRecommendationEmailAt:now},$push:{recommendationEmailItems:{$each:ids,$slice:-500}}},{new:true}).select('_id email').lean();
      if(!claimed) continue;
      const apiBase=config.publicApiUrl.replace(/\/+$/,'');
      const unsubscribeUrl=`${apiBase}/api/notifications/recommendations/unsubscribe?id=${user._id}&token=${recommendationToken(String(user._id))}`;
      await sendEmail(claimed.email,recommendationEmail({name:user.fullName,unsubscribeUrl,
        events:eventPicks.map(p=>({title:p.item.title,url:siteLink(`/events/${encodeURIComponent(p.item.slug)}`),reason:p.reason,
          detail:[p.item.startDate?.toLocaleString('en-NG',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Lagos'}),p.item.mode==='VIRTUAL'?'Online':p.item.venue,byCommunity.get(String(p.item.communityId))?.name].filter(Boolean).join(' · ')})),
        communities:communityPicks.map(p=>({title:p.item.name,url:siteLink(`/communities/${encodeURIComponent(p.item.slug)}`),reason:p.reason,detail:[p.item.category,p.item.university].filter(Boolean).join(' · ')})),
      }),undefined,{requireConfigured:true,messageId:`<recommendations-${user._id}-${now.getTime()}@${new URL(config.frontendUrl).hostname}>`});
      sent++;
    } catch { console.warn('[Kintriva] recommendation email delivery failed'); }
  }
  return { sent, skipped:false };
}
