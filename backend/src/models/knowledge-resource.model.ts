import mongoose, { Schema, model, type Model } from 'mongoose';

export type KnowledgeType = 'ARTICLE' | 'LINK' | 'FILE';
export const KNOWLEDGE_TYPES: KnowledgeType[] = ['ARTICLE', 'LINK', 'FILE'];

export type KnowledgeCategory =
  | 'GETTING_STARTED'
  | 'TUTORIAL'
  | 'DOCUMENTATION'
  | 'ROADMAP'
  | 'OPPORTUNITY'
  | 'PAST_QUESTIONS'
  | 'OTHER';

/** Display order for the Knowledge Hub — Getting Started always leads. */
export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  'GETTING_STARTED',
  'TUTORIAL',
  'DOCUMENTATION',
  'ROADMAP',
  'OPPORTUNITY',
  'PAST_QUESTIONS',
  'OTHER',
];

/**
 * A Knowledge Hub resource — a community's institutional memory. Markdown-first
 * (articles are searchable and AI-retrievable later); links and files supported.
 */
export type KnowledgeResourceDocument = {
  _id: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  type: KnowledgeType;
  category: KnowledgeCategory;
  title: string;
  /** Short teaser shown on the resource card. */
  summary: string;
  /** Markdown body (ARTICLE). */
  content: string;
  /** External destination (LINK). */
  url: string;
  /** Stored upload path `/uploads/<key>` (FILE). */
  file: string;
  /** Original filename shown to downloaders (FILE). */
  fileName: string;
  viewCount: number;
  downloadCount: number;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const knowledgeResourceSchema = new Schema<KnowledgeResourceDocument>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    type: { type: String, enum: KNOWLEDGE_TYPES, required: true },
    category: { type: String, enum: KNOWLEDGE_CATEGORIES, default: 'OTHER', index: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '', trim: true },
    content: { type: String, default: '' },
    url: { type: String, default: '', trim: true },
    file: { type: String, default: '', trim: true },
    fileName: { type: String, default: '', trim: true },
    viewCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

knowledgeResourceSchema.index({ communityId: 1, category: 1, createdAt: -1 });

export type KnowledgeResourceModelType = Model<KnowledgeResourceDocument>;

export const KnowledgeResourceModel =
  (mongoose.models.KnowledgeResource as KnowledgeResourceModelType) ??
  model<KnowledgeResourceDocument>('KnowledgeResource', knowledgeResourceSchema);
