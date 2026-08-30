import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type SponsorshipPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'REFUND_DUE';

/**
 * One sponsorship deal paid through the platform gateway. GuildOS collects the
 * full amount, keeps `commissionAmount` (the sponsorship platform fee), and owes
 * the organizer's community `organizerAmount` — released via the community wallet
 * once the event completes (same escrow rule as ticket money).
 *
 * References are prefixed `SPN-` so the shared payment webhooks can route them.
 * All amounts are in KOBO like TicketPayment/PremiumPayment.
 */
export type SponsorshipPaymentDocument = {
  eventId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  inquiryId: mongoose.Types.ObjectId;
  provider: 'PAYSTACK' | 'FLUTTERWAVE';
  reference: string;
  companyName: string;
  sponsorEmail: string;
  /** Total charged to the sponsor (deal + gateway fee), kobo. */
  amount: number;
  /** Deal amount portion, kobo. */
  baseAmount: number;
  /** Gateway fee passed to the sponsor, kobo. */
  feeAmount: number;
  /** GuildOS sponsorship fee (percentage of the deal), kobo. */
  commissionAmount: number;
  /** What the organizer's community earns (base - commission), kobo. */
  organizerAmount: number;
  currency: string;
  status: SponsorshipPaymentStatus;
  paidAt: Date | null;
  refundedAt: Date | null;
  /** Gateway refund id, or 'MANUAL' when an admin settled it by bank transfer. */
  refundRef: string;
  createdAt: Date;
  updatedAt: Date;
};

const sponsorshipPaymentSchema = new Schema<SponsorshipPaymentDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    inquiryId: { type: Schema.Types.ObjectId, ref: 'SponsorshipInquiry', required: true, index: true },
    provider: { type: String, enum: ['PAYSTACK', 'FLUTTERWAVE'], required: true },
    reference: { type: String, required: true, unique: true, index: true },
    companyName: { type: String, required: true, trim: true },
    sponsorEmail: { type: String, required: true, trim: true, lowercase: true },
    amount: { type: Number, required: true },
    baseAmount: { type: Number, required: true },
    feeAmount: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    organizerAmount: { type: Number, required: true },
    currency: { type: String, default: 'NGN' },
    status: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'REFUND_DUE'], default: 'PENDING', index: true },
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    refundRef: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type SponsorshipPaymentModelType = Model<SponsorshipPaymentDocument>;
export type SponsorshipPaymentHydratedDocument = HydratedDocument<SponsorshipPaymentDocument>;

export const SponsorshipPaymentModel =
  (mongoose.models.SponsorshipPayment as SponsorshipPaymentModelType) ??
  model<SponsorshipPaymentDocument>('SponsorshipPayment', sponsorshipPaymentSchema);
