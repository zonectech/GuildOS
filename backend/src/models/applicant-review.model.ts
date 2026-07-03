import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type ApplicantReviewStatus = 'NEW' | 'SHORTLISTED' | 'CONTACTED' | 'REJECTED' | 'HIRED';

export type ApplicantReviewDocument = {
  opportunityId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  reviewerId: mongoose.Types.ObjectId;
  status: ApplicantReviewStatus;
  note: string;
  createdAt: Date;
  updatedAt: Date;
};

const applicantReviewSchema = new Schema<ApplicantReviewDocument>(
  {
    opportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['NEW', 'SHORTLISTED', 'CONTACTED', 'REJECTED', 'HIRED'], default: 'NEW' },
    note: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

applicantReviewSchema.index({ opportunityId: 1, candidateId: 1 }, { unique: true });

export type ApplicantReviewModelType = Model<ApplicantReviewDocument>;
export type ApplicantReviewHydratedDocument = HydratedDocument<ApplicantReviewDocument>;

export const ApplicantReviewModel =
  (mongoose.models.ApplicantReview as ApplicantReviewModelType) ??
  model<ApplicantReviewDocument>('ApplicantReview', applicantReviewSchema);
