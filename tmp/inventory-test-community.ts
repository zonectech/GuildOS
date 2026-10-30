import mongoose from 'mongoose';
import { config } from '../backend/src/config';
async function main(){
 await mongoose.connect(config.mongoUri,{autoIndex:false,serverSelectionTimeoutMS:15000});
 const db=mongoose.connection.db!;
 const communities=await db.collection('communities').find({name:/(demo|test|sandbox)/i,archivedAt:null}).project({name:1,slug:1,verificationStatus:1,memberCount:1}).toArray();
 const ids=communities.map(c=>c._id);
 const members=await db.collection('memberships').find({communityId:{$in:ids},status:'ACTIVE',role:{$in:['OWNER','PRESIDENT','VICE_PRESIDENT','COORDINATOR']}}).project({communityId:1,userId:1,role:1}).toArray();
 const users=await db.collection('users').find({_id:{$in:members.map(m=>m.userId)},emailVerified:true,status:'ACTIVE',deletedAt:null,$or:[{communityAccessStatus:'APPROVED'},{role:'ADMIN'}]}).project({_id:1,role:1}).toArray();
 console.log(JSON.stringify({databaseName:db.databaseName,communities,memberships:members.filter(m=>users.some(u=>String(u._id)===String(m.userId)))},null,2));
 await mongoose.disconnect();
}
main().catch(async e=>{console.error(e.message);await mongoose.disconnect();process.exitCode=1});