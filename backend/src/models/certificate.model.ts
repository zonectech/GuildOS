import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import type { CertificateNamePlacement, CertificateMode, CertificateType } from './event.model';

export type CertificateStatus = 'VERIFIED' | 'REVOKED';

export type CertificateDocument = {
  serial: string;
  verificationToken: string;
  eventId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  registrationId: mongoose.Types.ObjectId | null;
  attendeeName: string;
  eventTitle: string;
  communityName: string;
  university: string;
  type: CertificateType;
  mode: CertificateMode;
  templateImage: string;
  namePlacement: CertificateNamePlacement;
  eventDate: Date | null;
  attendanceMinutes: number;
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
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    registrationId: { type: Schema.Types.ObjectId, ref: 'EventRegistration', default: null },
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
    eventDate: { type: Date, default: null },
    attendanceMinutes: { type: Number, default: 0 },
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

certificateSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export type CertificateModelType = Model<CertificateDocument>;
export type CertificateHydratedDocument = HydratedDocument<CertificateDocument>;

export const CertificateModel =
  (mongoose.models.Certificate as CertificateModelType) ?? model<CertificateDocument>('Certificate', certificateSchema);
