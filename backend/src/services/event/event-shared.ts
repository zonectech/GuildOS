import {
  EventModel,
  EVENT_TYPES,
  SPONSOR_PERK_KEYS,
  CERTIFICATE_BACKGROUNDS,
  CERTIFICATE_FONTS,
  CERTIFICATE_STYLES,
  CERTIFICATE_LOGO_PLACEMENTS,
  type EventStatus,
  type CertificateNamePlacement,
  type CertificateTheme,
  type CertificateContent,
  type CertificateStyle,
  type SponsorshipPackage,
  type EventPartner,
  type EventContact,
} from '../../models/event.model';
import { EventPartnershipModel } from '../../models/event-partnership.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { MembershipModel } from '../../models/membership.model';
import { hasCommunityPermission } from '../community.service';

// ---------------------------------------------------------------------------
// Small generic helpers used across every event sub-service.
// ---------------------------------------------------------------------------

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function ensureNonEmpty(value: string | undefined, label: string) {
  if (!value?.trim()) {
    throw new Error(`${label} is required`);
  }
}

export const COUNTED_STATUSES: EventStatus[] = ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED'];
export const PUBLIC_LIST_STATUSES: EventStatus[] = ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED'];

export async function getManagerMembership(communityId: string, userId: string) {
  const membership = await MembershipModel.findOne({ communityId, userId });
  if (!membership || !hasCommunityPermission(membership.role, 'COORDINATOR')) {
    throw new Error('Insufficient permissions');
  }
  return membership;
}

/** Community ids that can manage this event: the host plus accepted co-host partnerships. */
export async function eventManagingCommunityIds(event: { _id: unknown; communityId: unknown }) {
  const partnerships = await EventPartnershipModel.find({ eventId: event._id, status: 'ACCEPTED' }).select('communityId').lean();
  return [String(event.communityId), ...partnerships.map((p) => p.communityId.toString())];
}

/** All of the user's memberships across the host community and accepted co-host communities. */
export async function findEventMemberships(event: { _id: unknown; communityId: unknown }, userId: string) {
  const communityIds = await eventManagingCommunityIds(event);
  return MembershipModel.find({ communityId: { $in: communityIds }, userId }).lean();
}

type LeanMembership = { role: Parameters<typeof hasCommunityPermission>[0] };

export function membershipWith<T extends LeanMembership>(memberships: T[], requiredRole: Parameters<typeof hasCommunityPermission>[1]) {
  return memberships.find((m) => hasCommunityPermission(m.role, requiredRole)) ?? null;
}

/** Requires COORDINATOR+ (host or accepted co-host) — the standard "can manage this event" gate. */
export async function requireEventManager(eventId: string, actorId: string) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }
  const memberships = await findEventMemberships(event, actorId);
  if (!membershipWith(memberships, 'COORDINATOR')) {
    throw new Error('Insufficient permissions');
  }
  return event;
}

/** Requires VOLUNTEER+ (host or accepted co-host) — the QR scanner / check-in gate. */
export async function requireEventScanner(eventId: string, actorId: string) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }
  const memberships = await findEventMemberships(event, actorId);
  const membership = membershipWith(memberships, 'VOLUNTEER');
  if (!membership) {
    throw new Error('Insufficient permissions');
  }
  return { event, membership };
}

export async function recalcEventCounters(eventId: string) {
  const [registrationCount, checkedInCount, completedCount] = await Promise.all([
    EventRegistrationModel.countDocuments({ eventId, status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE', 'NO_SHOW'] } }),
    EventRegistrationModel.countDocuments({ eventId, status: { $in: ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] } }),
    EventRegistrationModel.countDocuments({ eventId, status: 'COMPLETED' }),
  ]);
  await EventModel.updateOne({ _id: eventId }, { registrationCount, checkedInCount, completedCount });
}

/** Clamp a speaker's day assignment to a sane 1-based value (null/0 = whole event). */
export function normalizeSpeakerDay(value: unknown): number | null {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 14) : null;
}

