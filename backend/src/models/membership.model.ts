import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { CommunityRole } from './community.model';

export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED' | 'LEFT';

export type MembershipDocument = {
  userId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  role: CommunityRole;
  status: MembershipStatus;
  joinedAt: Date;
  assignedBy: mongoose.Types.ObjectId | null;
  invitedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const membershipSchema = new Schema<MembershipDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    role: {
      type: String,
      enum: ['MEMBER', 'VOLUNTEER', 'COORDINATOR', 'ORGANIZER', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'],
      default: 'MEMBER',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'REMOVED', 'LEFT'],
      default: 'ACTIVE',
      index: true,
    },
    joinedAt: { type: Date, default: () => new Date() },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

membershipSchema.index({ userId: 1, communityId: 1 }, { unique: true });

export type MembershipModelType = Model<MembershipDocument>;
export type MembershipHydratedDocument = HydratedDocument<MembershipDocument>;

export const MembershipModel = (mongoose.models.Membership as MembershipModelType) ?? model<MembershipDocument>('Membership', membershipSchema);