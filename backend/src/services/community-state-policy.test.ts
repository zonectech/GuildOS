import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({community:null as any}));
vi.mock('../models/community.model',()=>({CommunityModel:{findById:vi.fn(()=>({select:()=>({lean:async()=>state.community})})),find:vi.fn(()=>({select:()=>({lean:async()=>[{_id:'active'}]})}))}}));
import {assertCommunityActive,activeCommunityIds,CommunityInactiveError} from './community-state-policy';
import {CommunityModel} from '../models/community.model';
beforeEach(()=>{vi.clearAllMocks();state.community={verificationStatus:'VERIFIED',archivedAt:null,adminSuspended:false};});
describe('community suspension is authoritative',()=>{
 it('allows active verified and unverified-tier communities',async()=>{await expect(assertCommunityActive('community')).resolves.toBeUndefined();state.community.verificationStatus='UNVERIFIED';await expect(assertCommunityActive('community')).resolves.toBeUndefined();});
 it.each(['adminSuspended','archivedAt'])('rejects when %s is set, despite verified status',async key=>{state.community[key]=key==='archivedAt'?new Date():true;await expect(assertCommunityActive('community')).rejects.toBeInstanceOf(CommunityInactiveError);});
 it.each(['PENDING','REJECTED'])('rejects %s verification',async status=>{state.community.verificationStatus=status;await expect(assertCommunityActive('community')).rejects.toThrow(/verification/);});
 it('does not let a suspended co-host confer event permissions',async()=>{expect(await activeCommunityIds(['active','suspended'])).toEqual(['active']);expect(CommunityModel.find).toHaveBeenCalledWith(expect.objectContaining({archivedAt:null,adminSuspended:{$ne:true},verificationStatus:{$in:['VERIFIED','UNVERIFIED']}}));});
});
