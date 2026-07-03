import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type GuildLevel =
  | 'Explorer Guild'
  | 'Bronze Guild'
  | 'Silver Guild'
  | 'Gold Guild'
  | 'Platinum Guild'
  | 'Elite Guild';

export type ReputationScoreDocument = {
  userId: mongoose.Types.ObjectId;
  guildScore: number;
  basePoints: number;
  attendanceScore: number;
  leadershipScore: number;
  volunteerScore: number;
  speakerScore: number;
  organizerScore: number;
  consistencyBonus: number;
  level: GuildLevel;
  nextLevelAt: number | null;
  badges: string[];
  // Denormalized for leaderboard display and scoping.
  fullName: string;
  username: string;
  avatar: string;
  university: string;
  faculty: string;
  department: string;
  availability: string;
  jobSeeking: boolean;
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const reputationScoreSchema = new Schema<ReputationScoreDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    guildScore: { type: Number, default: 0, index: true },
    basePoints: { type: Number, default: 0 },
    attendanceScore: { type: Number, default: 0 },
    leadershipScore: { type: Number, default: 0 },
    volunteerScore: { type: Number, default: 0 },
    speakerScore: { type: Number, default: 0 },
    organizerScore: { type: Number, default: 0 },
    consistencyBonus: { type: Number, default: 0 },
    level: {
      type: String,
      enum: ['Explorer Guild', 'Bronze Guild', 'Silver Guild', 'Gold Guild', 'Platinum Guild', 'Elite Guild'],
      default: 'Explorer Guild',
    },
    nextLevelAt: { type: Number, default: 100 },
    badges: { type: [String], default: [] },
    fullName: { type: String, default: '' },
    username: { type: String, default: '' },
    avatar: { type: String, default: '' },
    university: { type: String, default: '', index: true },
    faculty: { type: String, default: '' },
    department: { type: String, default: '' },
    availability: { type: String, default: 'CLOSED', index: true },
    jobSeeking: { type: Boolean, default: false },
    lastCalculatedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type ReputationScoreModelType = Model<ReputationScoreDocument>;
export type ReputationScoreHydratedDocument = HydratedDocument<ReputationScoreDocument>;

export const ReputationScoreModel =
  (mongoose.models.ReputationScore as ReputationScoreModelType) ??
  model<ReputationScoreDocument>('ReputationScore', reputationScoreSchema);
