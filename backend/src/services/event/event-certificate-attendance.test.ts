import {describe,it,expect} from 'vitest';import {assertCertificateAttendance,applyEventInput} from './event-shared';
describe('certificate attendance configuration',()=>{
 it('rejects certificates without GuildOS check-in or external attendance',()=>{expect(()=>assertCertificateAttendance({certificateEnabled:true,qrEnabled:false,attendanceSource:'GUILDOS'})).toThrow(/check-in/);});
 it('allows configured GuildOS check-in',()=>{expect(()=>assertCertificateAttendance({certificateEnabled:true,qrEnabled:true,attendanceSource:'GUILDOS'})).not.toThrow();});
 it('allows externally matched attendance without GuildOS QR',()=>{expect(()=>assertCertificateAttendance({certificateEnabled:true,qrEnabled:false,attendanceSource:'EXTERNAL'})).not.toThrow();});
 it('allows events with certificates off',()=>{expect(()=>assertCertificateAttendance({certificateEnabled:false,qrEnabled:false,attendanceSource:'GUILDOS'})).not.toThrow();});
 it('rejects disabling check-in on an existing certificate event',()=>{expect(()=>applyEventInput({certificateEnabled:true,qrEnabled:true,attendanceSource:'GUILDOS'},{qrEnabled:false} as any)).toThrow(/check-in/);});
});