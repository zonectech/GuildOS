import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type PremiumPaymentStatus = 'PENDING' | 'PAID' | 'FAILED';
export type PremiumPaymentScope = 'MONTHLY' | 'EVENT';

export type PremiumPaymentDocument = {
  communityId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId | null;
  scope: PremiumPaymentScope;
  initiatedBy: mongoose.Types.ObjectId;
  provider: string;
  reference: string;
  amount: number; // total charged, in the smallest currency unit (kobo)
  baseAmount: number; // the premium price before gateway fee (kobo)
  feeAmount: number; // the gateway fee passed to the buyer (kobo)
  currency: string;
  status: PremiumPaymentStatus;
  periodStart: Date | null;
  periodEnd: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const premiumPaymentSchema = new Schema<PremiumPaymentDocument>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', default: null, index: true },
    scope: { type: String, enum: ['MONTHLY', 'EVENT'], default: 'MONTHLY', index: true },
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, default: 'PAYSTACK' },
    reference: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    baseAmount: { type: Number, default: 0 },
    feeAmount: { type: Number, default: 0 },
    currency: { type: String, default: 'NGN' },
    status: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING', index: true },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type PremiumPaymentModelType = Model<PremiumPaymentDocument>;
export type PremiumPaymentHydratedDocument = HydratedDocument<PremiumPaymentDocument>;

export const PremiumPaymentModel =
  (mongoose.models.PremiumPayment as PremiumPaymentModelType) ??
  model<PremiumPaymentDocument>('PremiumPayment', premiumPaymentSchema);
