import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

/**
 * Per-community mutex for wallet-spending operations (premium debits, payout
 * requests). MongoDB enforces the unique index atomically even on a standalone
 * (non-replica-set) deployment, so acquiring the lock is a single atomic insert
 * — no multi-document transaction needed. The TTL index is a crash safety net
 * only (if a process dies mid-operation without releasing, the lock self-clears
 * after 60s instead of blocking that community's wallet forever).
 */
export type WalletSpendLockDocument = {
  communityId: mongoose.Types.ObjectId;
  createdAt: Date;
};

const walletSpendLockSchema = new Schema<WalletSpendLockDocument>({
  communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 60 },
});

export type WalletSpendLock = HydratedDocument<WalletSpendLockDocument>;
type WalletSpendLockModelType = Model<WalletSpendLockDocument>;

export const WalletSpendLockModel =
  (mongoose.models.WalletSpendLock as WalletSpendLockModelType) ?? model<WalletSpendLockDocument>('WalletSpendLock', walletSpendLockSchema);
