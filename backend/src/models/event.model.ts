import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type EventType =
  | 'WORKSHOP'
  | 'SEMINAR'
  | 'WEBINAR'
  | 'HACKATHON'
  | 'BOOTCAMP'
  | 'COMPETITION'
  | 'CONFERENCE'
  | 'MEETUP'
  | 'TRAINING'
  | 'VOLUNTEER'
  | 'FIELD_TRIP'
  | 'OTHER';

export type EventMode = 'PHYSICAL' | 'HYBRID' | 'VIRTUAL';
export type EventVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
export type EventRegistrationPolicy = 'OPEN' | 'APPROVAL' | 'INVITE';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CHECK_IN' | 'CHECK_OUT' | 'COMPLETED' | 'ARCHIVED';

export type CertificateMode = 'STANDARD' | 'CUSTOM';
export type CertificateType = 'ATTENDANCE' | 'COMPLETION' | 'LEADERSHIP' | 'VOLUNTEER';

export type CertificateNamePlacement = {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
};

export type SponsorshipPackage = {
  name: string;
  price: string;
  perks: string[];
  benefits: string;
};

/**
 * System-defined sponsor deliverables. Organizers pick which perks each package
 * includes (they set the price); the catalog itself is platform-controlled so
 * "what a sponsor gets" is consistent across every event.
 */
export const SPONSOR_PERK_KEYS = [
  'LOGO_EVENT_PAGE',
  'LOGO_CERTIFICATES',
  'SOCIAL_ANNOUNCEMENT',
  'ATTENDANCE_REPORT',
  'STAGE_MENTION',
  'BOOTH',
  'VENUE_BANNER',
] as const;

export const EVENT_TYPES: EventType[] = [
  'WORKSHOP',
  'SEMINAR',
  'WEBINAR',
  'HACKATHON',
  'BOOTCAMP',
  'COMPETITION',
  'CONFERENCE',
  'MEETUP',
  'TRAINING',
  'VOLUNTEER',
  'FIELD_TRIP',
  'OTHER',
];

export type EventDocument = {
  communityId: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  type: EventType;
  shortDescription: string;
  description: string;
  bannerImage: string;
  mode: EventMode;
  venue: string;
  address: string;
  meetingLink: string;
  startDate: Date | null;
  endDate: Date | null;
  timezone: string;
  registrationPolicy: EventRegistrationPolicy;
  registrationDeadline: Date | null;
  capacity: number;
  waitlistEnabled: boolean;
  allowWalkIns: boolean;
  qrEnabled: boolean;
  certificateEnabled: boolean;
  certificateMode: CertificateMode;
  certificateType: CertificateType;
  certificateTemplate: string;
  certificateNamePlacement: CertificateNamePlacement;
  minimumAttendanceDuration: number;
  checkOutRequired: boolean;
  visibility: EventVisibility;
  status: EventStatus;
  sponsorshipOpen: boolean;
  sponsorshipPitch: string;
  sponsorshipPackages: SponsorshipPackage[];
  registrationCount: number;
  checkedInCount: number;
  completedCount: number;
  certificatesIssued: number;
  createdBy: mongoose.Types.ObjectId;
  deletedAt: Date | null;
  reminderSentAt: Date | null;
  attendanceFinalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const eventSchema = new Schema<EventDocument>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    type: { type: String, enum: EVENT_TYPES, default: 'WORKSHOP' },
    shortDescription: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    bannerImage: { type: String, default: '', trim: true },
    mode: { type: String, enum: ['PHYSICAL', 'HYBRID', 'VIRTUAL'], default: 'PHYSICAL' },
    venue: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    meetingLink: { type: String, default: '', trim: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    timezone: { type: String, default: '' },
    registrationPolicy: { type: String, enum: ['OPEN', 'APPROVAL', 'INVITE'], default: 'OPEN' },
    registrationDeadline: { type: Date, default: null },
    capacity: { type: Number, default: 0 },
    waitlistEnabled: { type: Boolean, default: false },
    allowWalkIns: { type: Boolean, default: true },
    qrEnabled: { type: Boolean, default: true },
    certificateEnabled: { type: Boolean, default: false },
    certificateMode: { type: String, enum: ['STANDARD', 'CUSTOM'], default: 'STANDARD' },
    certificateType: { type: String, enum: ['ATTENDANCE', 'COMPLETION', 'LEADERSHIP', 'VOLUNTEER'], default: 'ATTENDANCE' },
    certificateTemplate: { type: String, default: '' },
    certificateNamePlacement: {
      x: { type: Number, default: 50 },
      y: { type: Number, default: 55 },
      fontSize: { type: Number, default: 6 },
      color: { type: String, default: '#111111' },
      align: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    },
    minimumAttendanceDuration: { type: Number, default: 0 },
    checkOutRequired: { type: Boolean, default: true },
    visibility: { type: String, enum: ['PUBLIC', 'PRIVATE', 'UNLISTED'], default: 'PUBLIC' },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED', 'ARCHIVED'], default: 'DRAFT', index: true },
    sponsorshipOpen: { type: Boolean, default: false, index: true },
    sponsorshipPitch: { type: String, default: '', trim: true },
    sponsorshipPackages: {
      type: [
        {
          _id: false,
          name: { type: String, required: true, trim: true },
          price: { type: String, default: '', trim: true },
          perks: { type: [String], default: [] },
          benefits: { type: String, default: '', trim: true },
        },
      ],
      default: [],
    },
    registrationCount: { type: Number, default: 0 },
    checkedInCount: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },
    certificatesIssued: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
    reminderSentAt: { type: Date, default: null },
    attendanceFinalizedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type EventModelType = Model<EventDocument>;
export type EventHydratedDocument = HydratedDocument<EventDocument>;

export const EventModel = (mongoose.models.Event as EventModelType) ?? model<EventDocument>('Event', eventSchema);
