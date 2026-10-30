import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { config } from '../backend/src/config';
import { UserModel } from '../backend/src/models/user.model';
async function main(){
 const origin='https://guildos-three.vercel.app';
 const html=await (await fetch(origin+'/connections')).text();
 const scripts=[...html.matchAll(/src="([^" ]+\.js[^" ]*)"/g)].map(m=>m[1]);
 const hosts=new Set<string>();
 for(const path of scripts){const js=await(await fetch(new URL(path,origin))).text();for(const match of js.matchAll(/https:\/\/[a-zA-Z0-9.-]+(?:azurewebsites.net|vercel.app)/g)) hosts.add(match[0]);}
 console.log(JSON.stringify({frontendApiHosts:[...hosts]}));
 await mongoose.connect(config.mongoUri,{autoIndex:false,serverSelectionTimeoutMS:15000});
 const user=await UserModel.findOne({email:config.adminEmail.trim().toLowerCase(),status:'ACTIVE',deletedAt:null}).select('_id');
 if(!user) throw new Error('Configured account unavailable');
 const api=process.argv[2] || 'https://guildos-api.azurewebsites.net'; const health=await fetch(api+'/health');
 const serverNow=Math.floor(new Date(health.headers.get('date')||Date.now()).getTime()/1000);
 const token=jwt.sign({sub:user._id.toString(),purpose:'access',iat:serverNow,exp:serverNow+120},config.jwtSecret);
 const response=await fetch(api+'/api/connections/suggestions?limit=50',{headers:{authorization:'Bearer '+token}});
 const body=await response.json();
 console.log(JSON.stringify({status:response.status,suggestionCount:Array.isArray(body.suggestions)?body.suggestions.length:null,error:body.error??null}));
 await mongoose.disconnect();
}
main().catch(async()=>{console.error('Live API diagnostic failed');await mongoose.disconnect();process.exitCode=1;});
