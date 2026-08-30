import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type EventSponsorDocument = {
  eventId: mongoose.Types.ObjectId;
  name: string;
  logo: string;
  website: string;
  showOnCertificate: boolean;
  /** True when the deal was paid through the GuildOS gateway (verified sponsor). */
  paidViaPlatform: boolean;
  createdAt: Date;
};

const eventSponsorSchema = new Schema<EventSponsorDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: '', trim: true },
    website: { type: String, default: '', trim: true },
    showOnCertificate: { type: Boolean, default: false },
    paidViaPlatform: { type: Boolean, default: false },
    createdAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

export type EventSponsorModelType = Model<EventSponsorDocument>;
export type EventSponsorHydratedDocument = HydratedDocument<EventSponsorDocument>;

export const EventSponsorModel =
  (mongoose.models.EventSponsor as EventSponsorModelType) ?? model<EventSponsorDocument>('EventSponsor', eventSponsorSchema);
