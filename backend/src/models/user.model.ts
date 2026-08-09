import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import type { ProfileData, UserRole } from '../types';

export type CommunityAccessStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type AccountStatus = 'ACTIVE' | 'BLOCKED';

export type UserDocument = {
  fullName: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  emailVerified: boolean;
  profile: ProfileData;
  onboardingCompleted: boolean;
  communityAccessStatus: CommunityAccessStatus;
  communityAccessNote: string;
  communityAccessEmail: string;
  communityAccessEmailVerified: boolean;
  communityAccessEmailCode: string;
  communityAccessEmailCodeExpires: Date | null;
  status: AccountStatus;
  blockedAt: Date | null;
  blockReason: string;
  /** Private iCal subscription token (CAL-…) — '' until the user first asks for their feed. */
  calendarToken: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const profileSchema = new Schema<ProfileData>(
  {
    username: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    bio: { type: String, default: '' },
    location: { type: String, default: '' },
    socialLinks: { type: [String], default: [] },
    graduationYear: { type: Number, default: null },
    profileVisibility: { type: String, default: 'PUBLIC' },
    showUniversity: { type: Boolean, default: true },
    showLeadership: { type: Boolean, default: true },
    showCertificates: { type: Boolean, default: true },
    showTimeline: { type: Boolean, default: true },
    availability: { type: String, enum: ['OPEN', 'CASUAL', 'CLOSED'], default: 'CLOSED' },
    jobSeeking: { type: Boolean, default: false },
    internshipSeeking: { type: Boolean, default: false },
    openToRelocation: { type: Boolean, default: false },
    preferredIndustries: { type: [String], default: [] },
    university: { type: String, default: '' },
    faculty: { type: String, default: '' },
    department: { type: String, default: '' },
    level: { type: String, default: '' },
    interests: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    avatar: { type: String, default: '' },
    coverImage: { type: String, default: '' },
  },
  { _id: false },
);

const userSchema = new Schema<UserDocument>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    role: { type: String, enum: ['STUDENT', 'COMMUNITY_LEADER', 'ADMIN', 'RECRUITER'], default: 'STUDENT' },
    emailVerified: { type: Boolean, default: false },
    profile: { type: profileSchema, default: () => ({}) },
  onboardingCompleted: { type: Boolean, default: false },
    communityAccessStatus: { type: String, enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'], default: 'NONE', index: true },
    communityAccessNote: { type: String, default: '' },
    communityAccessEmail: { type: String, default: '' },
    communityAccessEmailVerified: { type: Boolean, default: false },
    communityAccessEmailCode: { type: String, default: '' },
    communityAccessEmailCodeExpires: { type: Date, default: null },
    status: { type: String, enum: ['ACTIVE', 'BLOCKED'], default: 'ACTIVE', index: true },
    blockedAt: { type: Date, default: null },
    blockReason: { type: String, default: '' },
    calendarToken: { type: String, default: '', index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type UserModelType = Model<UserDocument>;
export type UserHydratedDocument = HydratedDocument<UserDocument>;

export const UserModel = (mongoose.models.User as UserModelType) ?? model<UserDocument>('User', userSchema);
