import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type PostKind = 'TEXT' | 'MILESTONE';
export type PostAuthorType = 'USER' | 'COMMUNITY';

export type PostMilestone = { type: string; label: string; refId: string };

export type PostDocument = {
  userId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId | null;
  authorType: PostAuthorType;
  kind: PostKind;
  content: string;
  milestone: PostMilestone | null;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const postSchema = new Schema<PostDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', default: null, index: true },
    authorType: { type: String, enum: ['USER', 'COMMUNITY'], default: 'USER' },
    kind: { type: String, enum: ['TEXT', 'MILESTONE'], default: 'TEXT' },
    content: { type: String, default: '' },
    milestone: {
      type: { type: String, default: '' },
      label: { type: String, default: '' },
      refId: { type: String, default: '' },
    },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

postSchema.index({ createdAt: -1 });
// Dedupe milestone posts by their reference.
postSchema.index({ userId: 1, 'milestone.type': 1, 'milestone.refId': 1 }, { unique: true, partialFilterExpression: { kind: 'MILESTONE' } });

export type PostModelType = Model<PostDocument>;
export type PostHydratedDocument = HydratedDocument<PostDocument>;

export const PostModel = (mongoose.models.Post as PostModelType) ?? model<PostDocument>('Post', postSchema);
