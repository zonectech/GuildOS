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
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false },
);

profileViewSchema.index({ targetUserId: 1, createdAt: -1 });

export const ProfileViewModel =
  (mongoose.models.ProfileView as ProfileViewModelType) ?? model<ProfileViewDocument>('ProfileView', profileViewSchema);
