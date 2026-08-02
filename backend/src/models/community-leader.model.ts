import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

/**
 * A curated leadership-team entry for a community's public profile. Unlike
 * `Membership` (which gates real permissions and requires a registered
 * account), a CommunityLeader is a free-text roster entry a VP+ writes in —
 * school societies elect officers every session and want to list them by
 * name even when that person has never signed up for GuildOS. If the person
 * *does* have a GuildOS account, `linkedUserId` optionally tags/links it so
 * viewers can see "On GuildOS" and open their public profile.
 */
export type CommunityLeaderDocument = {
  communityId: mongoose.Types.ObjectId;
  name: string;
  title: string;
  session: string;
  bio: string;
  photo: string;
  phone: string;
  department: string;
  level: string;
  displayRank: number | null;
  linkedUserId: mongoose.Types.ObjectId | null;
  /**
   * ACTIVE = currently serving, shown on the Leadership Team card for their session.
   * ARCHIVED = this ONE person left/was removed from the post before their session ended
   *   (resignation, replacement, etc.) — an individual exception, not a session-wide event.
   * PAST = their whole session was dissolved (the normal end-of-term transition) — everyone
   *   who was serving that session moves to PAST together when a new session begins.
   */
  status: 'ACTIVE' | 'ARCHIVED' | 'PAST';
  addedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const communityLeaderSchema = new Schema<CommunityLeaderDocument>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    title: { type: String, default: '', trim: true, maxlength: 80 },
    session: { type: String, default: '', trim: true, maxlength: 40 },
    bio: { type: String, default: '', trim: true, maxlength: 280 },
    photo: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    department: { type: String, default: '', trim: true, maxlength: 80 },
    level: { type: String, default: '', trim: true, maxlength: 40 },
    displayRank: { type: Number, default: null },
    linkedUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['ACTIVE', 'ARCHIVED', 'PAST'], default: 'ACTIVE', index: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

communityLeaderSchema.index({ communityId: 1, displayRank: 1 });

export type CommunityLeaderModelType = Model<CommunityLeaderDocument>;
export type CommunityLeaderHydratedDocument = HydratedDocument<CommunityLeaderDocument>;

export const CommunityLeaderModel =
  (mongoose.models.CommunityLeader as CommunityLeaderModelType) ?? model<CommunityLeaderDocument>('CommunityLeader', communityLeaderSchema);
