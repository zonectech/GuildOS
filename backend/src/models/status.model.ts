import mongoose, {
  Schema,
  model,
  type HydratedDocument,
  type Model,
} from 'mongoose';

export type StatusStoryKind =
  | 'event'
  | 'update'
  | 'milestone';

export type StatusAttachmentDocument = {
  type: 'EVENT' | 'TICKET' | 'CERTIFICATE' | 'TICKET_UPLOAD' | 'CERTIFICATE_UPLOAD';
  /** Event _id, certificate serial, or (uploads) the /uploads path. */
  refId: string;
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  startsAt: Date | null;
  mode: string;
  venue: string;
  href: string;
  /** Certificates only: detail used to draw the certificate. */
  snapshot: Record<string, unknown> | null;
};

export type StatusStoryDocument = {
  /** Who posted it — always a person (owner for views, deletion and moderation). */
  userId: mongoose.Types.ObjectId;
  /** Set when a leader posted on behalf of a community: shown with the community's name and logo. */
  communityId: mongoose.Types.ObjectId | null;

  authorName: string;
  authorAvatar: string;

  title: string;
  content: string;

  kind: StatusStoryKind;
  accent: string;

  /** Event / ticket / certificate card shown on the story. */
  attachment: StatusAttachmentDocument | null;

  /** Set by moderation; hidden statuses are excluded from every read. */
  hiddenAt: Date | null;
  hiddenReason: string;

  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

const attachmentSchema = new Schema<StatusAttachmentDocument>(
  {
    type: {
      type: String,
      enum: ['EVENT', 'TICKET', 'CERTIFICATE', 'TICKET_UPLOAD', 'CERTIFICATE_UPLOAD'],
      required: true,
    },
    refId: { type: String, default: '' },
    slug: { type: String, default: '' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    image: { type: String, default: '' },
    startsAt: { type: Date, default: null },
    mode: { type: String, default: '' },
    venue: { type: String, default: '' },
    href: { type: String, default: '' },
    snapshot: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const statusStorySchema =
  new Schema<StatusStoryDocument>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
      },

      communityId: {
        type: Schema.Types.ObjectId,
        ref: 'Community',
        default: null,
        index: true,
      },

      authorName: {
        type: String,
        required: true,
        trim: true,
      },

      authorAvatar: {
        type: String,
        default: '',
      },

      // normalizeStatusStoryInput() copies the content into the title when
      // no title is given, so the title limit must match the content limit.
      title: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
      },

      content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
      },

      kind: {
        type: String,
        enum: [
          'event',
          'update',
          'milestone',
        ],
        default: 'update',
      },

      accent: {
        type: String,
        required: true,
      },

      attachment: {
        type: attachmentSchema,
        default: null,
      },

      hiddenAt: {
        type: Date,
        default: null,
      },

      hiddenReason: {
        type: String,
        default: '',
      },

      expiresAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

statusStorySchema.index({
  createdAt: -1,
});

statusStorySchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

export type StatusStoryModelType =
  Model<StatusStoryDocument>;

export type StatusStoryHydratedDocument =
  HydratedDocument<StatusStoryDocument>;

export const StatusStoryModel =
  (mongoose.models.StatusStory as StatusStoryModelType) ??
  model<StatusStoryDocument>(
    'StatusStory',
    statusStorySchema,
  );