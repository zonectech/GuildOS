import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type SpeakerType = 'WORKSHOP' | 'PANEL' | 'GUEST' | 'TRAINER';

export type EventSpeakerDocument = {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | null;
  speakerType: SpeakerType;
  /** 1-based day of a multi-day event this speaker appears on (null = whole event). */
  day: number | null;
  /** Section/track this speaker/trainer is assigned to ('' = whole event). */
  sectionKey: string;
  fullName: string;
  title: string;
  organization: string;
  bio: string;
  photo: string;
  linkedinUrl: string;
  createdAt: Date;
};

const eventSpeakerSchema = new Schema<EventSpeakerDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    speakerType: { type: String, enum: ['WORKSHOP', 'PANEL', 'GUEST', 'TRAINER'], default: 'GUEST' },
    day: { type: Number, default: null },
    sectionKey: { type: String, default: '', trim: true },
    fullName: { type: String, required: true, trim: true },
    title: { type: String, default: '', trim: true },
    organization: { type: String, default: '', trim: true },
    bio: { type: String, default: '', trim: true },
    photo: { type: String, default: '', trim: true },
    linkedinUrl: { type: String, default: '', trim: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

export type EventSpeakerModelType = Model<EventSpeakerDocument>;
export type EventSpeakerHydratedDocument = HydratedDocument<EventSpeakerDocument>;

export const EventSpeakerModel =
  (mongoose.models.EventSpeaker as EventSpeakerModelType) ?? model<EventSpeakerDocument>('EventSpeaker', eventSpeakerSchema);
