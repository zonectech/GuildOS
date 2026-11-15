import { beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({user:null as any,events:[] as any[],communities:[] as any[],memberships:[] as any[],registrations:[] as any[]}));
const mocks=vi.hoisted(()=>({send:vi.fn(),claim:vi.fn(),findUser:vi.fn(),eventFind:vi.fn(),communityFind:vi.fn()}));
const query=(value:any)=>({select(){return this;},sort(){return this;},limit(){return this;},lean(){return this;},then(resolve:any){return Promise.resolve(value).then(resolve);},async *cursor(){for(const item of value)yield item;}});
vi.mock('../config',()=>({config:{smtpHost:'smtp.test',publicApiUrl:'https://api.kintriva.test',frontendUrl:'https://kintriva.test',jwtSecret:'test-secret'}}));
vi.mock('../models/user.model',()=>({UserModel:{find:mocks.findUser.mockImplementation(()=>query(state.user?[state.user]:[])),findOneAndUpdate:mocks.claim.mockImplementation((filter,update)=>{
  const u=state.user;
  if(!u||!u.recommendationEmailEnabled||(u.lastRecommendationEmailAt && u.lastRecommendationEmailAt>filter.$or[1].lastRecommendationEmailAt.$lte))return query(null);
  Object.assign(u,update.$set);u.recommendationEmailItems.push(...update.$push.recommendationEmailItems.$each);return query(u);
})}}));
vi.mock('../models/event.model',()=>({EventModel:{find:mocks.eventFind.mockImplementation(()=>query(state.events))}}));
vi.mock('../models/community.model',()=>({CommunityModel:{find:mocks.communityFind.mockImplementation(()=>query(state.communities))}}));
vi.mock('../models/membership.model',()=>({MembershipModel:{find:()=>query(state.memberships)}}));
vi.mock('../models/event-registration.model',()=>({EventRegistrationModel:{find:()=>query(state.registrations)}}));
vi.mock('../utils/email',()=>({recommendationEmail:(input:any)=>input,sendEmail:mocks.send}));
import { recommendationMatch, recommendationMediaUrl, RECOMMENDATION_GAP_MS, sendRecommendationEmails } from './recommendation-email.service';
beforeEach(()=>{
 vi.clearAllMocks();mocks.send.mockResolvedValue(undefined);
 state.user={_id:'a'.repeat(24),fullName:'Ada Student',email:'ada@school.edu',recommendationEmailEnabled:true,lastRecommendationEmailAt:null,recommendationEmailItems:[],profile:{interests:['AI'],skills:[],university:'University of Lagos'}};
 state.communities=[{_id:'c1',name:'AI Builders',slug:'ai-builders',category:'AI',university:'University of Lagos'}];
 state.events=[{_id:'e1',communityId:'c1',title:'AI Workshop',slug:'ai-workshop',type:'WORKSHOP',tags:['AI'],startDate:new Date(Date.now()+86400000),createdBy:'organizer'}];
 state.memberships=[];state.registrations=[];
});
describe('relevant, infrequent discovery emails',()=>{
 it('turns uploaded media into absolute public image URLs',()=>{
  expect(recommendationMediaUrl('/uploads/cover.jpg')).toBe('https://api.kintriva.test/uploads/cover.jpg');
  expect(recommendationMediaUrl('logo.png')).toBe('https://api.kintriva.test/uploads/logo.png');
  expect(recommendationMediaUrl('https://cdn.example.org/cover.jpg')).toBe('https://cdn.example.org/cover.jpg');
  expect(recommendationMediaUrl('javascript:alert(1)')).toBeUndefined();expect(recommendationMediaUrl('')).toBeUndefined();
 });
 it('passes covers, logos, verification and community details to the email',async()=>{
  Object.assign(state.events[0],{bannerImage:'/uploads/event.jpg',timezone:'Africa/Lagos',mode:'VIRTUAL'});
  Object.assign(state.communities[0],{logo:'/uploads/logo.png',coverImage:'/uploads/community.jpg',verificationStatus:'VERIFIED',memberCount:24,shortDescription:'Build together'});
  await sendRecommendationEmails();const mail=mocks.send.mock.calls[0][1];
  expect(mail.events[0]).toMatchObject({imageUrl:'https://api.kintriva.test/uploads/event.jpg',logoUrl:'https://api.kintriva.test/uploads/logo.png',communityName:'AI Builders',verified:true,location:'Online'});
  expect(mail.communities[0]).toMatchObject({imageUrl:'https://api.kintriva.test/uploads/community.jpg',memberCount:24,description:'Build together',verified:true});
 });
 it('matches short skills without treating part of a word as an interest',()=>{
  expect(recommendationMatch({interests:['AI']},{title:'Training day'}).score).toBe(0);
  expect(recommendationMatch({interests:['AI']},{title:'An AI workshop'}).score).toBe(2);
  expect(recommendationMatch({university:' UNILAG '},{title:'Meetup',school:'unilag'}).score).toBe(1);
  expect(recommendationMatch({},{title:'Popular event'}).score).toBe(0);
 });
 it('sends once, caps every student at seven days, and does not repeat an event afterwards',async()=>{
  await sendRecommendationEmails();await sendRecommendationEmails();expect(mocks.send).toHaveBeenCalledTimes(1);
  state.user.lastRecommendationEmailAt=new Date(Date.now()-RECOMMENDATION_GAP_MS-1);
  await sendRecommendationEmails();expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.findUser.mock.calls[0][0]).toMatchObject({recommendationEmailEnabled:true,emailVerified:true,status:'ACTIVE'});
 });
 it('claims atomically when workers overlap',async()=>{await Promise.all([sendRecommendationEmails(),sendRecommendationEmails()]);expect(mocks.send).toHaveBeenCalledTimes(1);});
 it('limits the mailing to three event cards and two community cards',async()=>{
  state.events=Array.from({length:8},(_,i)=>({...state.events[0],_id:'e'+i,slug:'event-'+i}));
  state.communities=Array.from({length:6},(_,i)=>({...state.communities[0],_id:i?'community-'+i:'c1',slug:'community-'+i}));
  await sendRecommendationEmails();expect(mocks.send.mock.calls[0][1].events).toHaveLength(3);expect(mocks.send.mock.calls[0][1].communities).toHaveLength(2);
 });
 it('rechecks opt-out when claiming a recipient',async()=>{state.user.recommendationEmailEnabled=false;await sendRecommendationEmails();expect(mocks.send).not.toHaveBeenCalled();});
 it('stays quiet without relevant events even if another community matches',async()=>{state.events[0].title='Cooking';state.events[0].tags=[];state.communities[0].category='Cooking';state.user.profile.university='Another school';state.communities.push({_id:'c2',name:'AI Circle',category:'AI',university:'Another school'});await sendRecommendationEmails();expect(mocks.send).not.toHaveBeenCalled();});
 it('excludes memberships and events the student has already registered for',async()=>{
  state.memberships=[{communityId:'c1'}];await sendRecommendationEmails();expect(mocks.send).not.toHaveBeenCalled();
  state.memberships=[];state.registrations=[{eventId:'e1'}];await sendRecommendationEmails();expect(mocks.send).not.toHaveBeenCalled();
 });
 it('keeps an uncertain SMTP failure inside the cap instead of retrying and flooding',async()=>{
  mocks.send.mockRejectedValueOnce(Error('SMTP timeout'));await sendRecommendationEmails();await sendRecommendationEmails();expect(mocks.send).toHaveBeenCalledTimes(1);
 });
 it('selects only available public events from verified public communities',async()=>{
  await sendRecommendationEmails();expect(mocks.communityFind.mock.calls[0][0]).toMatchObject({visibility:'PUBLIC',verificationStatus:'VERIFIED',archivedAt:null});
  expect(mocks.eventFind.mock.calls[0][0]).toMatchObject({visibility:'PUBLIC',status:'PUBLISHED',deletedAt:null,registrationPolicy:{$ne:'INVITE'},registrationClosed:{$ne:true}});
 });
});
