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

export type CertificateBackground = 'IVORY' | 'WHITE' | 'CREAM' | 'SLATE' | 'BLUSH' | 'NAVY' | 'CHARCOAL' | 'FOREST' | 'BURGUNDY';
export type CertificateFont = 'SERIF' | 'ELEGANT' | 'SANS' | 'PLAYFAIR' | 'CORMORANT' | 'MERRIWEATHER' | 'MONTSERRAT' | 'SCRIPT';

/** Organizer-tunable theme for the auto-generated STANDARD certificate. */
export type CertificateTheme = {
  accent: string;
  background: CertificateBackground;
  font: CertificateFont;
};

export const CERTIFICATE_BACKGROUNDS: CertificateBackground[] = ['IVORY', 'WHITE', 'CREAM', 'SLATE', 'BLUSH', 'NAVY', 'CHARCOAL', 'FOREST', 'BURGUNDY'];
export const CERTIFICATE_FONTS: CertificateFont[] = ['SERIF', 'ELEGANT', 'SANS', 'PLAYFAIR', 'CORMORANT', 'MERRIWEATHER', 'MONTSERRAT', 'SCRIPT'];
export const DEFAULT_CERTIFICATE_THEME: CertificateTheme = { accent: '#b8933a', background: 'IVORY', font: 'SERIF' };

/** Ready-made certificate layouts. All are free (premium gates customization, not designs). */
export type CertificateStyle =
  | 'CLASSIC'
  | 'MODERN'
  | 'MINIMAL'
  | 'CORPORATE'
  | 'DECO'
  | 'GEOMETRIC'
  | 'RIBBON'
  | 'DOUBLE'
  | 'ROUNDED'
  | 'LAUREL'
  | 'TECH'
  | 'WAVE';
export const CERTIFICATE_STYLES: CertificateStyle[] = ['CLASSIC', 'MODERN', 'MINIMAL', 'CORPORATE', 'DECO', 'GEOMETRIC', 'RIBBON', 'DOUBLE', 'ROUNDED', 'LAUREL', 'TECH', 'WAVE'];
export const PREMIUM_CERTIFICATE_STYLES: CertificateStyle[] = [];

export type CertificateSignatory = { name: string; title: string; image: string };

export type CertificateLogoPlacement = 'NONE' | 'EMBLEM' | 'TOP_LEFT' | 'TOP_RIGHT' | 'WATERMARK';
export const CERTIFICATE_LOGO_PLACEMENTS: CertificateLogoPlacement[] = ['NONE', 'EMBLEM', 'TOP_LEFT', 'TOP_RIGHT', 'WATERMARK'];

export type TicketQrPlacement = 'BOTTOM_RIGHT' | 'BOTTOM_LEFT' | 'TOP_RIGHT' | 'TOP_LEFT' | 'CENTER';
export const TICKET_QR_PLACEMENTS: TicketQrPlacement[] = ['BOTTOM_RIGHT', 'BOTTOM_LEFT', 'TOP_RIGHT', 'TOP_LEFT', 'CENTER'];

/** A named price level for a paid event, e.g. Early Bird / Regular / VIP. capacity 0 = unlimited. */
export type TicketTier = { name: string; price: number; capacity: number };

/** Organizer discount code. percentOff 1-100; maxUses 0 = unlimited; usedCount tracks PAID redemptions. */
export type TicketPromoCode = { code: string; percentOff: number; maxUses: number; usedCount: number };

/** Selar-style group-buy deal: buy `minQuantity`+ tickets in one order, each is `percentOff`% cheaper. minQuantity 0 = off. */
export type TicketGroupDiscount = { minQuantity: number; percentOff: number };

/** Organizer-supplied text/content overrides for the STANDARD certificate (blank = use default). */
export type CertificateContent = {
  title: string;
  presentation: string;
  message: string;
  signatories: CertificateSignatory[];
  logo: string;
  logoPlacement: CertificateLogoPlacement;
};

