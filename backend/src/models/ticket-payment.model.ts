import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type TicketPaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

/**
 * One paid-event ticket purchase. GuildOS collects the full amount through the
 * platform gateway, keeps `commissionAmount`, and owes the organizer's community
 * `organizerAmount` (settled off-platform for now — the payout ledger is these
 * PAID rows). All amounts are in KOBO like PremiumPayment.
 *
 * References are prefixed `TKT-` so the shared payment webhooks can route them.
 */
export type TicketPaymentDocument = {
  eventId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  registrationId: mongoose.Types.ObjectId | null;
  provider: 'PAYSTACK' | 'FLUTTERWAVE';
  reference: string;
  /** Tier bought ('' = single-price event). */
  tierName: string;
  /** Promo code redeemed ('' = none). */
  promoCode: string;
  /** Tickets in this purchase (1 = just the buyer; >1 creates claim links for guests). */
  quantity: number;
  /** Total charged to the buyer (ticket + gateway fee), kobo. */
  amount: number;
  /** Ticket price portion, kobo. */
  baseAmount: number;
  /** Gateway fee passed to the buyer, kobo. */
  feeAmount: number;
  /** GuildOS commission (percentage of the ticket price), kobo. */
  commissionAmount: number;
  /** What the organizer's community earns (base - commission), kobo. */
  organizerAmount: number;
  currency: string;
  status: TicketPaymentStatus;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const ticketPaymentSchema = new Schema<TicketPaymentDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    registrationId: { type: Schema.Types.ObjectId, ref: 'EventRegistration', default: null },
    provider: { type: String, enum: ['PAYSTACK', 'FLUTTERWAVE'], required: true },
    reference: { type: String, required: true, unique: true, index: true },
    tierName: { type: String, default: '', maxlength: 40 },
    promoCode: { type: String, default: '', maxlength: 20 },
    quantity: { type: Number, default: 1 },
    amount: { type: Number, required: true },
    baseAmount: { type: Number, default: 0 },
    feeAmount: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    organizerAmount: { type: Number, default: 0 },
    currency: { type: String, default: 'NGN' },
    status: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING', index: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

// NOTE: deliberately NO unique {eventId,userId} index — a buyer who cancels (no refund)
// may buy again later, which creates a second PAID row. Double-purchase is prevented at
// checkout by the "already registered" guard, and verification is idempotent per reference.
ticketPaymentSchema.index({ eventId: 1, userId: 1 });

export type TicketPaymentModelType = Model<TicketPaymentDocument>;
export type TicketPaymentHydratedDocument = HydratedDocument<TicketPaymentDocument>;

export const TicketPaymentModel =
  (mongoose.models.TicketPayment as TicketPaymentModelType) ?? model<TicketPaymentDocument>('TicketPayment', ticketPaymentSchema);
