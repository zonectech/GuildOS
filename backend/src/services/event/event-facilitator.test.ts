import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({credited:false,count:1,award:vi.fn(),speakers:[] as any[]}));
vi.mock('../../models/user.model',()=>({UserModel:{countDocuments:async()=>state.count,find:()=>({select:()=>({lean:async()=>[{_id:'111111111111111111111111'}]})})}}));
vi.mock('../../models/event-speaker.model',()=>({EventSpeakerModel:{find:()=>({select:()=>({lean:async()=>state.speakers})})}}));
vi.mock('../../models/reputation-activity.model',()=>({ReputationActivityModel:{exists:async()=>state.credited}}));
vi.mock('../reputation.service',()=>({speakerReputation:()=>40,awardReputation:state.award}));
import {facilitatorUserIds,normalizeFacilitatorUserId,validateFacilitatorAccounts,awardEventFacilitators} from './event-facilitator.service';
const userId='111111111111111111111111';const event={_id:'222222222222222222222222',communityId:'333333333333333333333333',title:'Workshop',attendanceFinalizedAt:new Date(),days:[{facilitators:[{userId}]},{facilitators:[{userId}]}]};
beforeEach(()=>{state.credited=false;state.count=1;state.speakers=[];state.award.mockReset();state.award.mockImplementation(async()=>{state.credited=true;});});
describe('tagged facilitator credit',()=>{
 it('deduplicates the same account across days and skips cancelled days',()=>{expect(facilitatorUserIds([...event.days,{cancelled:true,facilitators:[{userId:'other'}]}])).toEqual([userId]);});
 it('does not award points simply for tagging an account',async()=>{await awardEventFacilitators({...event,attendanceFinalizedAt:null});expect(state.award).not.toHaveBeenCalled();});
 it('awards a finalized facilitator once per event, including repeated finalization',async()=>{await awardEventFacilitators(event);await awardEventFacilitators(event);expect(state.award).toHaveBeenCalledTimes(1);expect(state.award).toHaveBeenCalledWith(expect.objectContaining({userId,scoreAwarded:40,referenceId:event._id}));});
 it('does not duplicate an existing speaker contribution',async()=>{state.credited=true;state.speakers=[{_id:'speaker',userId}];await awardEventFacilitators(event);expect(state.award).not.toHaveBeenCalled();});
 it('rejects invalid and unavailable tagged accounts',async()=>{expect(()=>normalizeFacilitatorUserId('bad')).toThrow(/valid/);state.count=0;await expect(validateFacilitatorAccounts(event.days)).rejects.toThrow(/unavailable/);});
});
