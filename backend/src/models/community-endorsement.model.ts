import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type CommunityEndorsementDocument = {
  communityId: mongoose.Types.ObjectId;
  endorserId: mongoose.Types.ObjectId;
  note: string;
  createdAt: Date;
};

const communityEndorsementSchema = new Schema<CommunityEndorsementDocument>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    endorserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    note: { type: String, default: '' },
    createdAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

communityEndorsementSchema.index({ communityId: 1, endorserId: 1 }, { unique: true });

export type CommunityEndorsementModelType = Model<CommunityEndorsementDocument>;
export type CommunityEndorsementHydratedDocument = HydratedDocument<CommunityEndorsementDocument>;

export const CommunityEndorsementModel =
  (mongoose.models.CommunityEndorsement as CommunityEndorsementModelType) ?? model<CommunityEndorsementDocument>('CommunityEndorsement', communityEndorsementSchema);