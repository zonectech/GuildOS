import {describe,expect,it} from 'vitest';
import {hackathonRewardPolicy} from './hackathon-rules';
describe('hackathon result rewards',()=>{
 it('honors certificates switched off for a verified community',()=>{expect(hackathonRewardPolicy(true,false)).toEqual({reputation:true,certificates:false});});
 it('allows configured certificates for a verified community',()=>{expect(hackathonRewardPolicy(true,true)).toEqual({reputation:true,certificates:true});});
 it.each([true,false])('denies all rewards to an unverified community with certificate switch %s',certificateEnabled=>{expect(hackathonRewardPolicy(false,certificateEnabled)).toEqual({reputation:false,certificates:false});});
});