export type EventInput = Partial<{
  title: string;
  type: string;
  shortDescription: string;
  description: string;
  theme: string;
  features: string[];
  days: {
    date?: string | null;
    theme?: string;
    venue?: string;
    startTime?: string;
    endTime?: string;
    features?: string[];
    facilitators?: { name?: string; title?: string }[];
    sessions?: { time?: string; title?: string; venue?: string; facilitator?: string }[];
  }[];
  minimumAttendanceDays: number;
  contacts: Partial<EventContact>[];
  bannerImage: string;
  mode: 'PHYSICAL' | 'HYBRID' | 'VIRTUAL';
  venue: string;
  address: string;
  meetingLink: string;
  tags: string[];
  refreshments: boolean;
  gallery: string[];
  appreciationMode: 'AUTO' | 'CUSTOM' | 'OFF';
  startDate: string | null;
  endDate: string | null;
  timezone: string;
  registrationPolicy: 'OPEN' | 'APPROVAL' | 'INVITE';
  registrationDeadline: string | null;
  capacity: number;
  waitlistEnabled: boolean;
  allowWalkIns: boolean;
  qrEnabled: boolean;
  certificateEnabled: boolean;
  certificateMode: 'STANDARD' | 'CUSTOM';
  certificateType: 'ATTENDANCE' | 'COMPLETION' | 'LEADERSHIP' | 'VOLUNTEER';
  certificateTemplate: string;
  certificateNamePlacement: Partial<CertificateNamePlacement>;
  certificateTheme: Partial<CertificateTheme>;
  certificateStyle: CertificateStyle;
  certificateContent: Partial<CertificateContent>;
  minimumAttendanceDuration: number;
  checkOutRequired: boolean;
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  sponsorshipOpen: boolean;
  sponsorshipPitch: string;
  sponsorshipPackages: Partial<SponsorshipPackage>[];
  partners: Partial<EventPartner>[];
}>;

