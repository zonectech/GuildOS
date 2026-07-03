import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type RecruiterVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export type RecruiterProfileDocument = {
  userId: mongoose.Types.ObjectId;
  company: string;
  position: string;
  website: string;
  about: string;
  verified: boolean;
  verificationStatus: RecruiterVerificationStatus;
  verificationNote: string;
  verifiedAt: Date | null;
  verifiedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const recruiterProfileSchema = new Schema<RecruiterProfileDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    company: { type: String, required: true, trim: true },
    position: { type: String, default: '', trim: true },
    website: { type: String, default: '', trim: true },
    about: { type: String, default: '', trim: true },
    verified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'], default: 'UNVERIFIED', index: true },
    verificationNote: { type: String, default: '' },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type RecruiterProfileModelType = Model<RecruiterProfileDocument>;
export type RecruiterProfileHydratedDocument = HydratedDocument<RecruiterProfileDocument>;

export const RecruiterProfileModel =
  (mongoose.models.RecruiterProfile as RecruiterProfileModelType) ??
  model<RecruiterProfileDocument>('RecruiterProfile', recruiterProfileSchema);
