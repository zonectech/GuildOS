/** User-authorized disposable live test. Judge names have no delivery addresses. */
import mongoose from 'mongoose';
import { writeFile } from 'node:fs/promises';
import { config } from '../src/config';
import { CommunityModel } from '../src/models/community.model';
import { MembershipModel } from '../src/models/membership.model';
import { UserModel } from '../src/models/user.model';
import { EventModel } from '../src/models/event.model';
import { EventRegistrationModel } from '../src/models/event-registration.model';
import { createEvent,publishEvent,updateEvent } from '../src/services/event/event-core.service';
import { registerForEvent } from '../src/services/event/event-registration.service';
import { getHackathonManage,updateHackathonSettings,addJudge,scoreSubmission } from '../src/services/hackathon/hackathon-judging.service';
import { createTeam,saveSubmission,getHackathonHub } from '../src/services/hackathon/hackathon-team.service';
const TITLE='[TEST] GuildOS Campus Hackathon — live workflow review';
async function main(){
 if(!process.argv.includes('--confirm-test-seed'))throw new Error('Explicit test seed flag required');
 await mongoose.connect(config.mongoUri,{autoIndex:false,serverSelectionTimeoutMS:15000});
 const community=await CommunityModel.findOne({slug:'guildos-help',archivedAt:null});if(!community)throw new Error('GuildOS Help not found');
 const response=await fetch('https://guildos-api.azurewebsites.net/api/communities/guildos-help');const live=await response.json() as any;if(!response.ok||String(live.community?._id??live.community?.id)!==String(community._id))throw new Error('Database is not the published Help community');
 let actorId='';for(const membership of await MembershipModel.find({communityId:community._id,status:'ACTIVE',role:{$in:['FOUNDER','PRESIDENT','VICE_PRESIDENT','COORDINATOR']}})){const user=await UserModel.findOne({_id:membership.userId,status:'ACTIVE',deletedAt:null,emailVerified:true,$or:[{role:'ADMIN'},{communityAccessStatus:'APPROVED'}]}).select('_id');if(user){actorId=String(user._id);break;}}
 if(!actorId)throw new Error('No approved Help organizer');
 let event=await EventModel.findOne({communityId:community._id,title:TITLE,deletedAt:null});
 if(!event)event=await createEvent(String(community._id),actorId,{title:TITLE,type:'HACKATHON',mode:'VIRTUAL',visibility:'UNLISTED',shortDescription:'Disposable live test of registration, teams, submissions and judging. No real competition, prizes or certificates.',description:'TEST EVENT — created for GuildOS workflow review only. This is not a real competition. Sample judges, tracks, projects and scores are demonstration data. No prizes, payments or certificates. Results remain unpublished. This temporary event can be removed after review.',startDate:'2026-10-27T21:00:00.000Z',endDate:'2026-10-29T21:00:00.000Z',timezone:'Africa/Lagos',meetingLink:'https://guildos-three.vercel.app/events',attendanceSource:'GUILDOS',registrationPolicy:'OPEN',capacity:20,ticketPrice:0,qrEnabled:true,allowWalkIns:true,certificateEnabled:false,appreciationMode:'OFF',tags:['TEST','Hackathon']});
 if(event.status==='DRAFT'&&!event.bannerImage)event=await updateEvent(String(event._id),actorId,{bannerImage:community.coverImage||'/og.png'});
 if(event.status==='DRAFT')event=await publishEvent(String(event._id),actorId);
 let manage=await getHackathonManage(String(event._id),actorId);
 if(!manage.teams.length)await updateHackathonSettings(String(event._id),actorId,{teamSizeMin:1,teamSizeMax:4,submissionOpensAt:'2026-10-27T21:00:00.000Z',submissionDeadline:'2026-10-29T20:00:00.000Z',tracks:[{name:'Campus tools',description:'Demo solutions for student life',prize:'Demo only — no prize'},{name:'Community impact',description:'Demo solutions for school communities',prize:'Demo only — no prize'}],criteria:[{name:'Innovation',weight:25},{name:'Technical execution',weight:35},{name:'Student impact',weight:25},{name:'Presentation',weight:15}]});
 manage=await getHackathonManage(String(event._id),actorId);
 for(const name of ['TEST Judge — Technical','TEST Judge — Impact'])if(!manage.judges.some(j=>j.name===name))await addJudge(String(event._id),actorId,{name});
 if(!await EventRegistrationModel.exists({eventId:event._id,userId:actorId}))await registerForEvent(String(event._id),actorId);
 manage=await getHackathonManage(String(event._id),actorId);
 if(!manage.teams.some(t=>t.members.some(m=>m.id===actorId)))await createTeam(String(event._id),actorId,{name:'TEST Campus Builders'});
 const project=await saveSubmission(String(event._id),actorId,{title:'[TEST] Campus Connect prototype',tagline:'Sample project for workflow validation',description:'Demonstration submission only. Tests organizer project visibility and weighted judging. Not a real award entry.',techStack:['TypeScript','React'],trackKeys:[manage.settings.tracks[0].key]});
 manage=await getHackathonManage(String(event._id),actorId);
 for(const [index,judge] of manage.judges.entries()){const token=judge.link.split('/').pop()!;await scoreSubmission(token,project.submission.id,{scores:Object.fromEntries(manage.settings.criteria.map(c=>[c.key,index===0?8:7])),comment:'TEST score for workflow review only.'});}
 const publicHub=await getHackathonHub(String(event._id));manage=await getHackathonManage(String(event._id),actorId);
 if(publicHub.submissions.length||publicHub.leaderboard!==null||publicHub.awards.length)throw new Error('Unpublished project visibility failed');
 const receipt={eventId:String(event._id),communityId:String(community._id),slug:event.slug,url:'https://guildos-three.vercel.app/events/'+event.slug,hubUrl:'https://guildos-three.vercel.app/events/'+event.slug+'/hackathon',organizerUrl:'https://guildos-three.vercel.app/dashboard/events/hackathon?eventId='+event._id,status:event.status,visibility:event.visibility,judges:manage.judges.length,criteria:manage.settings.criteria.map(c=>({name:c.name,weight:c.weight})),teams:manage.teams.length,submissions:manage.submissions.length,scoredJudges:manage.leaderboard[0]?.judgeCount,unpublishedProjectsHidden:publicHub.submissions.length===0,certificateEnabled:event.certificateEnabled,cleanup:'Disposable test authorized by user; remove after review.'};
 await writeFile('D:/Users/Administrator/Desktop/Guild0S/backend/.deploy/temporary-hackathon-event.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));await mongoose.disconnect();
}
main().catch(async error=>{console.error(error.message);await mongoose.disconnect();process.exitCode=1});