export function applyEventInput(target: any, input: EventInput) {
  if (input.title !== undefined) target.title = input.title.trim();
  if (input.type !== undefined) {
    if (!EVENT_TYPES.includes(input.type as any)) throw new Error('Invalid event type');
    target.type = input.type;
  }
  if (input.shortDescription !== undefined) target.shortDescription = input.shortDescription.trim();
  if (input.description !== undefined) target.description = input.description.trim();
  if (input.theme !== undefined) target.theme = String(input.theme).trim().slice(0, 120);
  if (input.features !== undefined) {
    if (!Array.isArray(input.features)) throw new Error('Features must be a list');
    target.features = input.features
      .filter((f): f is string => typeof f === 'string')
      .map((f) => f.trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 10);
  }
  if (input.days !== undefined) {
    if (!Array.isArray(input.days)) throw new Error('Days must be a list');
    const cleanTime = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.trim()) ? v.trim() : '');
    target.days = input.days
      .slice(0, 14)
      .map((d) => ({
        date: d?.date ? new Date(d.date) : null,
        theme: String(d?.theme ?? '').trim().slice(0, 120),
        venue: String(d?.venue ?? '').trim().slice(0, 160),
        startTime: cleanTime(d?.startTime),
        endTime: cleanTime(d?.endTime),
        features: Array.isArray(d?.features)
          ? d.features
              .filter((f): f is string => typeof f === 'string')
              .map((f) => f.trim().slice(0, 80))
              .filter(Boolean)
              .slice(0, 8)
          : [],
        facilitators: Array.isArray(d?.facilitators)
          ? d.facilitators
              .map((p) => ({
                name: String(p?.name ?? '').trim().slice(0, 80),
                title: String(p?.title ?? '').trim().slice(0, 100),
              }))
              .filter((p) => p.name)
              .slice(0, 6)
          : [],
        sessions: Array.isArray(d?.sessions)
          ? d.sessions
              .map((s) => ({
                time: cleanTime(s?.time),
                title: String(s?.title ?? '').trim().slice(0, 120),
                venue: String(s?.venue ?? '').trim().slice(0, 160),
                facilitator: String(s?.facilitator ?? '').trim().slice(0, 80),
              }))
              .filter((s) => s.title)
              .slice(0, 8)
          : [],
      }))
      // A day needs at least some content to be worth showing.
      .filter((d) => d.date || d.theme || d.venue || d.startTime || d.features.length || d.facilitators.length || d.sessions.length);
  }
  if (input.minimumAttendanceDays !== undefined) {
    target.minimumAttendanceDays = Math.max(0, Math.round(Number(input.minimumAttendanceDays) || 0));
  }
  if (input.contacts !== undefined) {
    if (!Array.isArray(input.contacts)) throw new Error('Contacts must be a list');
    target.contacts = input.contacts
      .slice(0, 3)
      .map((c) => ({
        name: String(c?.name ?? '').trim().slice(0, 60),
        phone: String(c?.phone ?? '').trim().slice(0, 30),
        email: String(c?.email ?? '').trim().slice(0, 120),
      }))
      // A contact needs at least one way to be reached.
      .filter((c) => c.phone || c.email);
  }
  if (input.bannerImage !== undefined) target.bannerImage = input.bannerImage.trim();
  if (input.mode !== undefined) target.mode = input.mode;
  if (input.venue !== undefined) target.venue = input.venue.trim();
  if (input.address !== undefined) target.address = input.address.trim();
  if (input.meetingLink !== undefined) target.meetingLink = input.meetingLink.trim();
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) throw new Error('Tags must be a list');
    target.tags = input.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().slice(0, 30))
      .filter(Boolean)
      .slice(0, 5);
  }
  if (input.refreshments !== undefined) target.refreshments = Boolean(input.refreshments);
  if (input.gallery !== undefined) {
    if (!Array.isArray(input.gallery)) throw new Error('Gallery must be a list of images');
    target.gallery = input.gallery
      .filter((g): g is string => typeof g === 'string')
      .map((g) => g.trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 6);
  }
  if (input.appreciationMode !== undefined) {
    if (!['AUTO', 'CUSTOM', 'OFF'].includes(input.appreciationMode)) throw new Error('Invalid appreciation mode');
    target.appreciationMode = input.appreciationMode;
  }
  if (input.startDate !== undefined) target.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.endDate !== undefined) target.endDate = input.endDate ? new Date(input.endDate) : null;
  if (input.timezone !== undefined) target.timezone = input.timezone;
  if (input.registrationPolicy !== undefined) target.registrationPolicy = input.registrationPolicy;
  if (input.registrationDeadline !== undefined) target.registrationDeadline = input.registrationDeadline ? new Date(input.registrationDeadline) : null;
  if (input.capacity !== undefined) target.capacity = Math.max(0, Number(input.capacity) || 0);
  if (input.waitlistEnabled !== undefined) target.waitlistEnabled = Boolean(input.waitlistEnabled);
  if (input.allowWalkIns !== undefined) target.allowWalkIns = Boolean(input.allowWalkIns);
  if (input.qrEnabled !== undefined) target.qrEnabled = Boolean(input.qrEnabled);
  if (input.certificateEnabled !== undefined) target.certificateEnabled = Boolean(input.certificateEnabled);
  if (input.certificateMode !== undefined) {
    if (!['STANDARD', 'CUSTOM'].includes(input.certificateMode)) throw new Error('Invalid certificate mode');
    target.certificateMode = input.certificateMode;
  }
  if (input.certificateType !== undefined) {
    if (!['ATTENDANCE', 'COMPLETION', 'LEADERSHIP', 'VOLUNTEER'].includes(input.certificateType)) throw new Error('Invalid certificate type');
    target.certificateType = input.certificateType;
  }
  if (input.certificateTemplate !== undefined) target.certificateTemplate = input.certificateTemplate.trim();
  if (input.certificateTheme !== undefined) {
    const current = target.certificateTheme ?? {};
    const t = input.certificateTheme;
    const accent = typeof t.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(t.accent) ? t.accent : current.accent ?? '#b8933a';
    const background = t.background && CERTIFICATE_BACKGROUNDS.includes(t.background) ? t.background : current.background ?? 'IVORY';
    const font = t.font && CERTIFICATE_FONTS.includes(t.font) ? t.font : current.font ?? 'SERIF';
    target.certificateTheme = { accent, background, font };
  }
  if (input.certificateStyle !== undefined) {
    if (!CERTIFICATE_STYLES.includes(input.certificateStyle)) throw new Error('Invalid certificate style');
    target.certificateStyle = input.certificateStyle;
  }
  if (input.certificateContent !== undefined) {
    const current = target.certificateContent ?? {};
    const c = input.certificateContent;
    const cap = (v: unknown, fallback: string, max: number) =>
      (typeof v === 'string' ? v : fallback).replace(/\s+/g, ' ').trim().slice(0, max);
    const sigs = Array.isArray(c.signatories) ? c.signatories : current.signatories ?? [];
    const placement = typeof c.logoPlacement === 'string' && CERTIFICATE_LOGO_PLACEMENTS.includes(c.logoPlacement as any)
      ? c.logoPlacement
      : current.logoPlacement ?? 'NONE';
    const logo = typeof c.logo === 'string' ? c.logo.trim().slice(0, 300) : current.logo ?? '';
    target.certificateContent = {
      title: cap(c.title, current.title ?? '', 60),
      presentation: cap(c.presentation, current.presentation ?? '', 90),
      message: cap(c.message, current.message ?? '', 260),
      signatories: sigs
        .slice(0, 3)
        .map((s: any) => ({
          name: cap(s?.name, '', 60),
          title: cap(s?.title, '', 80),
          image: typeof s?.image === 'string' ? s.image.trim().slice(0, 300) : '',
        }))
        .filter((s: { name: string; title: string; image: string }) => s.name || s.title || s.image),
      logo,
      logoPlacement: logo ? placement : 'NONE',
    };
  }
  if (input.certificateNamePlacement !== undefined) {
    const current = target.certificateNamePlacement ?? {};
    const p = input.certificateNamePlacement;
    target.certificateNamePlacement = {
      x: p.x !== undefined ? Number(p.x) : current.x ?? 50,
      y: p.y !== undefined ? Number(p.y) : current.y ?? 55,
      fontSize: p.fontSize !== undefined ? Number(p.fontSize) : current.fontSize ?? 6,
      color: p.color !== undefined ? String(p.color) : current.color ?? '#111111',
      align: p.align ?? current.align ?? 'center',
    };
  }
  if (input.minimumAttendanceDuration !== undefined) target.minimumAttendanceDuration = Math.max(0, Number(input.minimumAttendanceDuration) || 0);
  if (input.checkOutRequired !== undefined) target.checkOutRequired = Boolean(input.checkOutRequired);
  if (input.visibility !== undefined) target.visibility = input.visibility;
  if (input.sponsorshipOpen !== undefined) target.sponsorshipOpen = Boolean(input.sponsorshipOpen);
  if (input.sponsorshipPitch !== undefined) target.sponsorshipPitch = String(input.sponsorshipPitch).trim();
  if (input.sponsorshipPackages !== undefined) {
    if (!Array.isArray(input.sponsorshipPackages)) throw new Error('Invalid sponsorship packages');
    target.sponsorshipPackages = input.sponsorshipPackages
      .slice(0, 6)
      .map((p) => ({
        name: String(p?.name ?? '').trim(),
        price: String(p?.price ?? '').trim(),
        perks: Array.isArray(p?.perks)
          ? Array.from(new Set(p.perks.map(String).filter((k) => (SPONSOR_PERK_KEYS as readonly string[]).includes(k))))
          : [],
        benefits: String(p?.benefits ?? '').trim(),
      }))
      .filter((p) => p.name);
  }
  if (input.partners !== undefined) {
    if (!Array.isArray(input.partners)) throw new Error('Invalid partners');
    target.partners = input.partners
      .slice(0, 8)
      .map((p) => ({
        name: String(p?.name ?? '').trim().slice(0, 80),
        logo: String(p?.logo ?? '').trim().slice(0, 300),
        website: String(p?.website ?? '').trim().slice(0, 300),
      }))
      // Logo is required — partner logos are shown (logo-only) on certificates.
      .filter((p) => p.name && p.logo);
  }

  if (target.startDate && target.endDate && target.endDate < target.startDate) {
    throw new Error('End time must be after start time');
  }
}

