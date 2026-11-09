import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { CHAT_PLATFORMS, type ChatLink } from '../utils/chat-links';

/** Preset accent colours a community can pick (all readable on light and dark backgrounds). */
export const COMMUNITY_ACCENTS = ['green', 'coral', 'gold', 'blue', 'purple', 'ink'] as const;
export type CommunityAccent = (typeof COMMUNITY_ACCENTS)[number];

export type CommunityVisibility = 'PUBLIC' | 'PRIVATE';
export type CommunityVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type CommunityVerificationMethod = 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL' | null;
export type CommunityRole = 'MEMBER' | 'VOLUNTEER' | 'COORDINATOR' | 'ORGANIZER' | 'SECRETARY' | 'TREASURER' | 'VICE_PRESIDENT' | 'PRESIDENT' | 'FOUNDER';
export type CommunityChatLink = ChatLink;

export type CommunityDocument = {
  name: string;
  normalizedName: string;
  slug: string;
  shortDescription: string;
  description: string;
  logo: string;
  coverImage: string;
  /** Up to 6 photos (meetups, flyers, the team) shown as a slideshow on the community page. */
  gallery: string[];
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
  /** Brand-safe preset colour for the community's crest and page accents. */
  accentColor: CommunityAccent;
  /** Optional public social profiles (full https URLs). */
  socialLinks: { instagram: string; x: string };
  visibility: CommunityVisibility;
  autoApprove: boolean;
  verificationStatus: CommunityVerificationStatus;
  verificationMethod: CommunityVerificationMethod;
  /** Uploaded endorsement letter (PDF/image path) supporting a manual-review submission. */
  endorsementLetter: string;
  verifiedBy: mongoose.Types.ObjectId | null;
  verifiedAt: Date | null;
  verificationNotes: string;
  /** What the applicant told reviewers when sending the community for review (their role, how to confirm it). */
  requestNote: string;
  /** A reviewer asked for more before deciding. The community stays PENDING; the founder answers with an update. */
  infoRequest: { message: string; requestedAt: Date | null; requestedBy: mongoose.Types.ObjectId | null; response: string; respondedAt: Date | null };
  founder: mongoose.Types.ObjectId;
  adminSuspended: boolean;
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
    gallery: { type: [String], default: [] },
    category: { type: String, required: true, trim: true },
    university: { type: String, required: true, trim: true },
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', default: null, index: true },
    faculty: { type: String, default: '', trim: true },
    department: { type: String, default: '', trim: true },
    whatsappLink: { type: String, default: '', trim: true },
    channelLink: { type: String, default: '', trim: true },
    chatLinks: { type: [chatLinkSchema], default: [] },
    rules: { type: [String], default: [] },
    accentColor: { type: String, enum: [...COMMUNITY_ACCENTS], default: 'green' },
    socialLinks: {
      instagram: { type: String, default: '', trim: true, maxlength: 200 },
      x: { type: String, default: '', trim: true, maxlength: 200 },
    },
    visibility: { type: String, enum: ['PUBLIC', 'PRIVATE'], default: 'PUBLIC' },
    autoApprove: { type: Boolean, default: true },
    verificationStatus: { type: String, enum: ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
    verificationMethod: { type: String, enum: ['UNIVERSITY_EMAIL', 'ENDORSEMENT', 'MANUAL', null], default: null },
    endorsementLetter: { type: String, default: '', trim: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    verificationNotes: { type: String, default: '' },
    requestNote: { type: String, default: '', maxlength: 600 },
    infoRequest: {
      message: { type: String, default: '', maxlength: 1000 },
      requestedAt: { type: Date, default: null },
      requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      response: { type: String, default: '', maxlength: 1000 },
      respondedAt: { type: Date, default: null },
    },
    founder: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    adminSuspended: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    archiveReason: { type: String, default: '' },
    memberCount: { type: Number, default: 0 },
    eventCount: { type: Number, default: 0 },
    followerCount: { type: Number, default: 0 },
    inviteToken: { type: String, default: '', select: false },
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