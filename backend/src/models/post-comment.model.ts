import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type PostCommentDocument = {
  postId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
};

const postCommentSchema = new Schema<PostCommentDocument>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);

export type PostCommentModelType = Model<PostCommentDocument>;
export type PostCommentHydratedDocument = HydratedDocument<PostCommentDocument>;

export const PostCommentModel = (mongoose.models.PostComment as PostCommentModelType) ?? model<PostCommentDocument>('PostComment', postCommentSchema);
