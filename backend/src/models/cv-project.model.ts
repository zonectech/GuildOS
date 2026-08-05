import mongoose, { Schema, model, type Model } from 'mongoose';

/**
 * A user's persistent projects collection — outlives any single CV generation.
 * The CV builder pre-fills from here and writes back on save, so projects stop
 * being retyped for every new CV.
 */
export type CvProjectDocument = {
  userId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  url: string;
  role: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

const cvProjectSchema = new Schema<CvProjectDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 140 },
    description: { type: String, default: '', maxlength: 600 },
    url: { type: String, default: '', maxlength: 300 },
    role: { type: String, default: '', maxlength: 100 },
    position: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

cvProjectSchema.index({ userId: 1, position: 1 });

export const CvProjectModel =
  (mongoose.models.CvProject as Model<CvProjectDocument>) ?? model<CvProjectDocument>('CvProject', cvProjectSchema);
