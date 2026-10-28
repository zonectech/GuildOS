import {describe,it,expect} from 'vitest';import {publicJudge} from './hackathon-public.service';
const judge={_id:'judge',name:'Judge name',email:'private@example.test',token:'secret-score-link'};
describe('public judge identities',()=>{
 it('never serializes private judge credentials',()=>{expect(publicJudge(judge)).toEqual({id:'judge',name:'Judge name',username:'',avatar:''});});
 it('links an active public profile',()=>{expect(publicJudge(judge,{status:'ACTIVE',profile:{profileVisibility:'PUBLIC',username:'judge',avatar:'/avatar.png'}})).toMatchObject({username:'judge',avatar:'/avatar.png'});});
 it.each(['PRIVATE','UNLISTED'])('hides a %s profile link and image',profileVisibility=>{expect(publicJudge(judge,{status:'ACTIVE',profile:{profileVisibility,username:'private',avatar:'private.png'}})).toMatchObject({username:'',avatar:''});});
 it('hides a deleted public profile',()=>{expect(publicJudge(judge,{status:'ACTIVE',deletedAt:new Date(),profile:{profileVisibility:'PUBLIC',username:'gone'}}).username).toBe('');});
});
