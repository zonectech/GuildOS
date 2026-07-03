import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type PostLikeDocument = {
  postId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
};

const postLikeSchema = new Schema<PostLikeDocument>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);

postLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });

export type PostLikeModelType = Model<PostLikeDocument>;
export type PostLikeHydratedDocument = HydratedDocument<PostLikeDocument>;

export const PostLikeModel = (mongoose.models.PostLike as PostLikeModelType) ?? model<PostLikeDocument>('PostLike', postLikeSchema);
