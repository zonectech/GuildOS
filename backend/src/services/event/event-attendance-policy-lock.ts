import {EventRegistrationModel} from '../../models/event-registration.model';
const minute=(value:any)=>value?Math.floor(new Date(value).getTime()/60000):null;
const dayRules=(days:any[])=>days.map(day=>({date:minute(day.date),startTime:day.startTime||'',endTime:day.endTime||'',cancelled:Boolean(day.cancelled)}));
export async function assertAttendancePolicyEditable(event:any,input:any) {
 const changed=['minimumAttendanceDuration','minimumAttendanceDays','checkOutRequired','timezone'].some(key=>input[key]!==undefined&&JSON.stringify(input[key])!==JSON.stringify(event[key]))||['startDate','endDate'].some(key=>input[key]!==undefined&&minute(input[key])!==minute(event[key]))||(input.days!==undefined&&JSON.stringify(dayRules(input.days))!==JSON.stringify(dayRules(event.days||[])));
 if(!changed)return;
 const proof=await EventRegistrationModel.exists({eventId:event._id,$or:[{checkInAt:{$ne:null}},{'attendanceDays.0':{$exists:true}},{'externalAttendance.0':{$exists:true}},{certificateIssued:true}]});
 if(proof)throw new Error('Attendance requirements and schedule are locked after attendance is recorded. Correct the attendance report instead');
}
