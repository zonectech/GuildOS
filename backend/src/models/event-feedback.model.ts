import mongoose, { Schema, model, type Model } from 'mongoose';

/** Post-event feedback: one rating (1-5) + optional comment per attendee. */
export type EventFeedbackDocument = {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
};

const eventFeedbackSchema = new Schema<EventFeedbackDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true },
  },
  { timestamps: true, versionKey: false },
);

eventFeedbackSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export type EventFeedbackModelType = Model<EventFeedbackDocument>;

export const EventFeedbackModel =
  (mongoose.models.EventFeedback as EventFeedbackModelType) ?? model<EventFeedbackDocument>('EventFeedback', eventFeedbackSchema);
