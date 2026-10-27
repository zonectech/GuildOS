import { describe,expect,it,vi } from 'vitest';
vi.mock('../../models/community.model',async original=>{const actual=await original<any>();return {...actual,CommunityModel:{...actual.CommunityModel,findById:vi.fn()}};});
import { CommunityModel } from '../../models/community.model';
import { communityVerificationPolicy,reopenCommunity } from './community-core.service';
describe('community admin review',()=>{
 it.each(['UNIVERSITY_EMAIL','ENDORSEMENT','MANUAL','NONE'] as const)('keeps %s communities pending admin review',async verificationMethod=>{expect(await communityVerificationPolicy({schoolEmail:'person@uni.edu',schoolEmailVerified:true,university:'University',institution:{emailDomains:['uni.edu']},verificationMethod})).toMatchObject({allowed:true,verificationStatus:'PENDING'});});
 it('does not treat an unverified inbox as school proof',async()=>{expect(await communityVerificationPolicy({schoolEmail:'person@uni.edu',schoolEmailVerified:false,university:'University',institution:{emailDomains:['uni.edu']},verificationMethod:'UNIVERSITY_EMAIL'})).toMatchObject({verificationStatus:'PENDING',verificationMethod:'MANUAL'});});
 it('prevents a founder from reversing admin suspension',async()=>{const save=vi.fn();vi.mocked(CommunityModel.findById).mockResolvedValue({founder:{toString:()=> 'founder'},archivedAt:new Date(),archivedBy:null,adminSuspended:true,save} as any);await expect(reopenCommunity('c','founder')).rejects.toThrow(/admin/);expect(save).not.toHaveBeenCalled();});
});
