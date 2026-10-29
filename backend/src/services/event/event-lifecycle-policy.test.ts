import {describe,it,expect} from 'vitest';
import {assertEventFinalizable,assertAttendanceTransition,recordedMultiDayAttendance} from './event-lifecycle-policy';
const now=Date.parse('2026-10-28T12:00:00Z');
const live={status:'PUBLISHED',qrEnabled:true,attendanceSource:'GUILDOS',endDate:new Date(now+3600000)};
describe('event lifecycle guardrails',()=>{
 it.each(['GUILDOS','EXTERNAL'])('blocks early %s finalization',attendanceSource=>{expect(()=>assertEventFinalizable({...live,attendanceSource},now)).toThrow(/event ends/);});
 it.each(['DRAFT','ANNOUNCED','POSTPONED','ARCHIVED'])('rejects finalizing %s even after its scheduled end',status=>{expect(()=>assertEventFinalizable({...live,status,endDate:new Date(now-1)},now)).toThrow(/published/);});
 it('requires an end date and allows legitimate ended events',()=>{expect(()=>assertEventFinalizable({...live,endDate:null},now)).toThrow();expect(()=>assertEventFinalizable({...live,endDate:new Date(now)},now)).not.toThrow();});
 it.each(['DRAFT','ANNOUNCED','POSTPONED','COMPLETED','ARCHIVED'])('cannot open check-in from %s',status=>{expect(()=>assertAttendanceTransition({...live,status},'CHECK_IN',now)).toThrow();});
 it('rejects external or disabled check-in and checkout before check-in',()=>{expect(()=>assertAttendanceTransition({...live,attendanceSource:'EXTERNAL'},'CHECK_IN',now)).toThrow(/external/);expect(()=>assertAttendanceTransition({...live,qrEnabled:false},'CHECK_IN',now)).toThrow(/Enable/);expect(()=>assertAttendanceTransition(live,'CHECK_OUT',now)).toThrow(/check-in/);});
 it('allows attendance phases and reopening during a multi-day event',()=>{expect(()=>assertAttendanceTransition(live,'CHECK_IN',now)).not.toThrow();expect(()=>assertAttendanceTransition({...live,status:'CHECK_IN'},'CHECK_OUT',now)).not.toThrow();expect(()=>assertAttendanceTransition({...live,status:'CHECK_OUT'},'CHECK_IN',now)).not.toThrow();});
 it('cannot reopen check-in after the end or bypass dedicated actions',()=>{expect(()=>assertAttendanceTransition({...live,endDate:new Date(now-1)},'CHECK_IN',now)).toThrow(/ended/);expect(()=>assertAttendanceTransition(live,'COMPLETED',now)).toThrow(/dedicated/);});
});
describe('recorded multi-day attendance',()=>{
 it('does not invent duration or completed days for missing check-outs',()=>{expect(recordedMultiDayAttendance({attendanceDays:[{day:'2026-10-27',checkInAt:new Date(now-3600000),checkOutAt:null,minutes:999}]})).toMatchObject({minutes:0,completedDays:0,days:[{minutes:0}]});});
 it('counts real paired scans once per day, ignoring invalid pairs',()=>{expect(recordedMultiDayAttendance({attendanceDays:[{day:'a',checkInAt:new Date(now-3600000),checkOutAt:new Date(now)},{day:'a',checkInAt:new Date(now),checkOutAt:new Date(now)},{day:'b',checkInAt:new Date(now),checkOutAt:new Date(now-1)}]})).toMatchObject({minutes:60,completedDays:1});});
 it('reads attendance fields from subdocument getters rather than enumerable storage',()=>{const day=new class {get day(){return '2026-10-27';}get checkInAt(){return new Date(now-3600000);}get checkOutAt(){return new Date(now);}};expect(recordedMultiDayAttendance({attendanceDays:[day]})).toMatchObject({minutes:60,completedDays:1,days:[{day:'2026-10-27',checkInAt:new Date(now-3600000)}]});});
 it('preserves a recorded legacy check-in/check-out pair',()=>{expect(recordedMultiDayAttendance({checkInAt:new Date(now-3600000),checkOutAt:new Date(now)})).toMatchObject({minutes:60,completedDays:1});});
});
