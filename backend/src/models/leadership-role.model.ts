import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { CommunityRole } from './community.model';

export type LeadershipVerificationStatus = 'PENDING' | 'VERIFIED';

export type LeadershipRoleDocument = {
  membershipId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: CommunityRole;
  startDate: Date;
  endDate: Date | null;
  assignedBy: mongoose.Types.ObjectId | null;
  verificationStatus: LeadershipVerificationStatus;
  createdAt: Date;
};

const leadershipRoleSchema = new Schema<LeadershipRoleDocument>(
  {
    membershipId: { type: Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: ['MEMBER', 'VOLUNTEER', 'COORDINATOR', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'],
      required: true,
    },
    startDate: { type: Date, default: () => new Date() },
    endDate: { type: Date, default: null },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verificationStatus: { type: String, enum: ['PENDING', 'VERIFIED'], default: 'PENDING', index: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

export type LeadershipRoleModelType = Model<LeadershipRoleDocument>;
export type LeadershipRoleHydratedDocument = HydratedDocument<LeadershipRoleDocument>;

export const LeadershipRoleModel =
  (mongoose.models.LeadershipRole as LeadershipRoleModelType) ?? model<LeadershipRoleDocument>('LeadershipRole', leadershipRoleSchema);
