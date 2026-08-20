import { randomBytes } from 'crypto';
import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type EventRegistrationStatus =
  | 'PENDING_APPROVAL'
  | 'CONFIRMED'
  | 'WAITLISTED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'COMPLETED'
  | 'PARTIAL_ATTENDANCE'
  | 'CANCELLED'
  | 'REJECTED'
  | 'NO_SHOW';

export type EventRegistrationType = 'OPEN' | 'APPROVAL' | 'INVITE' | 'WALK_IN';
export type EventAttendanceMode = 'PHYSICAL' | 'ONLINE';

/** One calendar day of attendance at a multi-day event (day = YYYY-MM-DD). */
export type AttendanceDayEntry = {
  day: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  minutes: number;
};

export type EventRegistrationDocument = {
  eventId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId | null;
  userId: mongoose.Types.ObjectId;
  registrationType: EventRegistrationType;
  attendanceMode: EventAttendanceMode | null;
  status: EventRegistrationStatus;
  qrToken: string;
  /** Short human-readable gate code (e.g. "K7M2PX") — typed at the door when QR scanning fails. Auto-minted on save. */
  passCode: string;
  registeredAt: Date;
  approvedAt: Date | null;
  approvedBy: mongoose.Types.ObjectId | null;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  attendanceMinutes: number;
  /** Per-day check-in/out records for multi-day events (empty for single-day events). */
  attendanceDays: AttendanceDayEntry[];
  /** Multi-day RSVP: 1-based day numbers the attendee plans to attend ([] = all days). */
  plannedDays: number[];
  /** Section/track the attendee registered into ('' = event has no sections). */
  sectionKey: string;
  attendanceVerified: boolean;
  checkedInBy: mongoose.Types.ObjectId | null;
  checkedOutBy: mongoose.Types.ObjectId | null;
  scannerRole: string;
  checkInIp: string;
  checkInUserAgent: string;
  certificateEligible: boolean;
  certificateIssued: boolean;
  /** Why the registration was cancelled ('' = not cancelled / no reason given). */
  cancellationReason: string;
  /** Who cancelled it: the attendee themselves or the organizers ('' = not cancelled). */
  cancelledBy: 'SELF' | 'ORGANIZER' | '';
  createdAt: Date;
  updatedAt: Date;
};

const eventRegistrationSchema = new Schema<EventRegistrationDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    registrationType: { type: String, enum: ['OPEN', 'APPROVAL', 'INVITE', 'WALK_IN'], default: 'OPEN', index: true },
    attendanceMode: { type: String, enum: ['PHYSICAL', 'ONLINE', null], default: null },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'CONFIRMED', 'WAITLISTED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE', 'CANCELLED', 'REJECTED', 'NO_SHOW'],
      default: 'CONFIRMED',
      index: true,
    },
    qrToken: { type: String, required: true, unique: true, index: true },
    passCode: { type: String, default: '' },
    registeredAt: { type: Date, default: () => new Date() },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancellationReason: { type: String, default: '', maxlength: 200 },
    cancelledBy: { type: String, enum: ['SELF', 'ORGANIZER', ''], default: '' },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    attendanceMinutes: { type: Number, default: 0 },
    attendanceDays: {
      type: [
        {
          _id: false,
          day: { type: String, required: true },
          checkInAt: { type: Date, default: null },
          checkOutAt: { type: Date, default: null },
          minutes: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    plannedDays: { type: [Number], default: [] },
    sectionKey: { type: String, default: '', trim: true, index: true },
    attendanceVerified: { type: Boolean, default: false },
    checkedInBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    checkedOutBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    scannerRole: { type: String, default: '' },
    checkInIp: { type: String, default: '' },
    checkInUserAgent: { type: String, default: '' },
    certificateEligible: { type: Boolean, default: false },
    certificateIssued: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
eventRegistrationSchema.index({ eventId: 1, passCode: 1 });

// No lookalike characters (I/L/O/U/0/1) — gate codes get read out loud and typed on phones.
const PASS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/** Mint a 6-char gate code (~730M combinations — collision-safe within one event). */
export function generatePassCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += PASS_CODE_ALPHABET[bytes[i] % PASS_CODE_ALPHABET.length];
  return out;
}

// Every registration gets a gate code automatically — covers all creation paths
// (register, ticket fulfil, guest claim, walk-in) plus old docs on their next save.
eventRegistrationSchema.pre('save', function (next) {
  if (!this.passCode) this.passCode = generatePassCode();
  next();
});

export type EventRegistrationModelType = Model<EventRegistrationDocument>;
export type EventRegistrationHydratedDocument = HydratedDocument<EventRegistrationDocument>;

export const EventRegistrationModel =
  (mongoose.models.EventRegistration as EventRegistrationModelType) ??
  model<EventRegistrationDocument>('EventRegistration', eventRegistrationSchema);
