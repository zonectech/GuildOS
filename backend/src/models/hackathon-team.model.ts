import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

/** A hackathon team. Solo builders are a team of one. */
export type HackathonTeamDocument = {
  eventId: mongoose.Types.ObjectId;
  name: string;
  /** Short code teammates use to join. */
  inviteCode: string;
  captainId: mongoose.Types.ObjectId;
  memberIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
};

const hackathonTeamSchema = new Schema<HackathonTeamDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    inviteCode: { type: String, required: true },
    captainId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    memberIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
  },
  { timestamps: true, versionKey: false },
);

hackathonTeamSchema.index({ eventId: 1, inviteCode: 1 }, { unique: true });
// Multikey unique index: a user can be on at most one team per hackathon.
hackathonTeamSchema.index({ eventId: 1, memberIds: 1 }, { unique: true });

export type HackathonTeamHydratedDocument = HydratedDocument<HackathonTeamDocument>;

export const HackathonTeamModel =
  (mongoose.models.HackathonTeam as Model<HackathonTeamDocument>) ??
  model<HackathonTeamDocument>('HackathonTeam', hackathonTeamSchema);
