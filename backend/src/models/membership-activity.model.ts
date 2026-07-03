import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type MembershipActivityAction =
  | 'MEMBER_JOINED'
  | 'MEMBER_LEFT'
  | 'MEMBER_REMOVED'
  | 'ROLE_ASSIGNED'
  | 'ROLE_REMOVED'
  | 'STATUS_CHANGED';

export type MembershipActivityDocument = {
  membershipId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  action: MembershipActivityAction;
  actorId: mongoose.Types.ObjectId | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

const membershipActivitySchema = new Schema<MembershipActivityDocument>(
  {
    membershipId: { type: Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    action: {
      type: String,
      enum: ['MEMBER_JOINED', 'MEMBER_LEFT', 'MEMBER_REMOVED', 'ROLE_ASSIGNED', 'ROLE_REMOVED', 'STATUS_CHANGED'],
      required: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

export type MembershipActivityModelType = Model<MembershipActivityDocument>;
export type MembershipActivityHydratedDocument = HydratedDocument<MembershipActivityDocument>;

export const MembershipActivityModel =
  (mongoose.models.MembershipActivity as MembershipActivityModelType) ??
  model<MembershipActivityDocument>('MembershipActivity', membershipActivitySchema);
