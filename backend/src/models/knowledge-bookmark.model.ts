import mongoose, { Schema } from 'mongoose';

/** Saved knowledge-hub resource — mirrors EventBookmark. Feeds the "Saved" filter in community knowledge hubs. */
export type KnowledgeBookmarkDocument = {
  userId: mongoose.Types.ObjectId;
  resourceId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const knowledgeBookmarkSchema = new Schema<KnowledgeBookmarkDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resourceId: { type: Schema.Types.ObjectId, ref: 'KnowledgeResource', required: true },
  },
  { timestamps: true },
);

knowledgeBookmarkSchema.index({ userId: 1, resourceId: 1 }, { unique: true });

export const KnowledgeBookmarkModel =
  (mongoose.models.KnowledgeBookmark as mongoose.Model<KnowledgeBookmarkDocument>) ||
  mongoose.model<KnowledgeBookmarkDocument>('KnowledgeBookmark', knowledgeBookmarkSchema);
