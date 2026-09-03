import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type PostKind = 'TEXT' | 'MILESTONE';
export type PostAuthorType = 'USER' | 'COMMUNITY';

export type PostMilestone = { type: string; label: string; refId: string };

export type PostTagType = 'USER' | 'COMMUNITY';
export type PostTag = { type: PostTagType; refId: mongoose.Types.ObjectId; label: string; handle: string };

export type PostPollOption = { text: string; count: number };
export type PostPoll = { options: PostPollOption[] };

/** System-set action button (Facebook-ad style) — e.g. "View event" on sponsor announcements. Not user-settable. */
export type PostCta = { label: string; url: string; logo: string; title: string; website: string };

export type PostDocument = {
  userId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId | null;
  authorType: PostAuthorType;
  kind: PostKind;
  content: string;
  imageUrl: string;
  tags: PostTag[];
  poll: PostPoll | null;
  cta: PostCta | null;
  milestone: PostMilestone | null;
  likeCount: number;
  commentCount: number;
  reportCount: number;
  /** Feed impressions (viewport sightings, client-deduped per session). Tracked now, displayed later. */
  viewCount: number;
  pinnedAt: Date | null;
  hiddenAt: Date | null;
  hiddenReason: string;
  createdAt: Date;
  updatedAt: Date;
};

const postTagSchema = new Schema<PostTag>(
  {
    type: { type: String, enum: ['USER', 'COMMUNITY'], required: true },
    refId: { type: Schema.Types.ObjectId, required: true },
    label: { type: String, default: '' },
    handle: { type: String, default: '' },
  },
  { _id: false },
);

const pollOptionSchema = new Schema<PostPollOption>(
  {
    text: { type: String, default: '' },
    count: { type: Number, default: 0 },
  },
  { _id: false },
);

const pollSchema = new Schema<PostPoll>(
  {
    options: { type: [pollOptionSchema], default: [] },
  },
  { _id: false },
);

const ctaSchema = new Schema<PostCta>(
  {
    label: { type: String, default: '' },
    url: { type: String, default: '' },
    logo: { type: String, default: '' },
    title: { type: String, default: '' },
    website: { type: String, default: '' },
  },
  { _id: false },
);

const postSchema = new Schema<PostDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', default: null, index: true },
    authorType: { type: String, enum: ['USER', 'COMMUNITY'], default: 'USER' },
    kind: { type: String, enum: ['TEXT', 'MILESTONE'], default: 'TEXT' },
    content: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    tags: { type: [postTagSchema], default: [] },
    poll: { type: pollSchema, default: null },
    cta: { type: ctaSchema, default: null },
    milestone: {
      type: { type: String, default: '' },
      label: { type: String, default: '' },
      refId: { type: String, default: '' },
    },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    pinnedAt: { type: Date, default: null },
    hiddenAt: { type: Date, default: null },
    hiddenReason: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

postSchema.index({ createdAt: -1 });
// Pinned posts surface first on the community page.
postSchema.index({ communityId: 1, pinnedAt: -1 }, { partialFilterExpression: { pinnedAt: { $type: 'date' } } });
// Dedupe milestone posts by their reference.
postSchema.index({ userId: 1, 'milestone.type': 1, 'milestone.refId': 1 }, { unique: true, partialFilterExpression: { kind: 'MILESTONE' } });

export type PostModelType = Model<PostDocument>;
export type PostHydratedDocument = HydratedDocument<PostDocument>;

export const PostModel = (mongoose.models.Post as PostModelType) ?? model<PostDocument>('Post', postSchema);
