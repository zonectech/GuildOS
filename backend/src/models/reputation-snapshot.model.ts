import mongoose, { Schema, model, type Model } from 'mongoose';

export type ReputationSnapshotDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  period: string; // YYYY-MM
  guildScore: number;
  level: string;
  capturedAt: Date;
};

type ReputationSnapshotModelType = Model<ReputationSnapshotDocument>;

const reputationSnapshotSchema = new Schema<ReputationSnapshotDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    period: { type: String, required: true },
    guildScore: { type: Number, default: 0 },
    level: { type: String, default: 'Explorer Guild' },
    capturedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);

reputationSnapshotSchema.index({ userId: 1, period: 1 }, { unique: true });

export const ReputationSnapshotModel =
  (mongoose.models.ReputationSnapshot as ReputationSnapshotModelType) ??
  model<ReputationSnapshotDocument>('ReputationSnapshot', reputationSnapshotSchema);
