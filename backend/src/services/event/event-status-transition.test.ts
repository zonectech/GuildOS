import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({event:null as any,finalize:vi.fn(),transition:vi.fn()}));
vi.mock('../community-access-policy',()=>({assertApprovedCommunityAccess:vi.fn(async()=>{})}));
vi.mock('../../models/event.model',async original=>({...await original<typeof import('../../models/event.model')>(),EventModel:{findOne:vi.fn(async()=>state.event),findOneAndUpdate:state.transition}}));
vi.mock('./event-shared',async original=>({...await original<typeof import('./event-shared')>(),findEventMemberships:vi.fn(async()=>[{role:'FOUNDER'}])}));
vi.mock('./event-attendance.service',()=>({finalizeEventAttendance:state.finalize}));
import {setEventStatus} from './event-core.service';
beforeEach(()=>{vi.clearAllMocks();state.finalize.mockResolvedValue({});state.transition.mockImplementation(async(_query,update)=>{state.event.status=update.$set.status;return state.event;});state.event={_id:'event',createdBy:'owner',communityId:'community',status:'DRAFT',attendanceSource:'GUILDOS',qrEnabled:true,bannerImage:'',save:vi.fn(async()=>{})};});
describe('generic event status API uses protected workflows',()=>{
 it('cannot publish a draft without the normal publication validation',async()=>{await expect(setEventStatus('event','owner','PUBLISHED')).rejects.toThrow(/banner/);expect(state.event.status).toBe('DRAFT');expect(state.event.save).not.toHaveBeenCalled();});
 it.each(['DRAFT','ANNOUNCED','POSTPONED','COMPLETED'])('cannot open attendance from %s',async status=>{state.event.status=status;await expect(setEventStatus('event','owner','CHECK_IN')).rejects.toThrow();expect(state.event.save).not.toHaveBeenCalled();});
 it('does not bypass the dedicated resume action or reopen a completed event',async()=>{state.event.status='POSTPONED';await expect(setEventStatus('event','owner','PUBLISHED')).rejects.toThrow(/resume/);state.event.status='COMPLETED';await expect(setEventStatus('event','owner','PUBLISHED')).rejects.toThrow(/completed/);});
 it('blocks external attendance controls',async()=>{state.event.status='PUBLISHED';state.event.attendanceSource='EXTERNAL';await expect(setEventStatus('event','owner','CHECK_IN')).rejects.toThrow(/external/);});
 it('delegates completion to attendance finalization and propagates its rejection',async()=>{state.event.status='CHECK_OUT';state.finalize.mockRejectedValueOnce(new Error('Wait until the event ends'));await expect(setEventStatus('event','owner','COMPLETED')).rejects.toThrow(/event ends/);expect(state.finalize).toHaveBeenCalledWith('event','owner');expect(state.event.status).toBe('CHECK_OUT');expect(state.event.save).not.toHaveBeenCalled();});
 it('does not overwrite an event finalized by a concurrent request',async()=>{state.event.status='CHECK_IN';state.transition.mockResolvedValueOnce(null);await expect(setEventStatus('event','owner','CHECK_OUT')).rejects.toThrow(/event changed/);expect(state.event.save).not.toHaveBeenCalled();});
 it('saves a valid check-out transition',async()=>{state.event.status='CHECK_IN';await setEventStatus('event','owner','CHECK_OUT');expect(state.event.status).toBe('CHECK_OUT');expect(state.transition).toHaveBeenCalledWith(expect.objectContaining({status:'CHECK_IN',attendanceFinalizedAt:null}),{$set:{status:'CHECK_OUT'}},{new:true});});
});
