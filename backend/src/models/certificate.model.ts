import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { CERTIFICATE_STYLES, CERTIFICATE_BACKGROUNDS, CERTIFICATE_FONTS, CERTIFICATE_LOGO_ALIGNS, type CertificateNamePlacement, type CertificateMode, type CertificateType, type CertificateTheme, type CertificateContent, type CertificateStyle } from './event.model';

export type CertificateStatus = 'VERIFIED' | 'REVOKED';

export type CertificateDocument = {
  serial: string;
  verificationToken: string;
  /** Null for certificates not tied to an event (e.g. leadership-session service certificates). */
  eventId: mongoose.Types.ObjectId | null;
  communityId: mongoose.Types.ObjectId;
  /** Null when the recipient has no GuildOS account (e.g. a listed community leader) — they're reached via the public verification link instead. */
  userId: mongoose.Types.ObjectId | null;
  registrationId: mongoose.Types.ObjectId | null;
  /** Set for leadership-session certificates — the CommunityLeader roster entry this was issued for (idempotency anchor). */
  leaderId: mongoose.Types.ObjectId | null;
  attendeeName: string;
  eventTitle: string;
  communityName: string;
  university: string;
  type: CertificateType;
  mode: CertificateMode;
  templateImage: string;
  namePlacement: CertificateNamePlacement;
  theme: CertificateTheme;
  content: CertificateContent;
  style: CertificateStyle;
  eventDate: Date | null;
  attendanceMinutes: number;
  /** Multi-day proof: distinct days attended of the event's total (0/0 for single-day events). */
  daysAttended: number;
  totalDays: number;
  status: CertificateStatus;
  verificationCount: number;
  lastVerifiedAt: Date | null;
  revokedAt: Date | null;
  revokedBy: mongoose.Types.ObjectId | null;
  revokeReason: string;
  issuedBy: mongoose.Types.ObjectId | null;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const certificateSchema = new Schema<CertificateDocument>(
  {
    serial: { type: String, required: true, unique: true, index: true },
    verificationToken: { type: String, required: true, index: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', default: null, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    registrationId: { type: Schema.Types.ObjectId, ref: 'EventRegistration', default: null },
    leaderId: { type: Schema.Types.ObjectId, ref: 'CommunityLeader', default: null },
    attendeeName: { type: String, required: true },
    eventTitle: { type: String, required: true },
    communityName: { type: String, default: '' },
    university: { type: String, default: '' },
    type: { type: String, enum: ['ATTENDANCE', 'COMPLETION', 'LEADERSHIP', 'VOLUNTEER'], default: 'ATTENDANCE' },
    mode: { type: String, enum: ['STANDARD', 'CUSTOM'], default: 'STANDARD' },
    templateImage: { type: String, default: '' },
    namePlacement: {
      x: { type: Number, default: 50 },
      y: { type: Number, default: 55 },
      fontSize: { type: Number, default: 6 },
      color: { type: String, default: '#111111' },
      align: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    },
    theme: {
      accent: { type: String, default: '#b8933a' },
      background: { type: String, enum: CERTIFICATE_BACKGROUNDS, default: 'IVORY' },
      font: { type: String, enum: CERTIFICATE_FONTS, default: 'SERIF' },
    },
    content: {
      title: { type: String, default: '' },
      presentation: { type: String, default: '' },
      message: { type: String, default: '' },
      signatories: {
        type: [{ _id: false, name: { type: String, default: '' }, title: { type: String, default: '' }, image: { type: String, default: '' } }],
        default: [],
      },
      logo: { type: String, default: '' },
      logoAlign: { type: String, enum: CERTIFICATE_LOGO_ALIGNS, default: 'CENTER' },
    },
    style: { type: String, enum: CERTIFICATE_STYLES, default: 'CLASSIC' },
    eventDate: { type: Date, default: null },
    attendanceMinutes: { type: Number, default: 0 },
    daysAttended: { type: Number, default: 0 },
    totalDays: { type: Number, default: 0 },
    status: { type: String, enum: ['VERIFIED', 'REVOKED'], default: 'VERIFIED', index: true },
    verificationCount: { type: Number, default: 0 },
    lastVerifiedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    revokeReason: { type: String, default: '' },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    issuedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// One certificate per user per event — only enforced when both sides exist (leadership-session
// certificates carry a null eventId, and account-less recipients a null userId).
certificateSchema.index(
  { eventId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { eventId: { $type: 'objectId' }, userId: { $type: 'objectId' } } },
);
// One leadership certificate per roster entry (each CommunityLeader row is already per-session).
certificateSchema.index(
  { leaderId: 1 },
  { unique: true, partialFilterExpression: { leaderId: { $type: 'objectId' } } },
);

export type CertificateModelType = Model<CertificateDocument>;
export type CertificateHydratedDocument = HydratedDocument<CertificateDocument>;

export const CertificateModel =
  (mongoose.models.Certificate as CertificateModelType) ?? model<CertificateDocument>('Certificate', certificateSchema);
