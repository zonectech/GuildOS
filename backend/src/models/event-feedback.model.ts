import mongoose, { Schema, model, type Model } from 'mongoose';

/** Attendee feedback: one rating (1-5) + optional comment per attendee per rated unit.
 *  `day` 0 = the whole event (single-day events); 1..N = that day of a multi-day event
 *  (rated as each day ends, so organizers can fix issues before the next day). */
export type EventFeedbackDocument = {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  day: number;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
};

const eventFeedbackSchema = new Schema<EventFeedbackDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: Number, default: 0, min: 0 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true },
  },
  { timestamps: true, versionKey: false },
);

eventFeedbackSchema.index({ eventId: 1, userId: 1, day: 1 }, { unique: true });

export type EventFeedbackModelType = Model<EventFeedbackDocument>;

export const EventFeedbackModel =
  (mongoose.models.EventFeedback as EventFeedbackModelType) ?? model<EventFeedbackDocument>('EventFeedback', eventFeedbackSchema);
