import mongoose from 'mongoose';
import {UserModel} from '../../models/user.model';
import {EventSpeakerModel} from '../../models/event-speaker.model';
import {ReputationActivityModel} from '../../models/reputation-activity.model';
import {awardReputation,speakerReputation} from '../reputation.service';
type Days=Array<{cancelled?:boolean;facilitators?:Array<{userId?:unknown}>}>;
export function normalizeFacilitatorUserId(value:unknown){if(value===undefined||value===null||value==='')return null;if(typeof value!=='string'||!mongoose.Types.ObjectId.isValid(value))throw new Error('Choose a valid GuildOS facilitator account');return new mongoose.Types.ObjectId(value);}
export function facilitatorUserIds(days:Days=[],includeCancelled=false){return [...new Set(days.filter(day=>includeCancelled||!day.cancelled).flatMap(day=>(day.facilitators||[]).map(person=>person.userId?String(person.userId):'').filter(Boolean)))];}
export async function validateFacilitatorAccounts(days:Days=[]){const ids=facilitatorUserIds(days,true);if(!ids.length)return;const count=await UserModel.countDocuments({_id:{$in:ids},status:'ACTIVE',deletedAt:null});if(count!==ids.length)throw new Error('A linked facilitator account is unavailable. Remove or replace that account link');}
export async function hasEventSpeakingCredit(eventId:unknown,userId:unknown){const speakers=await EventSpeakerModel.find({eventId,userId}).select('_id').lean();return Boolean(await ReputationActivityModel.exists({userId,type:'SPEAKER_CONTRIBUTION',referenceId:{$in:[String(eventId),...speakers.map(s=>String(s._id))]}}));}
export async function awardEventFacilitators(event:{_id:unknown;communityId:unknown;title:string;attendanceFinalizedAt?:unknown;days?:Days}){
 if(!event.attendanceFinalizedAt)return;
 const ids=facilitatorUserIds(event.days);if(!ids.length)return;
 const active=await UserModel.find({_id:{$in:ids},status:'ACTIVE',deletedAt:null}).select('_id').lean();
 const speakers=await EventSpeakerModel.find({eventId:event._id,userId:{$in:ids}}).select('_id userId').lean();
 for(const user of active){const userId=String(user._id);const references=[String(event._id),...speakers.filter(s=>String(s.userId)===userId).map(s=>String(s._id))];if(await ReputationActivityModel.exists({userId,type:'SPEAKER_CONTRIBUTION',referenceId:{$in:references}}))continue;await awardReputation({userId,category:'SPEAKER',type:'SPEAKER_CONTRIBUTION',referenceId:String(event._id),communityId:String(event.communityId),scoreAwarded:speakerReputation('TRAINER'),description:'Facilitated '+event.title});}
}
