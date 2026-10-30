import mongoose from 'mongoose';
import { config } from '../backend/src/config';
import { UserModel } from '../backend/src/models/user.model';
import { getPeopleYouMayKnow } from '../backend/src/services/connection.service';
async function main(){
 await mongoose.connect(config.mongoUri,{autoIndex:false,serverSelectionTimeoutMS:15000});
 const rows=await UserModel.find({deletedAt:null}).select('status profile.profileVisibility profile.username profileComplete').lean();
 const counts={total:rows.length,active:rows.filter(u=>u.status==='ACTIVE').length,public:rows.filter(u=>u.profile?.profileVisibility==='PUBLIC').length,private:rows.filter(u=>u.profile?.profileVisibility==='PRIVATE').length,unlisted:rows.filter(u=>u.profile?.profileVisibility==='UNLISTED').length,missingVisibility:rows.filter(u=>!u.profile?.profileVisibility).length,withUsername:rows.filter(u=>!!u.profile?.username).length};
 console.log(JSON.stringify({counts}));
 const examples=[];
 for (const user of rows.slice(0,8)) { const people=await getPeopleYouMayKnow(user._id.toString(),50); examples.push({active:user.status==='ACTIVE',visibility:user.profile?.profileVisibility??null,hasUsername:!!user.profile?.username,suggestionCount:people.length}); }
 console.log(JSON.stringify({examples}));
 await mongoose.disconnect();
}
main().catch(async error=>{console.error(error instanceof Error?error.message:'Discovery check failed');await mongoose.disconnect();process.exitCode=1;});
