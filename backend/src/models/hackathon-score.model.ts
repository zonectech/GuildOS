import mongoose, { Schema, model, type Model } from 'mongoose';

/** One judge's scores for one submission: criterion key → 1–10. Re-scoring overwrites. */
export type HackathonScoreDocument = {
  eventId: mongoose.Types.ObjectId;
  submissionId: mongoose.Types.ObjectId;
  judgeId: mongoose.Types.ObjectId;
  scores: Record<string, number>;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
};

const hackathonScoreSchema = new Schema<HackathonScoreDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    submissionId: { type: Schema.Types.ObjectId, ref: 'HackathonSubmission', required: true },
    judgeId: { type: Schema.Types.ObjectId, required: true },
    scores: { type: Schema.Types.Mixed, default: {} },
    comment: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true, versionKey: false },
);

hackathonScoreSchema.index({ submissionId: 1, judgeId: 1 }, { unique: true });

export const HackathonScoreModel =
  (mongoose.models.HackathonScore as Model<HackathonScoreDocument>) ??
  model<HackathonScoreDocument>('HackathonScore', hackathonScoreSchema);
