import {createHash,randomInt,timingSafeEqual} from 'node:crypto';
import {EventModel} from '../../models/event.model';
import {config} from '../../config';
import {requireEventManager} from './event-shared';
import {withEventMutation} from './event-capacity.service';
export const CHECKOUT_CODE_TTL=10*60_000;
export const checkoutHash=(eventId:string,code:string)=>createHash('sha256').update(eventId+':'+code).digest('hex');
export function assertCheckoutCode(event:any,code:unknown,now=Date.now()) {
 if(event.attendanceSource==='EXTERNAL'||!event.qrEnabled||!event.checkOutRequired||event.status!=='CHECK_OUT')throw new Error('Self-checkout is not open for this event');
 const value=typeof code==='string'?code.trim():'';
 const expected=Buffer.from(event.checkoutCodeHash||'','hex');const actual=Buffer.from(checkoutHash(String(event._id),value),'hex');
 if(!/^\d{8}$/.test(value)||!event.checkoutCodeExpiresAt||new Date(event.checkoutCodeExpiresAt).getTime()<=now||expected.length!==actual.length||!timingSafeEqual(expected,actual))throw new Error('Checkout code is invalid or expired. Ask the organizer for the current code');
}
export async function setCheckoutCode(eventId:string,actorId:string,enabled=true) {
 return withEventMutation(eventId,async()=>{
  const event=await requireEventManager(eventId,actorId);
  if(!enabled){await EventModel.updateOne({_id:eventId},{$set:{checkoutCodeHash:'',checkoutCodeExpiresAt:null}});return {code:'',expiresAt:null,url:''};}
  if(event.attendanceSource==='EXTERNAL'||!event.qrEnabled||!event.checkOutRequired||event.status!=='CHECK_OUT')throw new Error('Open check-out first. A GuildOS event with QR attendance and check-out enabled is required');
  const code=String(randomInt(0,100_000_000)).padStart(8,'0');const expiresAt=new Date(Date.now()+CHECKOUT_CODE_TTL);
  await EventModel.updateOne({_id:eventId},{$set:{checkoutCodeHash:checkoutHash(eventId,code),checkoutCodeExpiresAt:expiresAt}});
  return {code,expiresAt,url:config.frontendUrl+'/events/'+encodeURIComponent(event.slug)+'?checkout='+code+'#checkout'};
 });
}
