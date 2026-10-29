import mongoose, { Schema, model } from 'mongoose';
export type EventAlertDelivery = {
  eventId: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId;
  channel: 'NOTIFICATION' | 'EMAIL'; status: 'PENDING' | 'PROCESSING' | 'SENT' | 'SKIPPED';
  priorAttendee: boolean;
  attempts: number; nextAttemptAt: Date; leaseUntil: Date | null; leaseToken: string;
  sentAt: Date | null; lastError: string; createdAt: Date; updatedAt: Date;
};
const schema = new Schema<EventAlertDelivery>({
  eventId: {type: Schema.Types.ObjectId, ref: 'Event', required: true},
  userId: {type: Schema.Types.ObjectId, ref: 'User', required: true},
  channel: {type: String, enum: ['NOTIFICATION','EMAIL'], required: true},
  status: {type: String, enum: ['PENDING','PROCESSING','SENT','SKIPPED'], default: 'PENDING'},
  priorAttendee: {type: Boolean, default: false},
  attempts: {type: Number, default: 0}, nextAttemptAt: {type: Date, default: Date.now},
  leaseUntil: {type: Date, default: null}, leaseToken: {type: String, default: ''},
  sentAt: {type: Date, default: null}, lastError: {type: String, default: ''},
}, {timestamps: true});
schema.index({eventId:1,userId:1,channel:1},{unique:true});
schema.index({status:1,nextAttemptAt:1,leaseUntil:1});
export const EventAlertDeliveryModel = mongoose.models.EventAlertDelivery as mongoose.Model<EventAlertDelivery> || model<EventAlertDelivery>('EventAlertDelivery',schema);
