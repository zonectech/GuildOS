import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type SponsorshipInquiryStatus = 'NEW' | 'CONTACTED' | 'WON' | 'CLOSED';
export type SponsorshipFeeStatus = 'NONE' | 'PENDING' | 'PAID';

export type SponsorshipInquiryDocument = {
  eventId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  packageName: string;
  message: string;
  dealNote: string;
  packageWon: string;
  dealAmount: number;
  feeStatus: SponsorshipFeeStatus;
  status: SponsorshipInquiryStatus;
  /** When the organizer first moved this inquiry out of NEW (responsiveness signal). */
  firstRespondedAt: Date | null;
  /** When the stale-inquiry reminder was sent (one reminder per inquiry). */
  staleRemindedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const sponsorshipInquirySchema = new Schema<SponsorshipInquiryDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    companyName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '', trim: true },
    website: { type: String, default: '', trim: true },
    packageName: { type: String, default: '', trim: true },
    message: { type: String, default: '', trim: true },
    dealNote: { type: String, default: '', trim: true },
    packageWon: { type: String, default: '', trim: true },
    dealAmount: { type: Number, default: 0 },
    feeStatus: { type: String, enum: ['NONE', 'PENDING', 'PAID'], default: 'NONE' },
    status: { type: String, enum: ['NEW', 'CONTACTED', 'WON', 'CLOSED'], default: 'NEW', index: true },
    firstRespondedAt: { type: Date, default: null },
    staleRemindedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type SponsorshipInquiryModelType = Model<SponsorshipInquiryDocument>;
export type SponsorshipInquiryHydratedDocument = HydratedDocument<SponsorshipInquiryDocument>;

export const SponsorshipInquiryModel =
  (mongoose.models.SponsorshipInquiry as SponsorshipInquiryModelType) ??
  model<SponsorshipInquiryDocument>('SponsorshipInquiry', sponsorshipInquirySchema);
