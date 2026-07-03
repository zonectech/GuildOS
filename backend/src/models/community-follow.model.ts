import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type CommunityFollowDocument = {
  userId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  createdAt: Date;
};

const communityFollowSchema = new Schema<CommunityFollowDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);

communityFollowSchema.index({ userId: 1, communityId: 1 }, { unique: true });

export type CommunityFollowModelType = Model<CommunityFollowDocument>;
export type CommunityFollowHydratedDocument = HydratedDocument<CommunityFollowDocument>;

export const CommunityFollowModel =
  (mongoose.models.CommunityFollow as CommunityFollowModelType) ??
  model<CommunityFollowDocument>('CommunityFollow', communityFollowSchema);
