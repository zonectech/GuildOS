import mongoose, { Schema } from 'mongoose';

/**
 * One browser/device push subscription per document. A user can have several
 * (phone + laptop). Endpoint is globally unique per the Push API spec.
 */
export type PushSubscriptionDocument = {
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
};

const pushSubscriptionSchema = new Schema<PushSubscriptionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true },
);

export const PushSubscriptionModel =
  (mongoose.models.PushSubscription as mongoose.Model<PushSubscriptionDocument>) ||
  mongoose.model<PushSubscriptionDocument>('PushSubscription', pushSubscriptionSchema);
