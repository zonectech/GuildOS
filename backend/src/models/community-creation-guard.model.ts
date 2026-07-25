import mongoose, { Schema, model, type Model } from 'mongoose';

export type CommunityCreationGuardDocument = {
  userId: mongoose.Types.ObjectId;
  windowStart: Date;
  windowCount: number;
  nextAllowedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const communityCreationGuardSchema = new Schema<CommunityCreationGuardDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    windowStart: { type: Date, required: true },
    windowCount: { type: Number, required: true, default: 0 },
    nextAllowedAt: { type: Date, required: true, default: () => new Date(0) },
  },
  { timestamps: true, versionKey: false },
);

export type CommunityCreationGuardModelType = Model<CommunityCreationGuardDocument>;
export const CommunityCreationGuardModel =
  (mongoose.models.CommunityCreationGuard as CommunityCreationGuardModelType) ??
  model<CommunityCreationGuardDocument>('CommunityCreationGuard', communityCreationGuardSchema);