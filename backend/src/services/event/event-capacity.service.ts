import mongoose from 'mongoose';
import {AsyncLocalStorage} from 'node:async_hooks';
import {EventModel} from '../../models/event.model';
import {EventRegistrationModel} from '../../models/event-registration.model';
import {TicketPaymentModel} from '../../models/ticket-payment.model';
import {TicketClaimModel} from '../../models/ticket-claim.model';
import {assertCommunityActive} from '../community-state-policy';
mongoose.set('transactionAsyncLocalStorage',true);
const context=new AsyncLocalStorage<{eventId:string;effects:Array<()=>unknown>}>();
export class EventCapacityError extends Error {}
export const TICKET_HOLD_MS=15*60_000;
export function afterEventCommit(effect:()=>unknown) {
 const current=context.getStore(); if(current){current.effects.push(effect);return Promise.resolve();}
 return Promise.resolve().then(effect).then(()=>undefined).catch(()=>console.warn('[GuildOS] event follow-up failed'));
}
export async function withEventMutation<T>(eventId:string,work:()=>Promise<T>,capacity=false,allowInactive=false):Promise<T> {
 const nested=context.getStore();
 if(nested){if(nested.eventId!==eventId)throw new Error('Cross-event mutation is not supported');return work();}
 let effects:Array<()=>unknown>=[];
 const result=await mongoose.connection.transaction(async session=>{
  effects=[];
  const locked=await EventModel.findOneAndUpdate({_id:eventId,...(allowInactive?{}:{deletedAt:null})},{$inc:{capacityRevision:1}},{new:true,session});
  if(!locked)throw new Error('Event not found');
  if(!allowInactive)await assertCommunityActive(locked.communityId);
  return context.run({eventId,effects},async()=>{const value=await work();if(capacity)await assertEventCapacity(eventId);return value;});
 });
 for(const effect of effects)await Promise.resolve().then(effect).catch(()=>console.warn('[GuildOS] event follow-up failed'));
 return result;
}
const ACTIVE=new Set(['CONFIRMED','CHECKED_IN','CHECKED_OUT','COMPLETED','PARTIAL_ATTENDANCE']);
type Allocation={sectionKey:string;days:number[];quantity:number;pendingApproval?:boolean};
export function capacityAllocations(event:any,registrations:any[],payments:any[],claims:any[],now=Date.now()) {
 const allocations:Allocation[]=[];const byId=new Map(registrations.map(reg=>[String(reg._id),reg]));
 for(const reg of registrations)if(ACTIVE.has(reg.status)||reg.status==='PENDING_APPROVAL')allocations.push({sectionKey:reg.sectionKey||'',days:reg.plannedDays||[],quantity:1,pendingApproval:reg.status==='PENDING_APPROVAL'});
 const tiers=new Map((event.ticketTiers||[]).map((tier:any)=>[tier.name,tier]));const tierUsage=new Map<string,number>();
 for(const payment of payments){
  const pending=payment.status==='PENDING'&&new Date(payment.capacityHoldExpiresAt||new Date(payment.createdAt).getTime()+TICKET_HOLD_MS).getTime()>now;
  if(!pending&&payment.status!=='PAID')continue;
  const quantity=Math.max(1,payment.quantity||1);const tier=tiers.get(payment.tierName) as any;
  tierUsage.set(payment.tierName||'',(tierUsage.get(payment.tierName||'')||0)+quantity);
  let extra=quantity;
  if(!pending){
   const buyer=byId.get(String(payment.registrationId))||registrations.find(reg=>String(reg.userId)===String(payment.userId));
   const guestActive=claims.filter(claim=>String(claim.paymentId)===String(payment._id)&&claim.registrationId&&ACTIVE.has(byId.get(String(claim.registrationId))?.status)).length;
   extra=(buyer?0:1)+Math.max(0,quantity-1-guestActive);
  }
  if(extra)allocations.push({sectionKey:payment.sectionKey||'',days:tier?.days||[],quantity:extra});
 }
 return {allocations,tierUsage};
}
export function checkCapacity(event:any,allocations:Allocation[],tierUsage=new Map<string,number>()) {
 const active=allocations.filter(row=>!row.pendingApproval);const total=active.reduce((sum,row)=>sum+row.quantity,0);
 if(event.capacity>0&&total>event.capacity)throw new EventCapacityError('This event is full. No seat was allocated');
 for(const section of event.sections||[])if(section.capacity>0&&allocations.filter(row=>row.sectionKey===section.key).reduce((sum,row)=>sum+row.quantity,0)>section.capacity)throw new EventCapacityError('The '+section.name+' section is full');
 for(const [index,day] of (event.days||[]).entries())if(!day.cancelled&&day.capacity>0&&allocations.filter(row=>!row.days.length||row.days.includes(index+1)).reduce((sum,row)=>sum+row.quantity,0)>day.capacity)throw new EventCapacityError('Day '+(index+1)+' is full');
 for(const tier of event.ticketTiers||[])if(tier.capacity>0&&(tierUsage.get(tier.name)||0)>tier.capacity)throw new EventCapacityError(tier.name+' is sold out');
}
export async function loadEventCapacity(eventId:string) {
 const event=await EventModel.findById(eventId).lean();if(!event)throw new Error('Event not found');
 // Transactions deliberately issue queries sequentially: no parallel operations on one session.
 const registrations=await EventRegistrationModel.find({eventId}).select('_id userId status sectionKey plannedDays').lean();
 const payments=await TicketPaymentModel.find({eventId,status:{$in:['PENDING','PAID']}}).select('_id userId registrationId status quantity tierName sectionKey createdAt capacityHoldExpiresAt').lean();
 const claims=await TicketClaimModel.find({eventId}).select('paymentId registrationId').lean();
 const usage=capacityAllocations(event,registrations,payments,claims);
 return {event,...usage};
}

export async function assertEventCapacity(eventId:string) {const usage=await loadEventCapacity(eventId);checkCapacity(usage.event,usage.allocations,usage.tierUsage);}
export async function canAllocateWaitlisted(eventId:string,registration:{sectionKey?:string;plannedDays?:number[]}) {
 const usage=await loadEventCapacity(eventId);
 try {checkCapacity(usage.event,[...usage.allocations,{sectionKey:registration.sectionKey||'',days:registration.plannedDays||[],quantity:1}],usage.tierUsage);return true;}catch(error){if(error instanceof EventCapacityError)return false;throw error;}
}
export async function promoteOneWaitlisted(eventId:string) {
 return withEventMutation(eventId,async()=>{
  const event=await EventModel.findById(eventId);if(!event?.waitlistEnabled)return null;
  const candidates=await EventRegistrationModel.find({eventId,status:'WAITLISTED'}).sort({registeredAt:1});
  for(const candidate of candidates)if(await canAllocateWaitlisted(eventId,candidate)){candidate.status='CONFIRMED';await candidate.save();return candidate;}
  return null;
 },true);
}
