import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

/**
 * User-to-user block: the blocker no longer receives messages or connection
 * requests from the blocked user (and vice versa — a block severs contact BOTH
 * ways, which is what students expect from "block"). Admin-level account
 * blocking (user.status = BLOCKED) is separate and platform-wide.
 */
export type UserBlockDocument = {
  blockerId: mongoose.Types.ObjectId;
  blockedId: mongoose.Types.ObjectId;
  createdAt: Date;
};

const userBlockSchema = new Schema<UserBlockDocument>(
  {
    blockerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    blockedId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false, versionKey: false },
);

// One block per direction per pair.
userBlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

type UserBlockModelType = Model<UserBlockDocument>;
export type UserBlockHydratedDocument = HydratedDocument<UserBlockDocument>;

export const UserBlockModel =
  (mongoose.models.UserBlock as UserBlockModelType) ?? model<UserBlockDocument>('UserBlock', userBlockSchema);
