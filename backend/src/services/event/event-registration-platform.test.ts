import {describe,it,expect} from 'vitest';import {applyEventInput} from './event-shared';
describe('external registration setup',()=>{
 it('requires a registration link when selecting external attendance',()=>{expect(()=>applyEventInput({attendanceSource:'GUILDOS'},{attendanceSource:'EXTERNAL'} as any)).toThrow(/link is required/);});
 it('disables all GuildOS attendance controls for an external event',()=>{const event:any={attendanceSource:'GUILDOS',qrEnabled:true,checkOutRequired:true,allowWalkIns:true};applyEventInput(event,{attendanceSource:'EXTERNAL',partnerRegistrationUrl:'https://example.com/event'} as any);expect(event).toMatchObject({attendanceSource:'EXTERNAL',qrEnabled:false,checkOutRequired:false,allowWalkIns:false});});
 it('rejects a non-https external registration link',()=>{expect(()=>applyEventInput({},{attendanceSource:'EXTERNAL',partnerRegistrationUrl:'javascript:alert(1)'} as any)).toThrow(/https/);});
 it('does not accept contradictory GuildOS mode plus an external link',()=>{expect(()=>applyEventInput({},{attendanceSource:'GUILDOS',partnerRegistrationUrl:'https://example.com/event'} as any)).toThrow(/Choose external/);});
});