// ---------------------------------------------------------------------------
// Multi-day attendance helpers. An event is "multi-day" when its agenda lists
// more than one day OR its start→end range spans more than one calendar day.
// Attendance is then bucketed per calendar day (attendee scans the same QR pass
// each day) and certificate eligibility = checked in on enough distinct days.
// ---------------------------------------------------------------------------

export type MultiDayEventLike = {
  days?: { date?: Date | null; endTime?: string }[] | null;
  startDate?: Date | null;
  endDate?: Date | null;
  minimumAttendanceDays?: number;
  timezone?: string;
};

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat | null>();

/**
 * Calendar-day bucket key YYYY-MM-DD in the event's timezone (e.g. "Africa/Lagos").
 * Falls back to UTC when the timezone is missing or invalid, so a bad value can
 * never break check-in.
 */
export function dayKeyOf(date: Date, timeZone?: string | null) {
  const tz = (timeZone ?? '').trim();
  if (tz) {
    let fmt = dayKeyFormatters.get(tz);
    if (fmt === undefined) {
      try {
        // en-CA formats as YYYY-MM-DD.
        fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
      } catch {
        fmt = null; // invalid timezone string — remembered so we don't re-throw per call
      }
      dayKeyFormatters.set(tz, fmt);
    }
    if (fmt) return fmt.format(date);
  }
  return date.toISOString().slice(0, 10);
}

