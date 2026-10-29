import mongoose,{Schema,model} from 'mongoose';
const entry={_id:false,day:String,minutes:{type:Number,default:null}};
const schema=new Schema({eventId:{type:Schema.Types.ObjectId,required:true,index:true},registrationId:{type:Schema.Types.ObjectId,required:true,index:true},reportId:{type:Schema.Types.ObjectId,required:true},actorId:{type:Schema.Types.ObjectId,required:true},before:{type:[entry],default:[]},after:{type:[entry],default:[]},previousStatus:String,status:String},{timestamps:true,versionKey:false});
export const AttendanceCorrectionModel=mongoose.models.AttendanceCorrection||model('AttendanceCorrection',schema);
