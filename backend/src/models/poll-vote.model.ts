import mongoose, { Schema, model, type Model } from 'mongoose';

/** One vote per user per poll post — the post keeps denormalized counts. */
export type PollVoteDocument = {
  postId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  optionIndex: number;
  createdAt: Date;
  updatedAt: Date;
};

const pollVoteSchema = new Schema<PollVoteDocument>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    optionIndex: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

pollVoteSchema.index({ postId: 1, userId: 1 }, { unique: true });

export type PollVoteModelType = Model<PollVoteDocument>;
export const PollVoteModel = (mongoose.models.PollVote as PollVoteModelType) ?? model<PollVoteDocument>('PollVote', pollVoteSchema);
