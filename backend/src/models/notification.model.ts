import mongoose, { Schema, model, type Model } from 'mongoose';

export type NotificationType =
  | 'POST_LIKE'
  | 'POST_COMMENT'
  | 'COMMUNITY_FOLLOW'
  | 'CERTIFICATE_EARNED'
  | 'JOIN_APPROVED'
  | 'SYSTEM';

export type NotificationDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId | null;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type NotificationModelType = Model<NotificationDocument>;

const notificationSchema = new Schema<NotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    type: {
      type: String,
      enum: ['POST_LIKE', 'POST_COMMENT', 'COMMUNITY_FOLLOW', 'CERTIFICATE_EARNED', 'JOIN_APPROVED', 'SYSTEM'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

export const NotificationModel =
  (mongoose.models.Notification as NotificationModelType) ?? model<NotificationDocument>('Notification', notificationSchema);
