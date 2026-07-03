import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type CommunityJoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type CommunityJoinRequestDocument = {
  userId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  status: CommunityJoinRequestStatus;
  requestedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: mongoose.Types.ObjectId | null;
  notes: string;
};

const communityJoinRequestSchema = new Schema<CommunityJoinRequestDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    requestedAt: { type: Date, default: () => new Date() },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: '' },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

communityJoinRequestSchema.index({ userId: 1, communityId: 1 }, { unique: true });

export type CommunityJoinRequestModelType = Model<CommunityJoinRequestDocument>;
export type CommunityJoinRequestHydratedDocument = HydratedDocument<CommunityJoinRequestDocument>;

export const CommunityJoinRequestModel =
  (mongoose.models.CommunityJoinRequest as CommunityJoinRequestModelType) ?? model<CommunityJoinRequestDocument>('CommunityJoinRequest', communityJoinRequestSchema);