import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type EventVolunteerDocument = {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  fullName: string;
  role: string;
  addedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
};

const eventVolunteerSchema = new Schema<EventVolunteerDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fullName: { type: String, default: '', trim: true },
    role: { type: String, default: '', trim: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

// One volunteer credit per user per event.
eventVolunteerSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export type EventVolunteerModelType = Model<EventVolunteerDocument>;
export type EventVolunteerHydratedDocument = HydratedDocument<EventVolunteerDocument>;

export const EventVolunteerModel =
  (mongoose.models.EventVolunteer as EventVolunteerModelType) ??
  model<EventVolunteerDocument>('EventVolunteer', eventVolunteerSchema);
