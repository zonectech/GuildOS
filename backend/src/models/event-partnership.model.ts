import mongoose, { Schema, model, type Model } from 'mongoose';

export type EventPartnershipStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

/**
 * A co-hosting partnership between an event and another community.
 * Invited by an event manager; a senior leader of the invited community
 * accepts or declines. Accepted co-hosts gain event management rights and
 * appear on the event page and certificates.
 */
export type EventPartnershipDocument = {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  status: EventPartnershipStatus;
  respondedBy: mongoose.Types.ObjectId | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const eventPartnershipSchema = new Schema<EventPartnershipDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'DECLINED'], default: 'PENDING', index: true },
    respondedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

eventPartnershipSchema.index({ eventId: 1, communityId: 1 }, { unique: true });

export type EventPartnershipModelType = Model<EventPartnershipDocument>;

export const EventPartnershipModel =
  (mongoose.models.EventPartnership as EventPartnershipModelType) ??
  model<EventPartnershipDocument>('EventPartnership', eventPartnershipSchema);
