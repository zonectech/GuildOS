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

export type EventRegistrationDocument = {
  eventId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId | null;
  userId: mongoose.Types.ObjectId;
  registrationType: EventRegistrationType;
  attendanceMode: EventAttendanceMode | null;
  status: EventRegistrationStatus;
  qrToken: string;
  registeredAt: Date;
  approvedAt: Date | null;
  approvedBy: mongoose.Types.ObjectId | null;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  attendanceMinutes: number;
  attendanceVerified: boolean;
  checkedInBy: mongoose.Types.ObjectId | null;
  checkedOutBy: mongoose.Types.ObjectId | null;
  scannerRole: string;
  checkInIp: string;
  checkInUserAgent: string;
  certificateEligible: boolean;
  certificateIssued: boolean;
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
    registeredAt: { type: Date, default: () => new Date() },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    attendanceMinutes: { type: Number, default: 0 },
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

export type EventRegistrationModelType = Model<EventRegistrationDocument>;
export type EventRegistrationHydratedDocument = HydratedDocument<EventRegistrationDocument>;

export const EventRegistrationModel =
  (mongoose.models.EventRegistration as EventRegistrationModelType) ??
  model<EventRegistrationDocument>('EventRegistration', eventRegistrationSchema);
