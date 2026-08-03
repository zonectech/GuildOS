import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type WalletPayoutStatus = 'PENDING' | 'PAID' | 'REJECTED';

/**
 * A community's request to withdraw ticket earnings. GuildOS holds all ticket
 * money in the platform gateway account; admins settle payouts by bank
 * transfer and mark the request PAID here. Amounts are in KOBO.
 */
export type WalletPayoutDocument = {
  communityId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  /** Amount requested, kobo. */
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: WalletPayoutStatus;
  /** Admin note (e.g. transfer reference or rejection reason). */
  note: string;
  /** Our PYT- reference sent to the gateway for auto transfers ('' = manual payout). */
  transferReference: string;
  /** The gateway's transfer id (trf_…) for auto transfers. */
  transferRef: string;
  processedBy: mongoose.Types.ObjectId | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const walletPayoutSchema = new Schema<WalletPayoutDocument>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    bankName: { type: String, required: true, trim: true, maxlength: 120 },
    accountNumber: { type: String, required: true, trim: true, maxlength: 30 },
    accountName: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: ['PENDING', 'PAID', 'REJECTED'], default: 'PENDING', index: true },
    note: { type: String, default: '', maxlength: 500 },
    transferReference: { type: String, default: '' },
    transferRef: { type: String, default: '' },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

walletPayoutSchema.index({ communityId: 1, status: 1 });

export type WalletPayout = HydratedDocument<WalletPayoutDocument>;
type WalletPayoutModelType = Model<WalletPayoutDocument>;

export const WalletPayoutModel =
  (mongoose.models.WalletPayout as WalletPayoutModelType) ?? model<WalletPayoutDocument>('WalletPayout', walletPayoutSchema);
