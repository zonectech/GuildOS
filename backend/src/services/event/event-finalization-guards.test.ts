vi.mock('../community-state-policy',()=>({assertCommunityActive:vi.fn(async()=>{}),activeCommunityIds:vi.fn(async(ids:string[])=>ids)}));
import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({event:null as any,write:vi.fn()}));
vi.mock('../../models/event.model',async original=>({...await original<typeof import('../../models/event.model')>(),EventModel:{findOne:vi.fn(async()=>state.event)}}));
vi.mock('../../models/event-registration.model',async original=>({...await original<typeof import('../../models/event-registration.model')>(),EventRegistrationModel:{updateMany:state.write,find:state.write}}));
import {finalizeEventAttendance} from './event-attendance.service';
beforeEach(()=>{vi.clearAllMocks();state.event={_id:'event',status:'PUBLISHED',attendanceSource:'GUILDOS',endDate:new Date(Date.now()+3600000),save:vi.fn()};});
describe('finalization rejects before writes or rewards',()=>{
 it.each(['GUILDOS','EXTERNAL'])('rejects early %s finalization without changing attendees',async attendanceSource=>{state.event.attendanceSource=attendanceSource;await expect(finalizeEventAttendance('event')).rejects.toThrow(/event ends/);expect(state.write).not.toHaveBeenCalled();expect(state.event.save).not.toHaveBeenCalled();});
 it('does not finalize draft events after their end date',async()=>{state.event.status='DRAFT';state.event.endDate=new Date(0);await expect(finalizeEventAttendance('event')).rejects.toThrow(/published/);expect(state.write).not.toHaveBeenCalled();});
});
