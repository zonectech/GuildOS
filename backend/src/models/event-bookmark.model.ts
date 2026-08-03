import mongoose, { Schema } from 'mongoose';

/** "Interested" — a saved event without registering. Feeds the my-events Saved section. */
export type EventBookmarkDocument = {
  userId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const eventBookmarkSchema = new Schema<EventBookmarkDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  },
  { timestamps: true },
);

eventBookmarkSchema.index({ userId: 1, eventId: 1 }, { unique: true });

export const EventBookmarkModel =
  (mongoose.models.EventBookmark as mongoose.Model<EventBookmarkDocument>) ||
  mongoose.model<EventBookmarkDocument>('EventBookmark', eventBookmarkSchema);
