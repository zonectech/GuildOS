import mongoose, { Schema, model, type Model } from 'mongoose';

export type ProfileViewSource = 'PROFILE' | 'CERTIFICATE';
export type ViewerRole = 'STUDENT' | 'COMMUNITY_LEADER' | 'RECRUITER' | 'ADMIN' | 'ANON';

export type ProfileViewDocument = {
  _id: mongoose.Types.ObjectId;
  targetUserId: mongoose.Types.ObjectId;
  viewerId: mongoose.Types.ObjectId | null;
  viewerRole: ViewerRole;
  source: ProfileViewSource;
  refId: string;
  /** Who viewed, for de-duplication: `u:<userId>` or `ip:<salted hash>` (raw IPs are never stored). */
  viewerKey?: string;
  /** UTC day (YYYY-MM-DD) of the view — one view per viewer per target per day. */
  viewDay?: string;
  createdAt: Date;
};

type ProfileViewModelType = Model<ProfileViewDocument>;

const profileViewSchema = new Schema<ProfileViewDocument>(
  {
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    viewerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    viewerRole: { type: String, enum: ['STUDENT', 'COMMUNITY_LEADER', 'RECRUITER', 'ADMIN', 'ANON'], default: 'ANON' },
    source: { type: String, enum: ['PROFILE', 'CERTIFICATE'], default: 'PROFILE' },
    refId: { type: String, default: '' },
    viewerKey: { type: String },
    viewDay: { type: String },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false },
);

profileViewSchema.index({ targetUserId: 1, createdAt: -1 });
// Refreshes and repeat visits by the same viewer on the same day count once. Partial so rows written
// before de-duplication existed (no viewDay) don't collide when the index is built.
profileViewSchema.index(
  { targetUserId: 1, viewerKey: 1, source: 1, refId: 1, viewDay: 1 },
  { unique: true, partialFilterExpression: { viewDay: { $type: 'string' } } },
);

export const ProfileViewModel =
  (mongoose.models.ProfileView as ProfileViewModelType) ?? model<ProfileViewDocument>('ProfileView', profileViewSchema);
