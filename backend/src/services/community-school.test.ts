import { beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({user:null as any,selected:null as any,institutions:[] as any[],proposal:vi.fn()}));
vi.mock('../models/user.model',()=>({UserModel:{findById:()=>({select:()=>({lean:async()=>state.user})})}}));
vi.mock('../models/institution.model',()=>({InstitutionModel:{find:()=>({select:()=>({lean:async()=>state.institutions})}),findOneAndUpdate:state.proposal}}));
vi.mock('./institution.service',()=>({findInstitutionByName:async()=>state.selected,institutionAcceptsEmail:(school:any,email:string)=>school.emailDomains.some((domain:string)=>email.endsWith('@'+domain)||email.split('@')[1]?.endsWith('.'+domain))}));
import { resolveCommunitySchool,resolveOrProposeInstitution } from './community-school.service';
beforeEach(()=>{state.user={email:'student@uni.edu',emailVerified:true,profile:{university:'Profile school'}};state.selected=null;state.institutions=[{name:'University',emailDomains:['uni.edu']}];state.proposal.mockReset();state.proposal.mockReturnValue({lean:async()=>({_id:'proposal',active:false})});});
describe('community school evidence',()=>{
 it('reuses a verified academic signup email and matches the institution',async()=>{expect(await resolveCommunitySchool('u')).toMatchObject({verified:true,matchedSchool:'University',selectedMatches:true});});
 it('does not trust an unverified academic email',async()=>{state.user.emailVerified=false;expect(await resolveCommunitySchool('u')).toMatchObject({verified:false,matchedSchool:'',selectedMatches:false});});
 it('marks a different selected school for review',async()=>{state.selected={name:'Other school',emailDomains:['other.edu']};expect(await resolveCommunitySchool('u','Other school')).toMatchObject({verified:true,selectedMatches:false});});
 it('does not expose school domain lists in the response',async()=>{expect(await resolveCommunitySchool('u')).not.toHaveProperty('emailDomains');});
 it('creates unknown schools as inactive proposals without trusted domains',async()=>{await resolveOrProposeInstitution('New University');expect(state.proposal).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({$setOnInsert:expect.objectContaining({active:false,emailDomains:[]})}),{upsert:true,new:true});});
});
