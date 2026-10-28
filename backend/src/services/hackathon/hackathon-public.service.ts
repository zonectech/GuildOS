import { HackathonModel } from '../../models/hackathon.model';
import { UserModel } from '../../models/user.model';
export function publicJudge(judge:{_id:unknown;name:string},user?:any){
 const visible=user && user.status==='ACTIVE' && !user.deletedAt && user.profile?.profileVisibility==='PUBLIC' && user.profile?.username;
 return {id:String(judge._id),name:judge.name,username:visible?user.profile.username:'',avatar:visible?user.profile.avatar||'':''};
}
export async function getPublicHackathonJudges(eventId:string){
 const hackathon=await HackathonModel.findOne({eventId}).select('judges').lean();
 if(!hackathon)return [];
 const ids=hackathon.judges.map(j=>j.userId).filter(Boolean);
 const users=ids.length?await UserModel.find({_id:{$in:ids}}).select('status deletedAt profile.username profile.avatar profile.profileVisibility').lean():[];
 const byId=new Map(users.map(user=>[String(user._id),user]));
 return hackathon.judges.map(judge=>publicJudge(judge,judge.userId?byId.get(String(judge.userId)):undefined));
}
