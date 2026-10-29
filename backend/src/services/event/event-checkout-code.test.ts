import {describe,it,expect,vi,beforeEach} from 'vitest';
vi.mock('./event-capacity.service',()=>({withEventMutation:vi.fn(async(_id:string,work:()=>Promise<unknown>)=>work())}));
const state=vi.hoisted(()=>({event:{} as any}));
vi.mock('./event-shared',()=>({requireEventManager:vi.fn(async()=>state.event)}));
vi.mock('../../models/event.model',()=>({EventModel:{updateOne:vi.fn(async()=>({}))}}));
import {EventModel} from '../../models/event.model';
import {requireEventManager} from './event-shared';
import {assertCheckoutCode,checkoutHash,setCheckoutCode,CHECKOUT_CODE_TTL} from './event-checkout-code';
const now=Date.now();const event={_id:'event',slug:'test',attendanceSource:'GUILDOS',qrEnabled:true,checkOutRequired:true,status:'CHECK_OUT',checkoutCodeHash:checkoutHash('event','12345678'),checkoutCodeExpiresAt:new Date(now+1000)};
beforeEach(()=>{vi.clearAllMocks();state.event={...event};});
describe('organizer displayed checkout code',()=>{
 it('accepts only the current event-scoped unexpired code',()=>{expect(()=>assertCheckoutCode(event,'12345678',now)).not.toThrow();expect(()=>assertCheckoutCode({...event,_id:'other'},'12345678',now)).toThrow(/invalid/);});
 it.each(['','1234567','123456789','87654321'])('rejects invalid code %s',code=>{expect(()=>assertCheckoutCode(event,code,now)).toThrow(/invalid/);});
 it('rejects expired, revoked and rotated codes',()=>{expect(()=>assertCheckoutCode(event,'12345678',now+1001)).toThrow(/expired/);expect(()=>assertCheckoutCode({...event,checkoutCodeHash:''},'12345678',now)).toThrow(/invalid/);expect(()=>assertCheckoutCode({...event,checkoutCodeHash:checkoutHash('event','87654321')},'12345678',now)).toThrow(/invalid/);});
 it.each([{attendanceSource:'EXTERNAL'},{qrEnabled:false},{checkOutRequired:false},{status:'CHECK_IN'},{status:'COMPLETED'}])('blocks incompatible event %j',change=>{expect(()=>assertCheckoutCode({...event,...change},'12345678',now)).toThrow(/not open/);});
 it('requires manager authorization and stores a hash instead of the displayed code',async()=>{const result=await setCheckoutCode('event','actor');expect(requireEventManager).toHaveBeenCalledWith('event','actor');expect(result.code).toMatch(/^\d{8}$/);expect(result.expiresAt!.getTime()).toBeGreaterThan(now);expect(result.expiresAt!.getTime()).toBeLessThanOrEqual(Date.now()+CHECKOUT_CODE_TTL);expect(EventModel.updateOne).toHaveBeenCalledWith({_id:'event'},{$set:{checkoutCodeHash:checkoutHash('event',result.code),checkoutCodeExpiresAt:result.expiresAt}});expect(result.url).toContain('?checkout='+result.code);});
 it('revokes the code when the organizer stops self-checkout',async()=>{await setCheckoutCode('event','actor',false);expect(EventModel.updateOne).toHaveBeenCalledWith({_id:'event'},{$set:{checkoutCodeHash:'',checkoutCodeExpiresAt:null}});});
 it('refuses to start while checkout is closed',async()=>{state.event.status='CHECK_IN';await expect(setCheckoutCode('event','actor')).rejects.toThrow(/Open check-out first/);expect(EventModel.updateOne).not.toHaveBeenCalled();});
});
