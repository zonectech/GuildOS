import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { CHAT_PLATFORMS, type ChatLink } from '../utils/chat-links';

export type CommunityVisibility = 'PUBLIC' | 'PRIVATE';
export type CommunityVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type CommunityVerificationMethod = 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL' | null;
export type CommunityRole = 'MEMBER' | 'VOLUNTEER' | 'COORDINATOR' | 'SECRETARY' | 'TREASURER' | 'VICE_PRESIDENT' | 'PRESIDENT' | 'FOUNDER';
export type CommunityChatLink = ChatLink;

export type CommunityDocument = {
  name: string;
  normalizedName: string;
  slug: string;
  shortDescription: string;
  description: string;
  logo: string;
  coverImage: string;
  category: string;
  university: string;
  institutionId: mongoose.Types.ObjectId | null;
  faculty: string;
  department: string;
  /** Legacy single-platform fields — kept for old clients; `chatLinks` is the source of truth. */
  whatsappLink: string;
  channelLink: string;
  /** Platform-agnostic chat/group links (WhatsApp, Discord, Telegram, Slack, other). */
  chatLinks: CommunityChatLink[];
  rules: string[];
  visibility: CommunityVisibility;
  autoApprove: boolean;
  verificationStatus: CommunityVerificationStatus;
  verificationMethod: CommunityVerificationMethod;
  /** Uploaded endorsement letter (PDF/image path) supporting a manual-review submission. */
  endorsementLetter: string;
  verifiedBy: mongoose.Types.ObjectId | null;
  verifiedAt: Date | null;
  verificationNotes: string;
  founder: mongoose.Types.ObjectId;
  archivedAt: Date | null;
  archivedBy: mongoose.Types.ObjectId | null;
  archiveReason: string;
  memberCount: number;
  eventCount: number;
  followerCount: number;
  inviteToken: string;
  inviteEnabled: boolean;
  isPremium: boolean;
  premiumExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const chatLinkSchema = new Schema<CommunityChatLink>(
  {
    platform: { type: String, enum: [...CHAT_PLATFORMS], required: true },
    url: { type: String, required: true, trim: true },
    label: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const communitySchema = new Schema<CommunityDocument>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    shortDescription: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    logo: { type: String, required: true, trim: true },
    coverImage: { type: String, default: '', trim: true },
    category: { type: String, required: true, trim: true },
    university: { type: String, required: true, trim: true },
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', default: null, index: true },
    faculty: { type: String, default: '', trim: true },
    department: { type: String, default: '', trim: true },
    whatsappLink: { type: String, default: '', trim: true },
    channelLink: { type: String, default: '', trim: true },
    chatLinks: { type: [chatLinkSchema], default: [] },
    rules: { type: [String], default: [] },
    visibility: { type: String, enum: ['PUBLIC', 'PRIVATE'], default: 'PUBLIC' },
    autoApprove: { type: Boolean, default: true },
    verificationStatus: { type: String, enum: ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
    verificationMethod: { type: String, enum: ['UNIVERSITY_EMAIL', 'ENDORSEMENT', 'MANUAL', null], default: null },
    endorsementLetter: { type: String, default: '', trim: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    verificationNotes: { type: String, default: '' },
    founder: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    archiveReason: { type: String, default: '' },
    memberCount: { type: Number, default: 0 },
    eventCount: { type: Number, default: 0 },
    followerCount: { type: Number, default: 0 },
    inviteToken: { type: String, default: '' },
    inviteEnabled: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false, index: true },
    premiumExpiresAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Exact names are unique inside an institution. Similar-name checks in the
// service provide a friendlier guard; this index closes concurrent-request races.
communitySchema.index(
  { institutionId: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { institutionId: { $type: 'objectId' }, normalizedName: { $type: 'string' } } },
);
communitySchema.index({ founder: 1, createdAt: -1 });

export type CommunityModelType = Model<CommunityDocument>;
export type CommunityHydratedDocument = HydratedDocument<CommunityDocument>;

export const CommunityModel = (mongoose.models.Community as CommunityModelType) ?? model<CommunityDocument>('Community', communitySchema);