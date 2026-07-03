import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import type { AuthTokenPurpose } from '../types';

export type AuthTokenDocument = {
  userId: mongoose.Types.ObjectId;
  purpose: AuthTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const authTokenSchema = new Schema<AuthTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AuthTokenModelType = Model<AuthTokenDocument>;
export type AuthTokenHydratedDocument = HydratedDocument<AuthTokenDocument>;

export const AuthTokenModel = (mongoose.models.AuthToken as AuthTokenModelType) ?? model<AuthTokenDocument>('AuthToken', authTokenSchema);
