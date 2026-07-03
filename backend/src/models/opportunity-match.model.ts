import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type OpportunityMatchDocument = {
  userId: mongoose.Types.ObjectId;
  opportunityId: mongoose.Types.ObjectId;
  matchScore: number;
  matchReason: string;
  reasons: string[];
  generatedAt: Date;
};

const opportunityMatchSchema = new Schema<OpportunityMatchDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    opportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    matchScore: { type: Number, default: 0, index: true },
    matchReason: { type: String, default: '' },
    reasons: { type: [String], default: [] },
    generatedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

opportunityMatchSchema.index({ userId: 1, opportunityId: 1 }, { unique: true });

export type OpportunityMatchModelType = Model<OpportunityMatchDocument>;
export type OpportunityMatchHydratedDocument = HydratedDocument<OpportunityMatchDocument>;

export const OpportunityMatchModel =
  (mongoose.models.OpportunityMatch as OpportunityMatchModelType) ??
  model<OpportunityMatchDocument>('OpportunityMatch', opportunityMatchSchema);
