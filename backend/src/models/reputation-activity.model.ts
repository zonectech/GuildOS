import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type ReputationCategory = 'ATTENDANCE' | 'LEADERSHIP' | 'VOLUNTEER' | 'SPEAKER' | 'ORGANIZER';

export type ReputationActivityType =
  | 'EVENT_COMPLETED'
  | 'ROLE_ASSIGNED'
  | 'EVENT_ORGANIZED'
  | 'VOLUNTEER_CONTRIBUTION'
  | 'SPEAKER_CONTRIBUTION';

export type ReputationActivityDocument = {
  userId: mongoose.Types.ObjectId;
  category: ReputationCategory;
  type: ReputationActivityType;
  referenceId: mongoose.Types.ObjectId | null;
  communityId: mongoose.Types.ObjectId | null;
  scoreAwarded: number;
  description: string;
  createdAt: Date;
};

const reputationActivitySchema = new Schema<ReputationActivityDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: {
      type: String,
      enum: ['ATTENDANCE', 'LEADERSHIP', 'VOLUNTEER', 'SPEAKER', 'ORGANIZER'],
      required: true,
    },
    type: {
      type: String,
      enum: ['EVENT_COMPLETED', 'ROLE_ASSIGNED', 'EVENT_ORGANIZED', 'VOLUNTEER_CONTRIBUTION', 'SPEAKER_CONTRIBUTION'],
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', default: null },
    scoreAwarded: { type: Number, default: 0 },
    description: { type: String, default: '' },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

// Dedupe guard: one award per (user, type, reference).
reputationActivitySchema.index({ userId: 1, type: 1, referenceId: 1 }, { unique: true });

export type ReputationActivityModelType = Model<ReputationActivityDocument>;
export type ReputationActivityHydratedDocument = HydratedDocument<ReputationActivityDocument>;

export const ReputationActivityModel =
  (mongoose.models.ReputationActivity as ReputationActivityModelType) ??
  model<ReputationActivityDocument>('ReputationActivity', reputationActivitySchema);