/** Total scheduled days: explicit agenda days or the start→end calendar span, whichever is larger. */
export function eventTotalDays(event: MultiDayEventLike) {
  const agendaDays = event.days?.length ?? 0;
  let spanDays = 0;
  if (event.startDate && event.endDate) {
    const start = Date.parse(dayKeyOf(new Date(event.startDate), event.timezone));
    const end = Date.parse(dayKeyOf(new Date(event.endDate), event.timezone));
    spanDays = Math.round((end - start) / 86400000) + 1;
  }
  return Math.max(agendaDays, spanDays, 1);
}

export function isMultiDayEvent(event: MultiDayEventLike) {
  return eventTotalDays(event) > 1;
}

/** Distinct check-in days required for certificate eligibility (0/unset = every scheduled day). */
export function requiredAttendanceDays(event: MultiDayEventLike) {
  const total = eventTotalDays(event);
  const min = Math.round(Number(event.minimumAttendanceDays) || 0);
  return min > 0 ? Math.min(min, total) : total;
}

/** Key of the final scheduled day (from agenda dates and/or endDate), if any date is known. */
export function lastEventDayKey(event: MultiDayEventLike): string | null {
  const times = (event.days ?? [])
    .map((d) => (d.date ? new Date(d.date).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  if (event.endDate) times.push(new Date(event.endDate).getTime());
  if (!times.length) return null;
  return dayKeyOf(new Date(Math.max(...times)), event.timezone);
}

/** 1-based "Day N" for a given moment, from the agenda dates or the start-date offset (0 = outside the schedule). */
export function currentEventDay(event: MultiDayEventLike, now = new Date()) {
  const total = eventTotalDays(event);
  const today = dayKeyOf(now, event.timezone);
  const agendaIdx = (event.days ?? []).findIndex((d) => d.date && dayKeyOf(new Date(d.date), event.timezone) === today);
  if (agendaIdx >= 0) return agendaIdx + 1;
  if (event.startDate) {
    const startKey = dayKeyOf(new Date(event.startDate), event.timezone);
    const diff = Math.round((Date.parse(today) - Date.parse(startKey)) / 86400000) + 1;
    if (diff >= 1 && diff <= total) return diff;
  }
  return 0;
}

/**
 * Best-effort end-of-day instant for an attendance day: the matching agenda
 * day's date + its endTime. Used to credit minutes to attendees who forgot to
 * scan out (their day still counts either way).
 */
export function scheduledDayEnd(event: MultiDayEventLike, dayKey: string): number | null {
  const agendaDay = (event.days ?? []).find((d) => d.date && dayKeyOf(new Date(d.date), event.timezone) === dayKey);
  const timeMatch = agendaDay?.endTime ? /^(\d{2}):(\d{2})$/.exec(agendaDay.endTime) : null;
  if (agendaDay?.date && timeMatch) {
    // Agenda dates are stored at midnight of the wall-clock day, so adding the
    // end time lands on the intended local moment.
    return new Date(agendaDay.date).getTime() + Number(timeMatch[1]) * 3600_000 + Number(timeMatch[2]) * 60_000;
  }
  if (event.endDate && dayKeyOf(new Date(event.endDate), event.timezone) === dayKey) {
    return new Date(event.endDate).getTime();
  }
  return null;
}

/** Distinct calendar days this registration checked in on (legacy single stamp counts as one). */
export function distinctDaysAttended(
  event: MultiDayEventLike,
  registration: { attendanceDays?: { day: string; checkInAt?: Date | null }[] | null; checkInAt?: Date | null },
) {
  const days = new Set((registration.attendanceDays ?? []).filter((d) => d.checkInAt).map((d) => d.day));
  if (!days.size && registration.checkInAt) days.add(dayKeyOf(new Date(registration.checkInAt), event.timezone));
  return days.size;
}

/**
 * Records a check-in on the registration. Multi-day events bucket by calendar
 * day; single-day events keep the classic one-stamp behaviour.
 * Returns false when the attendee is already checked in (today, for multi-day).
 */
export function applyCheckIn(event: MultiDayEventLike, registration: InstanceType<typeof EventRegistrationModel>, now = new Date()) {
  if (!registration.attendanceDays) registration.attendanceDays = [] as any;
  if (isMultiDayEvent(event)) {
    const today = dayKeyOf(now, event.timezone);
    if (registration.attendanceDays.some((d) => d.day === today && d.checkInAt)) return false;
    registration.attendanceDays.push({ day: today, checkInAt: now, checkOutAt: null, minutes: 0 });
    if (!registration.checkInAt) registration.checkInAt = now;
  } else {
    if (registration.checkInAt) return false;
    registration.checkInAt = now;
  }
  registration.status = 'CHECKED_IN';
  return true;
}
