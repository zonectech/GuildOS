import {dayKeyOf,isMultiDayEvent,requiredAttendanceDays,cancelledEventDays} from './event-shared';
const date=(value:any)=>value?new Date(value).getTime():NaN;
export function attendanceEligibility(event:any,registration:any,covered?:number[]|null,now=Date.now()) {
 if(registration.status!=='COMPLETED'||registration.certificateEligible!==true||!Number.isFinite(date(event.endDate))||date(event.endDate)>now)return false;
 const cancelled=new Set(cancelledEventDays(event));
 const ordinal=(day:string)=>{const index=(event.days||[]).findIndex((entry:any)=>entry.date&&dayKeyOf(new Date(entry.date),event.timezone)===day);if(index>=0)return index+1;if(!event.startDate)return 0;const n=Math.round((Date.parse(day)-Date.parse(dayKeyOf(new Date(event.startDate),event.timezone)))/86400000)+1;return n>0&&day<=dayKeyOf(new Date(event.endDate),event.timezone)?n:0;};
 const allowed=(day:string)=>{const n=ordinal(day);return n>0&&!cancelled.has(n)&&(!covered||covered.includes(n));};
 let days=new Set<string>();let minutes=0;
 if(event.attendanceSource==='EXTERNAL') {
  if(registration.attendanceEvidence!=='ORGANIZER_IMPORT')return false;
  for(const entry of registration.externalAttendance||[])if(allowed(entry.day)){days.add(entry.day);minutes+=Math.max(0,Number(entry.minutes)||0);}
 } else {
  const entries=(registration.attendanceDays||[]).length?registration.attendanceDays:[{day:registration.checkInAt?dayKeyOf(new Date(registration.checkInAt),event.timezone):'',checkInAt:registration.checkInAt,checkOutAt:registration.checkOutAt}];
  for(const entry of entries){const start=date(entry.checkInAt),end=date(entry.checkOutAt);if(!Number.isFinite(start)||!allowed(entry.day))continue;if(event.checkOutRequired&&(!Number.isFinite(end)||end<start))continue;days.add(entry.day);if(Number.isFinite(end)&&end>=start)minutes+=Math.max(0,Math.floor((Math.min(end,date(event.endDate))-Math.max(start,date(event.startDate)))/60000));}
  if(!isMultiDayEvent(event)&&event.checkOutRequired&&date(registration.checkOutAt)<date(event.endDate))return false;
 }
 const required=covered?Math.max(1,Math.min(requiredAttendanceDays(event),covered.filter(day=>!cancelled.has(day)).length)):requiredAttendanceDays(event);
 return days.size>0&&(!isMultiDayEvent(event)||days.size>=required)&&minutes>=(event.minimumAttendanceDuration||0);
}
