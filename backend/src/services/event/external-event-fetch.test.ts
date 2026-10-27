import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ all:true, addresses:['8.8.8.8'], lookup:undefined as any, htmlByPath:{} as Record<string,string> }));
vi.mock('node:dns/promises', () => ({ resolve4: async () => state.addresses }));
vi.mock('node:https', async () => {
 const { EventEmitter } = await import('node:events');
 const { PassThrough } = await import('node:stream');
 return { request: vi.fn((url, options, respond) => {
   const req: any = new EventEmitter();
   req.destroy = (error: Error) => { req.emit('error',error); req.emit('close'); };
   req.end = () => options.lookup(url.hostname,{all:state.all},(error: Error | null, address: any, family?: number) => {
     if(error) return req.destroy(error);
     state.lookup={address,family};
     const res: any = new PassThrough(); res.statusCode=200; res.headers={'content-type':'text/html'};
     respond(res);
     res.end(state.htmlByPath[url.pathname] ?? '<script type="application/ld+json">{"@type":"Event","name":"External Hackathon","startDate":"2026-10-26T12:00:00-05:00"}</script>');
     queueMicrotask(()=>req.emit('close'));
   });
   return req;
 }) };
});
import { importEventLink } from './external-event-link';
import { request } from 'node:https';
beforeEach(()=>{ state.all=true; state.addresses=['8.8.8.8']; state.lookup=undefined; state.htmlByPath={}; vi.clearAllMocks(); });
describe('DNS-pinned external event fetching',()=>{
 it('returns the address array expected by Node all-address lookup mode',async()=>{
   const result=await importEventLink('https://events.example.org/hackathon?utm_source=test');
   expect(state.lookup.address).toEqual([{address:'8.8.8.8',family:4}]);
   expect(result.draft.title).toBe('External Hackathon');
   expect(result.draft.startDate).toBe('2026-10-26T17:00:00.000Z');
 });
 it('keeps supporting single-address lookup mode',async()=>{
   state.all=false; await importEventLink('https://events.example.org/hackathon');
   expect(state.lookup).toEqual({address:'8.8.8.8',family:4});
 });
 it('follows a same-site canonical overlay page for schedule metadata',async()=>{
   state.htmlByPath['/events/overlay']='<title>Directory overlay</title><link rel="canonical" href="https://events.example.org/hackathon">';
   const result=await importEventLink('https://events.example.org/events/overlay');
   expect(request).toHaveBeenCalledTimes(2);
   expect(result.draft.title).toBe('External Hackathon');
   expect(result.draft.startDate).toBe('2026-10-26T17:00:00.000Z');
   expect(result.draft.partnerRegistrationUrl).toBe('https://events.example.org/hackathon');
 });
 it('ignores cross-site and unsafe canonical destinations',async()=>{
   for(const href of ['https://other.example.org/hackathon','http://events.example.org/hackathon','https://user:pass@events.example.org/hackathon','https://127.0.0.1/hackathon']) {
     vi.clearAllMocks(); state.htmlByPath['/overlay']='<title>Overlay</title><link rel="canonical" href="'+href+'">';
     const result=await importEventLink('https://events.example.org/overlay');
     expect(request).toHaveBeenCalledTimes(1); expect(result.draft.title).toBe('Overlay');
   }
 });
 it('does not follow canonical chains indefinitely',async()=>{
   state.htmlByPath['/overlay']='<link rel="canonical" href="/canonical"><title>Overlay</title>';
   state.htmlByPath['/canonical']='<link rel="canonical" href="/another"><title>Canonical event</title>';
   const result=await importEventLink('https://events.example.org/overlay');
   expect(request).toHaveBeenCalledTimes(2); expect(result.draft.title).toBe('Canonical event');
 });
 it('rejects private DNS answers before opening a connection',async()=>{
   state.addresses=['127.0.0.1'];
   await expect(importEventLink('https://events.example.org/hackathon')).rejects.toThrow(/not a public/);
   expect(request).not.toHaveBeenCalled();
 });
});
