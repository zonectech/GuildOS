import mongoose, { Schema, model } from 'mongoose';

export type EventPersonHostDocument = {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
const schema = new Schema<EventPersonHostDocument>({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'DECLINED'], default: 'PENDING' },
  respondedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });
schema.index({ eventId: 1, userId: 1 }, { unique: true });
export const EventPersonHostModel = mongoose.models.EventPersonHost as mongoose.Model<EventPersonHostDocument> || model<EventPersonHostDocument>('EventPersonHost', schema);
