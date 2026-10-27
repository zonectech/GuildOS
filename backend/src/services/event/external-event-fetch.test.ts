import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ all:true, addresses:['8.8.8.8'], lookup:undefined as any }));
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
     res.end('<script type="application/ld+json">{"@type":"Event","name":"External Hackathon","startDate":"2026-10-26T12:00:00-05:00"}</script>');
     queueMicrotask(()=>req.emit('close'));
   });
   return req;
 }) };
});
import { importEventLink } from './external-event-link';
import { request } from 'node:https';
beforeEach(()=>{ state.all=true; state.addresses=['8.8.8.8']; state.lookup=undefined; vi.clearAllMocks(); });
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
 it('rejects private DNS answers before opening a connection',async()=>{
   state.addresses=['127.0.0.1'];
   await expect(importEventLink('https://events.example.org/hackathon')).rejects.toThrow(/not a public/);
   expect(request).not.toHaveBeenCalled();
 });
});
