import mongoose, { Schema, model, type Model } from 'mongoose';

export type EventCreationGuardDocument = {
  key: string;
  windowStart: Date;
  windowCount: number;
  nextAllowedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const eventCreationGuardSchema = new Schema<EventCreationGuardDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    windowStart: { type: Date, required: true },
    windowCount: { type: Number, required: true, default: 0 },
    nextAllowedAt: { type: Date, required: true, default: () => new Date(0) },
  },
  { timestamps: true, versionKey: false },
);

export type EventCreationGuardModelType = Model<EventCreationGuardDocument>;
export const EventCreationGuardModel =
  (mongoose.models.EventCreationGuard as EventCreationGuardModelType) ??
  model<EventCreationGuardDocument>('EventCreationGuard', eventCreationGuardSchema);