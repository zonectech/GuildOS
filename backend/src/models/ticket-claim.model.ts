import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

/**
 * One transferable guest ticket from a group purchase (quantity > 1).
 * The buyer gets `quantity - 1` claim links; each link registers one guest
 * with their own registration + personal check-in QR when claimed.
 */
export type TicketClaimDocument = {
  eventId: mongoose.Types.ObjectId;
  paymentId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  token: string;
  claimedBy: mongoose.Types.ObjectId | null;
  registrationId: mongoose.Types.ObjectId | null;
  claimedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const ticketClaimSchema = new Schema<TicketClaimDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'TicketPayment', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    claimedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    registrationId: { type: Schema.Types.ObjectId, ref: 'EventRegistration', default: null },
    claimedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

export type TicketClaim = HydratedDocument<TicketClaimDocument>;
type TicketClaimModelType = Model<TicketClaimDocument>;

export const TicketClaimModel =
  (mongoose.models.TicketClaim as TicketClaimModelType) ?? model<TicketClaimDocument>('TicketClaim', ticketClaimSchema);