export const DEFAULT_CERTIFICATE_CONTENT: CertificateContent = {
  title: '',
  presentation: '',
  message: '',
  signatories: [],
  logo: '',
  logoPlacement: 'NONE',
};

export type SponsorshipPackage = {
  name: string;
  price: string;
  perks: string[];
  benefits: string;
};

/** An external partner organization (non-paying collaborator) shown on the event page and certificates. */
export type EventPartner = {
  name: string;
  logo: string;
  website: string;
};

/** A contact person organizers list on the event page for attendee inquiries. */
export type EventContact = {
  name: string;
  phone: string;
  email: string;
};

/** A facilitator/anchor running a specific day of a multi-day event. */
export type EventDayFacilitator = {
  name: string;
  title: string;
};

/** A timed programme item within one day (e.g. "4:30 PM — Amir's Cup Final @ GK School Field"). */
export type EventDaySession = {
  /** "HH:mm" or '' for untimed items (e.g. "After Jum'ah" goes in the title). */
  time: string;
  title: string;
  venue: string;
  facilitator: string;
};

/**
 * One day of a multi-day event. Each day can have its own sub-theme, venue,
 * activities, facilitators and timed sessions while the event's `theme` field
 * carries the grand theme.
 */
export type EventDay = {
  date: Date | null;
  theme: string;
  venue: string;
  /** Daily start/end times as "HH:mm" ('' = not set). */
  startTime: string;
  endTime: string;
  features: string[];
  facilitators: EventDayFacilitator[];
  /** Timed programme items — for days with multiple sessions at different times/venues. */
  sessions: EventDaySession[];
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
  normalizedTitle: string;
  eventStartDay: string;
  slug: string;
  type: EventType;
  shortDescription: string;
  description: string;
  /** Event theme/topic (e.g. "AI for Social Good") — distinct from the title. */
  theme: string;
  /** Highlights of what attendees get (bullet list on the event page). */
  features: string[];
  /** Day-by-day agenda for multi-day events (own sub-theme/venue/activities per day). */
  days: EventDay[];
  /**
   * Multi-day certificate rule: distinct days an attendee must check in on to be
   * certificate-eligible. 0 = every scheduled day. Ignored for single-day events.
   */
  minimumAttendanceDays: number;
  /** Contact persons for attendee inquiries. */
  contacts: EventContact[];
  bannerImage: string;
  mode: EventMode;
  venue: string;
  tags: string[];
  refreshments: boolean;
  /** Promotional images (flyers, speaker cards) shown in a slider on the event page. */
  gallery: string[];
  address: string;
  meetingLink: string;
  startDate: Date | null;
  endDate: Date | null;
  timezone: string;
  registrationPolicy: EventRegistrationPolicy;
  registrationDeadline: Date | null;
  /** Organizer's manual "stop sign-ups now" switch — blocks registration and ticket sales while flipped, reversible. Walk-ins unaffected. */
  registrationClosed: boolean;
  capacity: number;
  waitlistEnabled: boolean;
  /** Ticket price in NGN. 0 = free event. Paid events register through the ticket checkout. */
  ticketPrice: number;
  /** Optional named price levels (Early Bird / Regular / VIP). When present, they are the source of truth
   *  and `ticketPrice` is kept in sync with the cheapest paid tier so "is this paid?" checks keep working. */
  ticketTiers: TicketTier[];
  /** Discount codes for this event's tickets. */
  ticketPromoCodes: TicketPromoCode[];
  /** Group-buy discount rule (minQuantity 0 = disabled). */
  ticketGroupDiscount: TicketGroupDiscount;
  /** Organizer-uploaded ticket artwork (/uploads path). '' = GuildOS standard ticket design. */
  ticketTemplate: string;
  /** Why the event was cancelled — shown to attendees on the event page. '' = not cancelled. */
  cancellationReason: string;
  /** Where the QR block is composited on a custom ticket template. */
  ticketQrPlacement: TicketQrPlacement;
  allowWalkIns: boolean;
  qrEnabled: boolean;
  certificateEnabled: boolean;
  certificateMode: CertificateMode;
  certificateType: CertificateType;
  certificateTemplate: string;
  certificateNamePlacement: CertificateNamePlacement;
  certificateTheme: CertificateTheme;
  certificateStyle: CertificateStyle;
  certificateContent: CertificateContent;
  premiumUnlocked: boolean;
  minimumAttendanceDuration: number;
  checkOutRequired: boolean;
  visibility: EventVisibility;
  status: EventStatus;
  /** AUTO = system thank-you sent with certificates; CUSTOM = organizer designs it; OFF = none. */
  appreciationMode: 'AUTO' | 'CUSTOM' | 'OFF';
  appreciationSentAt: Date | null;
  sponsorshipOpen: boolean;
  sponsorshipPitch: string;
  sponsorshipPackages: SponsorshipPackage[];
  /** External partner organizations (display + certificates). Co-host communities live in EventPartnership. */
  partners: EventPartner[];
  registrationCount: number;
  checkedInCount: number;
  completedCount: number;
  certificatesIssued: number;
  createdBy: mongoose.Types.ObjectId;
  deletedAt: Date | null;
  reminderSentAt: Date | null;
  /** "Starting in less than an hour" nudge stamp (event start / multi-day Day 1). */
  finalReminderSentAt: Date | null;
  /** Multi-day: agenda days already reminded (markers like "d2", "d3"; final nudges "d2-final"). */
  dayRemindersSent: string[];
  attendanceFinalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const eventSchema = new Schema<EventDocument>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    title: { type: String, required: true, trim: true },
    normalizedTitle: { type: String, default: '', trim: true },
    eventStartDay: { type: String, default: 'unscheduled', trim: true },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    type: { type: String, enum: EVENT_TYPES, default: 'WORKSHOP' },
    shortDescription: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    theme: { type: String, default: '', trim: true },
    features: { type: [String], default: [] },
    days: {
      type: [
        {
          _id: false,
          date: { type: Date, default: null },
          theme: { type: String, default: '', trim: true },
          venue: { type: String, default: '', trim: true },
          startTime: { type: String, default: '', trim: true },
          endTime: { type: String, default: '', trim: true },
          features: { type: [String], default: [] },
          facilitators: {
            type: [
              {
                _id: false,
                name: { type: String, default: '', trim: true },
                title: { type: String, default: '', trim: true },
              },
            ],
            default: [],
          },
          sessions: {
            type: [
              {
                _id: false,
                time: { type: String, default: '', trim: true },
                title: { type: String, default: '', trim: true },
                venue: { type: String, default: '', trim: true },
                facilitator: { type: String, default: '', trim: true },
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
    },
    minimumAttendanceDays: { type: Number, default: 0 },
    contacts: {
      type: [
        {
          _id: false,
          name: { type: String, default: '', trim: true },
          phone: { type: String, default: '', trim: true },
          email: { type: String, default: '', trim: true },
        },
      ],
      default: [],
    },
    bannerImage: { type: String, default: '', trim: true },
    mode: { type: String, enum: ['PHYSICAL', 'HYBRID', 'VIRTUAL'], default: 'PHYSICAL' },
    venue: { type: String, default: '', trim: true },
    tags: { type: [String], default: [] },
    // "Item 7" 🍛 — refreshments provided at physical/hybrid events.
    refreshments: { type: Boolean, default: false },
    gallery: { type: [String], default: [] },
    address: { type: String, default: '', trim: true },
    meetingLink: { type: String, default: '', trim: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    timezone: { type: String, default: '' },
    registrationPolicy: { type: String, enum: ['OPEN', 'APPROVAL', 'INVITE'], default: 'OPEN' },
    registrationDeadline: { type: Date, default: null },
    registrationClosed: { type: Boolean, default: false },
    capacity: { type: Number, default: 0 },
    waitlistEnabled: { type: Boolean, default: false },
    ticketPrice: { type: Number, default: 0 },
    ticketTiers: {
      type: [{ _id: false, name: { type: String, maxlength: 40 }, price: { type: Number, default: 0 }, capacity: { type: Number, default: 0 } }],
      default: [],
    },
    ticketPromoCodes: {
      type: [{ _id: false, code: { type: String, maxlength: 20 }, percentOff: { type: Number, default: 0 }, maxUses: { type: Number, default: 0 }, usedCount: { type: Number, default: 0 } }],
      default: [],
    },
    ticketGroupDiscount: {
      type: new Schema<TicketGroupDiscount>(
        { minQuantity: { type: Number, default: 0 }, percentOff: { type: Number, default: 0 } },
        { _id: false },
      ),
      default: { minQuantity: 0, percentOff: 0 },
    },
    ticketTemplate: { type: String, default: '', maxlength: 300 },
    cancellationReason: { type: String, default: '', maxlength: 300 },
    ticketQrPlacement: { type: String, enum: TICKET_QR_PLACEMENTS, default: 'BOTTOM_RIGHT' },
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
    certificateTheme: {
      accent: { type: String, default: '#b8933a' },
      background: { type: String, enum: CERTIFICATE_BACKGROUNDS, default: 'IVORY' },
      font: { type: String, enum: CERTIFICATE_FONTS, default: 'SERIF' },
    },
    certificateStyle: { type: String, enum: CERTIFICATE_STYLES, default: 'CLASSIC' },
    certificateContent: {
      title: { type: String, default: '' },
      presentation: { type: String, default: '' },
      message: { type: String, default: '' },
      signatories: {
        type: [{ _id: false, name: { type: String, default: '' }, title: { type: String, default: '' }, image: { type: String, default: '' } }],
        default: [],
      },
      logo: { type: String, default: '' },
      logoPlacement: { type: String, enum: CERTIFICATE_LOGO_PLACEMENTS, default: 'NONE' },
    },
    premiumUnlocked: { type: Boolean, default: false },
    minimumAttendanceDuration: { type: Number, default: 0 },
    checkOutRequired: { type: Boolean, default: true },
    visibility: { type: String, enum: ['PUBLIC', 'PRIVATE', 'UNLISTED'], default: 'PUBLIC' },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED', 'ARCHIVED'], default: 'DRAFT', index: true },
    appreciationMode: { type: String, enum: ['AUTO', 'CUSTOM', 'OFF'], default: 'AUTO' },
    appreciationSentAt: { type: Date, default: null },
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
    partners: {
      type: [
        {
          _id: false,
          name: { type: String, required: true, trim: true },
          logo: { type: String, default: '', trim: true },
          website: { type: String, default: '', trim: true },
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
    finalReminderSentAt: { type: Date, default: null },
    dayRemindersSent: { type: [String], default: [] },
    attendanceFinalizedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Friendly similarity checks run in the service. This index is the final
// protection against concurrent exact duplicates on the same UTC day.
eventSchema.index(
  { communityId: 1, normalizedTitle: 1, eventStartDay: 1 },
  {
    unique: true,
    partialFilterExpression: {
      normalizedTitle: { $type: 'string', $gt: '' },
      eventStartDay: { $type: 'string' },
      deletedAt: null,
    },
  },
);
eventSchema.index({ createdBy: 1, createdAt: -1 });
eventSchema.index({ communityId: 1, createdAt: -1 });

export type EventModelType = Model<EventDocument>;
export type EventHydratedDocument = HydratedDocument<EventDocument>;

export const EventModel = (mongoose.models.Event as EventModelType) ?? model<EventDocument>('Event', eventSchema);
