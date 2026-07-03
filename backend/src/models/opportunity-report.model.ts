import mongoose, { Schema, model, type Model } from 'mongoose';

export type OpportunityReportDocument = {
  _id: mongoose.Types.ObjectId;
  opportunityId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  reason: string;
  createdAt: Date;
};

type OpportunityReportModelType = Model<OpportunityReportDocument>;

const opportunityReportSchema = new Schema<OpportunityReportDocument>(
  {
    opportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, default: '' },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);

// One report per user per opportunity.
opportunityReportSchema.index({ opportunityId: 1, userId: 1 }, { unique: true });

export const OpportunityReportModel =
  (mongoose.models.OpportunityReport as OpportunityReportModelType) ??
  model<OpportunityReportDocument>('OpportunityReport', opportunityReportSchema);
