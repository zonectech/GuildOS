import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type TicketPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'REFUND_DUE';

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
  /** Section/track the buyer picked ('' = event has no sections). Guests from this order inherit it. */
  sectionKey: string;
  /** Username of whoever's referral link brought this buyer (''=organic). */
  referrer: string;
  /** Promo code redeemed ('' = none). */
  promoCode: string;
  /** Tickets in this purchase (1 = just the buyer; >1 creates claim links for guests). */
  quantity: number;
  /** Buyer's answers to the event's registration questions, copied onto the registration at fulfilment. */
  answers: { key: string; label: string; value: string }[];
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
  /** Set when the money went back to the buyer (or was queued for manual refund). */
  refundedAt: Date | null;
  /** Gateway refund id, or 'MANUAL' when an admin settled it by bank transfer. */
  refundRef: string;
  /**
   * Cumulative kobo already sent back via PARTIAL refunds (day cancellations on a
   * tier that still has live days). The live money fields (amount/baseAmount/
   * commissionAmount/organizerAmount) are REDUCED in place by each partial refund
   * so wallet + admin aggregates stay correct — this field is the audit trail.
   */
  refundedAmount: number;
  /** Tier days already compensated by a partial refund (guards double-refunds). */
  refundedDays: number[];
  /** Kobo owed to the buyer from a partial refund that failed at the gateway (admin settles manually). */
  refundDueAmount: number;
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
    sectionKey: { type: String, default: '', maxlength: 48 },
    referrer: { type: String, default: '', maxlength: 40 },
    promoCode: { type: String, default: '', maxlength: 20 },
    quantity: { type: Number, default: 1 },
    answers: {
      type: [{ _id: false, key: { type: String, default: '' }, label: { type: String, default: '' }, value: { type: String, default: '' } }],
      default: [],
    },
    amount: { type: Number, required: true },
    baseAmount: { type: Number, default: 0 },
    feeAmount: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    organizerAmount: { type: Number, default: 0 },
    currency: { type: String, default: 'NGN' },
    status: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'REFUND_DUE'], default: 'PENDING', index: true },
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    refundRef: { type: String, default: '' },
    refundedAmount: { type: Number, default: 0 },
    refundedDays: { type: [Number], default: [] },
    refundDueAmount: { type: Number, default: 0 },
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
