import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import type { ProfileData, UserRole } from '../types';

export type UserDocument = {
  fullName: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  emailVerified: boolean;
  profile: ProfileData;
  onboardingCompleted: boolean;
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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type UserModelType = Model<UserDocument>;
export type UserHydratedDocument = HydratedDocument<UserDocument>;

export const UserModel = (mongoose.models.User as UserModelType) ?? model<UserDocument>('User', userSchema);
