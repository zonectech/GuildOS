import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

// Self-reported credentials a user uploads (e.g. a Coursera certificate, an
// internship letter, a past hackathon award). Deliberately kept SEPARATE from
// the `Certificate` model — those are cryptographically verifiable (serial +
// QR + revocation) GuildOS-issued diplomas; these are just files a user
// attaches to their own profile, with no verification chain whatsoever.
export type ExternalCredentialDocument = {
  userId: mongoose.Types.ObjectId;
  title: string;
  issuer: string;
  issueDate: Date | null;
  fileUrl: string;
  fileName: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

const externalCredentialSchema = new Schema<ExternalCredentialDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    issuer: { type: String, default: '', trim: true, maxlength: 140 },
    issueDate: { type: Date, default: null },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '', maxlength: 160 },
    description: { type: String, default: '', maxlength: 500 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

externalCredentialSchema.index({ userId: 1, createdAt: -1 });

export type ExternalCredentialModelType = Model<ExternalCredentialDocument>;
export type ExternalCredentialHydratedDocument = HydratedDocument<ExternalCredentialDocument>;

export const ExternalCredentialModel =
  (mongoose.models.ExternalCredential as ExternalCredentialModelType) ??
  model<ExternalCredentialDocument>('ExternalCredential', externalCredentialSchema);
