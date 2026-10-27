/** Explicitly requested disposable live-site event. No accounts, roles, attendance or certificates are created. */
import mongoose from 'mongoose';
import { writeFile } from 'node:fs/promises';
import { config } from '../src/config';
import { CommunityModel } from '../src/models/community.model';
import { MembershipModel } from '../src/models/membership.model';
import { UserModel } from '../src/models/user.model';
import { EventModel } from '../src/models/event.model';
import { importEventLink } from '../src/services/event/external-event-link';
import { createEvent, publishEvent, setEventRegistrationClosed } from '../src/services/event/event-core.service';
const SOURCE='https://cerebralvalley.ai/events/~/e/built-with-claude-japan2026?utm_source=cerebralvalley&utm_medium=referral&utm_campaign=featured&modalCloseUrl=%2Fevents';
const TITLE='[TEST] Built with Claude: Japan 2026 — external import';
async function main(){
 if(!process.argv.includes('--confirm-test-seed')) throw new Error('Pass --confirm-test-seed only for the user-authorized disposable event.');
 const imported=await importEventLink(SOURCE);
 if(imported.draft.startDate!=='2026-11-02T03:00:00.000Z'||imported.draft.endDate!=='2026-11-10T05:00:00.000Z'||imported.draft.mode!=='VIRTUAL') throw new Error('Official schedule changed; review it before seeding.');
 await mongoose.connect(config.mongoUri,{autoIndex:false,serverSelectionTimeoutMS:15000});
 const community=await CommunityModel.findOne({slug:'guildos-help',archivedAt:null});
 if(!community) throw new Error('GuildOS Help community not found.');
 const live=await fetch('https://guildos-api.azurewebsites.net/api/communities/guildos-help');
 const liveBody=await live.json() as any;
 if(!live.ok||String(liveBody.community?._id??liveBody.community?.id)!==String(community._id)) throw new Error('Local configuration does not match the live Help community.');
 const memberships=await MembershipModel.find({communityId:community._id,status:'ACTIVE'});
 let actorId='';
 for(const m of memberships){
  if(!['FOUNDER','PRESIDENT','VICE_PRESIDENT','COORDINATOR'].includes(m.role)) continue;
  const user=await UserModel.findOne({_id:m.userId,status:'ACTIVE',deletedAt:null,emailVerified:true,$or:[{role:'ADMIN'},{communityAccessStatus:'APPROVED'}]}).select('_id');
  if(user){actorId=String(user._id);break;}
 }
 if(!actorId) throw new Error('No currently authorized Help organizer found.');
 let event=await EventModel.findOne({communityId:community._id,title:TITLE,deletedAt:null});
 if(!event){
  event=await createEvent(String(community._id),actorId,{
   title:TITLE,type:'HACKATHON',mode:'VIRTUAL',visibility:'UNLISTED',
   shortDescription:'Temporary GuildOS import test. Not an official application or proof of acceptance. Real event dates and external attendance labels are preserved.',
   description:'TEMPORARY TEST EVENT — this is a disposable GuildOS test copy, not an official organizer page or application acceptance. The real event is hosted by Cerebral Valley and Anthropic. Schedule: 2 November 2026 at 12:00 to 10 November 2026 at 14:00, Asia/Tokyo (Japan). In Lagos: 2 November at 04:00 to 10 November at 06:00. The official page lists an application deadline of 26 October 2026 at 23:59 Japan time. This test does not accept registrations, issue certificates, or charge money. External participation and selection remain controlled by the original organizers. This record will be removed after review.',
   startDate:imported.draft.startDate,endDate:imported.draft.endDate,timezone:'Asia/Tokyo',
   registrationDeadline:'2026-10-26T23:59:00+09:00',registrationPolicy:'APPROVAL',
   partnerRegistrationUrl:imported.draft.partnerRegistrationUrl,partnerRegistrationLabel:'Cerebral Valley',attendanceSource:'EXTERNAL',
   meetingLink:imported.draft.partnerRegistrationUrl,bannerImage:community.coverImage||'/og.png',
   qrEnabled:false,allowWalkIns:false,certificateEnabled:false,ticketPrice:0,capacity:250,waitlistEnabled:false,appreciationMode:'OFF',tags:['TEST','Claude','Hackathon'],
  });
 }
 if(event.status==='DRAFT') event=await publishEvent(String(event._id),actorId);
 event=await setEventRegistrationClosed(String(event._id),actorId,true);
 const receipt={eventId:String(event._id),communityId:String(community._id),slug:event.slug,title:event.title,status:event.status,visibility:event.visibility,timezone:event.timezone,startDate:event.startDate,endDate:event.endDate,registrationDeadline:event.registrationDeadline,registrationClosed:event.registrationClosed,certificateEnabled:event.certificateEnabled,source:event.partnerRegistrationUrl,url:'https://guildos-three.vercel.app/events/'+event.slug,cleanup:'User requested deletion after reviewing this temporary TEST event.'};
 await writeFile('D:/Users/Administrator/Desktop/Guild0S/backend/.deploy/temporary-claude-event.json',JSON.stringify(receipt,null,2));
 console.log(JSON.stringify(receipt,null,2));
 await mongoose.disconnect();
}
main().catch(async e=>{console.error(e.message);await mongoose.disconnect();process.exitCode=1});
