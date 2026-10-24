import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type HackathonTrack = { key: string; name: string; description: string; prize: string };
export type HackathonCriterion = { key: string; name: string; weight: number };

/** Judges reach their scoring page through a private token link — no GuildOS account required. */
export type HackathonJudge = {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  userId: mongoose.Types.ObjectId | null;
  token: string;
  addedAt: Date;
};

/** A published award: an overall placing (1–3) or a prize-track win. */
export type HackathonAward = {
  _id: mongoose.Types.ObjectId;
  submissionId: mongoose.Types.ObjectId;
  place: number | null;
  trackKey: string;
  label: string;
};

/**
 * Hackathon settings for one HACKATHON-type event (created lazily on first use).
 * Teams, submissions and judge scores live in their own collections.
 */
export type HackathonDocument = {
  eventId: mongoose.Types.ObjectId;
  teamSizeMin: number;
  teamSizeMax: number;
  /** Submissions open at this time (null = as soon as a team exists). */
  submissionOpensAt: Date | null;
  /** Teams and submissions lock at this time (null = until results are published). */
  submissionDeadline: Date | null;
  tracks: HackathonTrack[];
  criteria: HackathonCriterion[];
  judges: HackathonJudge[];
  awards: HackathonAward[];
  resultsPublishedAt: Date | null;
  /** Set once the winning projects were saved to the community Knowledge Hub. */
  knowledgeResourceId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

export const DEFAULT_HACKATHON_CRITERIA: HackathonCriterion[] = [
  { key: 'innovation', name: 'Innovation', weight: 30 },
  { key: 'technical', name: 'Technical execution', weight: 30 },
  { key: 'impact', name: 'Impact', weight: 20 },
  { key: 'presentation', name: 'Presentation', weight: 20 },
];

const hackathonSchema = new Schema<HackathonDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, unique: true },
    teamSizeMin: { type: Number, default: 1, min: 1, max: 10 },
    teamSizeMax: { type: Number, default: 4, min: 1, max: 10 },
    submissionOpensAt: { type: Date, default: null },
    submissionDeadline: { type: Date, default: null },
    tracks: {
      type: [{
        _id: false,
        key: { type: String, required: true },
        name: { type: String, required: true, maxlength: 80 },
        description: { type: String, default: '', maxlength: 300 },
        prize: { type: String, default: '', maxlength: 120 },
      }],
      default: [],
    },
    criteria: {
      type: [{
        _id: false,
        key: { type: String, required: true },
        name: { type: String, required: true, maxlength: 60 },
        weight: { type: Number, required: true, min: 1, max: 100 },
      }],
      default: () => DEFAULT_HACKATHON_CRITERIA,
    },
    judges: {
      type: [{
        name: { type: String, required: true, maxlength: 80 },
        email: { type: String, default: '', maxlength: 160 },
        userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        token: { type: String, required: true },
        addedAt: { type: Date, default: () => new Date() },
      }],
      default: [],
    },
    awards: {
      type: [{
        submissionId: { type: Schema.Types.ObjectId, ref: 'HackathonSubmission', required: true },
        place: { type: Number, default: null },
        trackKey: { type: String, default: '' },
        label: { type: String, required: true },
      }],
      default: [],
    },
    resultsPublishedAt: { type: Date, default: null },
    knowledgeResourceId: { type: Schema.Types.ObjectId, ref: 'KnowledgeResource', default: null },
  },
  { timestamps: true, versionKey: false },
);

hackathonSchema.index({ 'judges.token': 1 });

export type HackathonHydratedDocument = HydratedDocument<HackathonDocument>;

export const HackathonModel =
  (mongoose.models.Hackathon as Model<HackathonDocument>) ?? model<HackathonDocument>('Hackathon', hackathonSchema);
