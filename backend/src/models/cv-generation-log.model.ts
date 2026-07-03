import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type CvGenerationLogDocument = {
  userId: mongoose.Types.ObjectId;
  cvId: string;
  promptVersion: string;
  mode: string;
  template: string;
  sourceCertificates: number;
  sourceRoles: number;
  sourceEvents: number;
  aiGenerated: boolean;
  generatedAt: Date;
};

const cvGenerationLogSchema = new Schema<CvGenerationLogDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cvId: { type: String, required: true, index: true },
    promptVersion: { type: String, default: 'cv-v1' },
    mode: { type: String, default: '' },
    template: { type: String, default: '' },
    sourceCertificates: { type: Number, default: 0 },
    sourceRoles: { type: Number, default: 0 },
    sourceEvents: { type: Number, default: 0 },
    aiGenerated: { type: Boolean, default: false },
    generatedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

export type CvGenerationLogModelType = Model<CvGenerationLogDocument>;
export type CvGenerationLogHydratedDocument = HydratedDocument<CvGenerationLogDocument>;

export const CvGenerationLogModel =
  (mongoose.models.CvGenerationLog as CvGenerationLogModelType) ??
  model<CvGenerationLogDocument>('CvGenerationLog', cvGenerationLogSchema);
