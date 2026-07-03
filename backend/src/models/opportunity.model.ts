import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type OpportunityCategory =
  | 'INTERNSHIP'
  | 'SCHOLARSHIP'
  | 'FELLOWSHIP'
  | 'CAMPUS_ROLE'
  | 'COMPETITION'
  | 'CONFERENCE'
  | 'OPEN_SOURCE';

export type OpportunityStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type OpportunityModerationStatus = 'PENDING_REVIEW' | 'VERIFIED' | 'FLAGGED' | 'ARCHIVED';

export type OpportunityEligibility = {
  minGuildScore: number;
  minLeadershipRoles: number;
  minCertificates: number;
  universities: string[];
  departments: string[];
  levels: string[];
  graduationYears: number[];
};

export type OpportunityDocument = {
  title: string;
  description: string;
  category: OpportunityCategory;
  organization: string;
  location: string;
  deadline: Date | null;
  tags: string[];
  eligibility: OpportunityEligibility;
  applicationUrl: string;
  status: OpportunityStatus;
  moderationStatus: OpportunityModerationStatus;
  source: string;
  externalId: string;
  recruiterVerified: boolean;
  postedBy: mongoose.Types.ObjectId | null;
  saveCount: number;
  applyCount: number;
  viewCount: number;
  reportCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const opportunitySchema = new Schema<OpportunityDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: {
      type: String,
      enum: ['INTERNSHIP', 'SCHOLARSHIP', 'FELLOWSHIP', 'CAMPUS_ROLE', 'COMPETITION', 'CONFERENCE', 'OPEN_SOURCE'],
      required: true,
      index: true,
    },
    organization: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    deadline: { type: Date, default: null, index: true },
    tags: { type: [String], default: [], index: true },
    eligibility: {
      minGuildScore: { type: Number, default: 0 },
      minLeadershipRoles: { type: Number, default: 0 },
      minCertificates: { type: Number, default: 0 },
      universities: { type: [String], default: [] },
      departments: { type: [String], default: [] },
      levels: { type: [String], default: [] },
      graduationYears: { type: [Number], default: [] },
    },
    applicationUrl: { type: String, default: '' },
    status: { type: String, enum: ['DRAFT', 'OPEN', 'CLOSED'], default: 'OPEN', index: true },
    moderationStatus: { type: String, enum: ['PENDING_REVIEW', 'VERIFIED', 'FLAGGED', 'ARCHIVED'], default: 'VERIFIED', index: true },
    source: { type: String, default: 'MANUAL', index: true },
    externalId: { type: String, default: '' },
    recruiterVerified: { type: Boolean, default: false },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    saveCount: { type: Number, default: 0 },
    applyCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Dedup ingested listings by provider + external id (manual entries have no externalId).
opportunitySchema.index(
  { source: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $gt: '' } } },
);

export type OpportunityModelType = Model<OpportunityDocument>;
export type OpportunityHydratedDocument = HydratedDocument<OpportunityDocument>;

export const OpportunityModel =
  (mongoose.models.Opportunity as OpportunityModelType) ?? model<OpportunityDocument>('Opportunity', opportunitySchema);
