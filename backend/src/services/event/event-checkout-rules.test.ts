import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({event:null as any,registration:null as any,community:null as any,find:vi.fn(),appreciation:vi.fn(async()=>({})),create:vi.fn()}));
vi.mock('../community-state-policy',()=>({assertCommunityActive:vi.fn(async()=>{}),activeCommunityIds:vi.fn(async(ids:string[])=>ids)}));
vi.mock('./event-capacity.service',async original=>({...await original<typeof import('./event-capacity.service')>(),withEventMutation:(_id:string,work:()=>unknown)=>work(),afterEventCommit:(effect:()=>unknown)=>Promise.resolve().then(effect)}));
vi.mock('./event-ticket.service',async original=>({...await original<typeof import('./event-ticket.service')>(),ticketCoveredDays:vi.fn(async()=>null)}));
vi.mock('./event-registration.service',async original=>({...await original<typeof import('./event-registration.service')>(),sendEventAppreciation:state.appreciation}));
vi.mock('../domain-activity.service',()=>({buildDomainActivityRecord:vi.fn(async()=>{})}));
vi.mock('../feed.service',()=>({createMilestonePost:vi.fn(async()=>{})}));
vi.mock('../notification.service',()=>({createNotification:vi.fn(async()=>{})}));
vi.mock('../../utils/email',async original=>({...await original<typeof import('../../utils/email')>(),sendEmail:vi.fn(async()=>{})}));
vi.mock('../../models/event.model',async original=>({...await original<typeof import('../../models/event.model')>(),EventModel:{
 findOne:vi.fn(()=>Object.assign(Promise.resolve(state.event),{select:async()=>state.event})),
 updateOne:vi.fn(async()=>({})),
}}));
vi.mock('../../models/event-registration.model',async original=>({...await original<typeof import('../../models/event-registration.model')>(),EventRegistrationModel:{
 find:state.find,findOne:vi.fn(async()=>state.registration),
}}));
vi.mock('../../models/community.model',async original=>({...await original<typeof import('../../models/community.model')>(),CommunityModel:{
 findById:vi.fn(()=>({select:()=>({lean:async()=>state.community}),lean:async()=>state.community})),
}}));
vi.mock('../../models/user.model',async original=>({...await original<typeof import('../../models/user.model')>(),UserModel:{findOne:vi.fn(async()=>({fullName:'Ada',email:'',profile:{}}))}}));
vi.mock('../../models/certificate.model',async original=>({...await original<typeof import('../../models/certificate.model')>(),CertificateModel:{
 findOne:vi.fn(async()=>null),exists:vi.fn(async()=>false),countDocuments:vi.fn(async()=>1),create:state.create,
}}));
import {assertCheckOutOpen,assertEventEndAdjustable} from './event-lifecycle-policy';
import {autoIssueEventCertificates} from './event-certificate.service';
import {selfCheckOut} from './event-attendance.service';

const hour=3_600_000;
beforeEach(()=>{
 vi.clearAllMocks();
 const start=new Date(Date.now()-3*hour),end=new Date(Date.now()-hour);
 state.event={_id:'event',title:'Tech Day',communityId:'community',createdBy:'owner',status:'CHECK_OUT',mode:'VIRTUAL',startDate:start,endDate:end,timezone:'UTC',days:[],
  certificateEnabled:true,certificateMode:'STANDARD',qrEnabled:true,attendanceSource:'GUILDOS',checkOutRequired:true,minimumAttendanceDuration:0,appreciationMode:'AUTO',appreciationSentAt:null};
 state.registration={_id:'registration',userId:'student',status:'COMPLETED',certificateEligible:true,certificateIssued:false,attendanceEvidence:'GUILDOS',attendanceMode:null,attendanceDays:[],
  checkInAt:new Date(start.getTime()+60_000),checkOutAt:new Date(end.getTime()+60_000),save:vi.fn(async()=>{})};
 state.community={name:'ABU Tech',slug:'abu-tech',verificationStatus:'VERIFIED',archivedAt:null,adminSuspended:false};
 state.find.mockResolvedValue([state.registration]);
 state.create.mockResolvedValue({_id:'certificate',serial:'GLD-2026-TEST'});
});

describe('check-out only opens at the end time',()=>{
 const end=new Date('2026-10-01T14:00:00Z');
 it('refuses a single-day check-out one second early',()=>{expect(()=>assertCheckOutOpen({endDate:end},false,end.getTime()-1000)).toThrow(/end time/);});
 it('accepts a check-out at the end time',()=>{expect(()=>assertCheckOutOpen({endDate:end},false,end.getTime())).not.toThrow();});
 it('leaves multi-day check-outs per day',()=>{expect(()=>assertCheckOutOpen({endDate:end},true,end.getTime()-1000)).not.toThrow();});
 it('refuses early self check-out before anything is saved',async()=>{
  state.event.endDate=new Date(Date.now()+hour);state.event.status='CHECK_IN';state.registration={...state.registration,status:'CHECKED_IN',checkOutAt:null};
  await expect(selfCheckOut('event','student')).rejects.toThrow(/end time/);
  expect(state.registration.save).not.toHaveBeenCalled();
 });
});

describe('organizers can only move the end of a running single-day event',()=>{
 const running={status:'CHECK_IN',attendanceSource:'GUILDOS'};
 it('allows a running event',()=>{expect(()=>assertEventEndAdjustable(running,false)).not.toThrow();});
 it('refuses multi-day events',()=>{expect(()=>assertEventEndAdjustable(running,true)).toThrow(/Multi-day/);});
 it('refuses events that are not running',()=>{expect(()=>assertEventEndAdjustable({...running,status:'PUBLISHED'},false)).toThrow(/check-in/);});
 it('refuses external attendance',()=>{expect(()=>assertEventEndAdjustable({...running,attendanceSource:'EXTERNAL'},false)).toThrow(/external/);});
});

describe('certificates issue themselves',()=>{
 it('issues one certificate at check-out without the thank-you blast',async()=>{
  const result=await autoIssueEventCertificates('event','registration');
  expect(result?.issued).toBe(1);
  expect(state.find).toHaveBeenCalledWith(expect.objectContaining({_id:'registration'}));
  expect(state.create).toHaveBeenCalledWith(expect.objectContaining({issuedBy:'owner',registrationId:'registration'}));
  expect(state.registration.certificateIssued).toBe(true);
  expect(state.appreciation).not.toHaveBeenCalled();
 });
 it('sends the thank-you at the finalize sweep, even when check-outs issued everything',async()=>{
  state.find.mockResolvedValue([]);
  await autoIssueEventCertificates('event');
  expect(state.appreciation).toHaveBeenCalledTimes(1);
 });
 it.each([
  ['the community is unverified',()=>{state.community.verificationStatus='PENDING';}],
  ['certificates are off',()=>{state.event.certificateEnabled=false;}],
  ['the event is still running',()=>{state.event.endDate=new Date(Date.now()+hour);}],
  ['a custom template is missing',()=>{state.event.certificateMode='CUSTOM';state.event.certificateTemplate='';}],
 ])('skips quietly when %s',async(_name,arrange)=>{
  arrange();
  await expect(autoIssueEventCertificates('event','registration')).resolves.toBeNull();
  expect(state.create).not.toHaveBeenCalled();
 });
});
