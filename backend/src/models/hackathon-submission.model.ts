import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

/** A certificate issued from this submission — the idempotency record for results publishing. */
export type HackathonCertificateRef = {
  userId: mongoose.Types.ObjectId;
  /** The award it was issued for, or null for a participation certificate. */
  awardId: mongoose.Types.ObjectId | null;
  serial: string;
};

/** One project per team. Public in the event's project gallery as soon as it's saved. */
export type HackathonSubmissionDocument = {
  eventId: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  title: string;
  tagline: string;
  description: string;
  repoUrl: string;
  demoUrl: string;
  videoUrl: string;
  images: string[];
  techStack: string[];
  /** Prize tracks the team is competing in. */
  trackKeys: string[];
  submittedBy: mongoose.Types.ObjectId;
  certificates: HackathonCertificateRef[];
  createdAt: Date;
  updatedAt: Date;
};

const hackathonSubmissionSchema = new Schema<HackathonSubmissionDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'HackathonTeam', required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    tagline: { type: String, default: '', maxlength: 160 },
    description: { type: String, default: '', maxlength: 5000 },
    repoUrl: { type: String, default: '', maxlength: 300 },
    demoUrl: { type: String, default: '', maxlength: 300 },
    videoUrl: { type: String, default: '', maxlength: 300 },
    images: { type: [String], default: [] },
    techStack: { type: [String], default: [] },
    trackKeys: { type: [String], default: [] },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    certificates: {
      type: [{
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        awardId: { type: Schema.Types.ObjectId, default: null },
        serial: { type: String, required: true },
      }],
      default: [],
    },
  },
  { timestamps: true, versionKey: false },
);

export type HackathonSubmissionHydratedDocument = HydratedDocument<HackathonSubmissionDocument>;

export const HackathonSubmissionModel =
  (mongoose.models.HackathonSubmission as Model<HackathonSubmissionDocument>) ??
  model<HackathonSubmissionDocument>('HackathonSubmission', hackathonSubmissionSchema);
