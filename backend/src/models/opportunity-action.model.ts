import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type OpportunityActionType = 'SAVED' | 'INTERESTED' | 'APPLIED' | 'NOT_RELEVANT';

export type OpportunityActionDocument = {
  userId: mongoose.Types.ObjectId;
  opportunityId: mongoose.Types.ObjectId;
  action: OpportunityActionType;
  createdAt: Date;
  updatedAt: Date;
};

const opportunityActionSchema = new Schema<OpportunityActionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    opportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    action: { type: String, enum: ['SAVED', 'INTERESTED', 'APPLIED', 'NOT_RELEVANT'], required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// One current action per user per opportunity (upserted).
opportunityActionSchema.index({ userId: 1, opportunityId: 1 }, { unique: true });

export type OpportunityActionModelType = Model<OpportunityActionDocument>;
export type OpportunityActionHydratedDocument = HydratedDocument<OpportunityActionDocument>;

export const OpportunityActionModel =
  (mongoose.models.OpportunityAction as OpportunityActionModelType) ??
  model<OpportunityActionDocument>('OpportunityAction', opportunityActionSchema);
