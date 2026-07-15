import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../config';
import { EventModel, EVENT_TYPES, SPONSOR_PERK_KEYS, CERTIFICATE_BACKGROUNDS, CERTIFICATE_FONTS, CERTIFICATE_STYLES, CERTIFICATE_LOGO_PLACEMENTS, DEFAULT_CERTIFICATE_THEME, DEFAULT_CERTIFICATE_CONTENT, type EventDocument, type EventStatus, type CertificateNamePlacement, type CertificateTheme, type CertificateContent, type CertificateStyle, type SponsorshipPackage, type EventPartner, type EventContact } from '../models/event.model';
import { EventSpeakerModel } from '../models/event-speaker.model';
import { EventSponsorModel } from '../models/event-sponsor.model';
import { EventPartnershipModel } from '../models/event-partnership.model';
import { EventVolunteerModel } from '../models/event-volunteer.model';
import { EventRegistrationModel, type EventRegistrationStatus } from '../models/event-registration.model';
import { EventFeedbackModel } from '../models/event-feedback.model';
import { CertificateModel } from '../models/certificate.model';
import { CommunityModel } from '../models/community.model';
import { MembershipModel } from '../models/membership.model';
import { authStore } from '../store/auth-store';
import { buildDomainActivityRecord } from './domain-activity.service';
import { hasCommunityPermission } from './community.service';
import { awardReputation, speakerReputation, REPUTATION_POINTS } from './reputation.service';
import { createMilestonePost } from './feed.service';
import { createNotification } from './notification.service';
import { sendEmail, certificateEarnedEmail, categoryEmail, type EmailCategory } from '../utils/email';
import {
  notifyRegistrationApproved,
  notifyRegistrationConfirmed,
  notifyRegistrationRejected,
  notifyVenueChanged,
} from './event-notification.service';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function ensureNonEmpty(value: string | undefined, label: string) {
  if (!value?.trim()) {
    throw new Error(`${label} is required`);
  }
}

const COUNTED_STATUSES: EventStatus[] = ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED'];
const PUBLIC_LIST_STATUSES: EventStatus[] = ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED'];

async function getManagerMembership(communityId: string, userId: string) {
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
async function findEventMemberships(event: { _id: unknown; communityId: unknown }, userId: string) {
  const communityIds = await eventManagingCommunityIds(event);
  return MembershipModel.find({ communityId: { $in: communityIds }, userId }).lean();
}

type LeanMembership = { role: Parameters<typeof hasCommunityPermission>[0] };

function membershipWith<T extends LeanMembership>(memberships: T[], requiredRole: Parameters<typeof hasCommunityPermission>[1]) {
  return memberships.find((m) => hasCommunityPermission(m.role, requiredRole)) ?? null;
}

export type EventInput = Partial<{
  title: string;
  type: string;
  shortDescription: string;
  description: string;
  theme: string;
  features: string[];
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

function applyEventInput(target: any, input: EventInput) {
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

export async function createEvent(communityId: string, creatorId: string, input: EventInput) {
  ensureNonEmpty(input.title, 'Event title');

  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }
  if (community.archivedAt) {
    throw new Error('Community is archived');
  }
  if (community.verificationStatus !== 'VERIFIED') {
    throw new Error('Only verified communities can host events');
  }

  await getManagerMembership(communityId, creatorId);

  const slug = `${slugify(input.title as string)}-${randomUUID().slice(0, 8)}`;
  const event = new EventModel({
    communityId,
    slug,
    createdBy: creatorId,
    status: 'DRAFT',
  });
  applyEventInput(event, input);
  // Free tier: pick any ready-made design + ONE signature. Premium unlocks the rest
  // (colours, fonts, custom wording, and 2–3 signatures). Premium can come from a
  // community-wide monthly subscription OR a per-event unlock.
  if (!community.isPremium && !event.premiumUnlocked) {
    event.certificateTheme = { ...DEFAULT_CERTIFICATE_THEME };
    const firstSig = (event.certificateContent?.signatories ?? []).slice(0, 1);
    event.certificateContent = { ...DEFAULT_CERTIFICATE_CONTENT, signatories: firstSig };
  }
  await event.save();

  return event;
}

export async function listEvents(filter: { communityId?: string } = {}) {
  const query: Record<string, unknown> = {
    deletedAt: null,
    visibility: 'PUBLIC',
    status: { $in: PUBLIC_LIST_STATUSES },
  };
  if (filter.communityId) {
    query.communityId = filter.communityId;
  } else {
    // Hide events belonging to archived communities from public listings
    // (reversible — they reappear when the community is reopened).
    const archived = await CommunityModel.find({ archivedAt: { $ne: null } }).select('_id').lean();
    if (archived.length) {
      query.communityId = { $nin: archived.map((c) => c._id) };
    }
  }
  const events = await EventModel.find(query).sort({ startDate: 1, createdAt: -1 }).lean();
  if (!events.length) {
    return events;
  }

  // Attach sponsors and speakers so listings (e.g. community profile) can render them.
  const eventIds = events.map((e) => e._id);
  const [sponsors, speakers] = await Promise.all([
    EventSponsorModel.find({ eventId: { $in: eventIds } }).sort({ createdAt: 1 }).lean(),
    EventSpeakerModel.find({ eventId: { $in: eventIds } }).sort({ createdAt: 1 }).lean(),
  ]);
  const sponsorsByEvent = new Map<string, typeof sponsors>();
  for (const sponsor of sponsors) {
    const key = sponsor.eventId.toString();
    if (!sponsorsByEvent.has(key)) sponsorsByEvent.set(key, []);
    sponsorsByEvent.get(key)!.push(sponsor);
  }
  const speakersByEvent = new Map<string, typeof speakers>();
  for (const speaker of speakers) {
    const key = speaker.eventId.toString();
    if (!speakersByEvent.has(key)) speakersByEvent.set(key, []);
    speakersByEvent.get(key)!.push(speaker);
  }

  return events.map((event) => ({
    ...event,
    sponsors: sponsorsByEvent.get(event._id.toString()) ?? [],
    speakers: speakersByEvent.get(event._id.toString()) ?? [],
  }));
}

export async function getEventById(id: string) {
  return EventModel.findOne({ _id: id, deletedAt: null });
}

async function loadEventDetail(event: EventDocument & { _id: any }) {
  const [speakers, sponsors, community] = await Promise.all([
    EventSpeakerModel.find({ eventId: event._id }).sort({ createdAt: 1 }).lean(),
    EventSponsorModel.find({ eventId: event._id }).sort({ createdAt: 1 }).lean(),
    CommunityModel.findById(event.communityId).lean(),
  ]);
  return { speakers, sponsors, community };
}

export async function getEventBySlug(slug: string, viewerId?: string) {
  const event = await EventModel.findOne({ slug, deletedAt: null }).lean();
  if (!event) {
    throw new Error('Event not found');
  }

  const viewerMemberships = viewerId ? await findEventMemberships(event as any, viewerId) : [];
  const viewerMembership = viewerMemberships.find((m) => m.communityId.toString() === event.communityId.toString()) ?? viewerMemberships[0] ?? null;
  const canManage = Boolean(membershipWith(viewerMemberships, 'COORDINATOR'));

  if (event.status === 'DRAFT' && !canManage) {
    throw new Error('Event not found');
  }
  if (event.visibility === 'PRIVATE' && !viewerMembership && !canManage) {
    throw new Error('This event is private to community members');
  }

  const { speakers, sponsors, community } = await loadEventDetail(event as any);
  const viewerRegistration = viewerId ? await EventRegistrationModel.findOne({ eventId: event._id, userId: viewerId }).lean() : null;

  // Public rating summary + whether this viewer may rate (attended + event over).
  const feedbackAgg = await EventFeedbackModel.aggregate([
    { $match: { eventId: event._id } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const feedback = feedbackAgg[0] ? { average: Math.round(feedbackAgg[0].average * 10) / 10, count: feedbackAgg[0].count } : { average: 0, count: 0 };
  const eventOver = ['CHECK_OUT', 'COMPLETED', 'ARCHIVED'].includes(event.status) || (event.endDate ? new Date(event.endDate).getTime() < Date.now() : false);
  const viewerCanRate = Boolean(viewerId && viewerRegistration?.checkInAt && eventOver);
  const viewerFeedback = viewerId
    ? await EventFeedbackModel.findOne({ eventId: event._id, userId: viewerId }).select('rating comment').lean()
    : null;

  // Accepted co-host communities (public display) + a pending invite the viewer can act on.
  const partnerships = await EventPartnershipModel.find({ eventId: event._id, status: { $in: ['ACCEPTED', 'PENDING'] } }).lean();
  const partnerCommunityIds = partnerships.map((p) => p.communityId);
  const partnerCommunities = partnerCommunityIds.length
    ? await CommunityModel.find({ _id: { $in: partnerCommunityIds } }).select('name slug logo verificationStatus').lean()
    : [];
  const communityById = new Map(partnerCommunities.map((c) => [c._id.toString(), c]));
  const coHosts = partnerships
    .filter((p) => p.status === 'ACCEPTED')
    .map((p) => {
      const c = communityById.get(p.communityId.toString());
      return c ? { partnershipId: p._id.toString(), name: c.name, slug: c.slug, logo: c.logo } : null;
    })
    .filter(Boolean);

  let viewerPartnershipInvite: { partnershipId: string; communityName: string } | null = null;
  if (viewerId) {
    for (const p of partnerships) {
      if (p.status !== 'PENDING') continue;
      const m = await MembershipModel.findOne({ communityId: p.communityId, userId: viewerId }).lean();
      if (m && hasCommunityPermission(m.role, 'VICE_PRESIDENT')) {
        const c = communityById.get(p.communityId.toString());
        viewerPartnershipInvite = { partnershipId: p._id.toString(), communityName: c?.name ?? '' };
        break;
      }
    }
  }

  return {
    event,
    speakers,
    sponsors,
    community: community
      ? { id: community._id.toString(), name: community.name, slug: community.slug, logo: community.logo, verificationStatus: community.verificationStatus }
      : null,
    coHosts,
    viewerPartnershipInvite,
    viewerRegistration,
    feedback,
    viewerCanRate,
    viewerFeedback: viewerFeedback ? { rating: viewerFeedback.rating, comment: viewerFeedback.comment } : null,
    canManage,
  };
}

export async function requireEditableEvent(id: string, actorId: string) {
  const event = await EventModel.findOne({ _id: id, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }
  if (event.status === 'ARCHIVED') {
    throw new Error('Archived events cannot be modified');
  }

  const memberships = await findEventMemberships(event, actorId);
  if (!membershipWith(memberships, 'COORDINATOR')) {
    throw new Error('Insufficient permissions');
  }
  const isOwner = event.createdBy.toString() === actorId;
  if (!isOwner && !membershipWith(memberships, 'VICE_PRESIDENT')) {
    throw new Error('Only the event owner or senior leaders can modify this event');
  }

  return event;
}

/**
 * "Run it again" — clones a past event into a fresh DRAFT in the same community.
 * Copies content/settings and the speaker lineup; resets dates, counters, and
 * anything transactional (sponsors, partnerships, per-event premium unlock).
 */
export async function cloneEvent(eventId: string, actorId: string) {
  const source = await requireEventManager(eventId, actorId);

  const copy = new EventModel({
    communityId: source.communityId,
    slug: `${slugify(source.title)}-${randomUUID().slice(0, 8)}`,
    createdBy: actorId,
    status: 'DRAFT',
    title: source.title,
    type: source.type,
    shortDescription: source.shortDescription,
    description: source.description,
    theme: source.theme,
    features: [...(source.features ?? [])],
    contacts: (source.contacts ?? []).map((c) => ({ name: c.name, phone: c.phone, email: c.email })),
    bannerImage: source.bannerImage,
    mode: source.mode,
    venue: source.venue,
    address: source.address,
    meetingLink: source.meetingLink,
    tags: [...(source.tags ?? [])],
    refreshments: source.refreshments,
    gallery: [...(source.gallery ?? [])],
    appreciationMode: source.appreciationMode,
    timezone: source.timezone,
    registrationPolicy: source.registrationPolicy,
    capacity: source.capacity,
    waitlistEnabled: source.waitlistEnabled,
    allowWalkIns: source.allowWalkIns,
    qrEnabled: source.qrEnabled,
    certificateEnabled: source.certificateEnabled,
    certificateMode: source.certificateMode,
    certificateType: source.certificateType,
    certificateTemplate: source.certificateTemplate,
    certificateNamePlacement: source.certificateNamePlacement,
    certificateTheme: source.certificateTheme,
    certificateStyle: source.certificateStyle,
    certificateContent: source.certificateContent,
    minimumAttendanceDuration: source.minimumAttendanceDuration,
    checkOutRequired: source.checkOutRequired,
    visibility: source.visibility,
    sponsorshipOpen: source.sponsorshipOpen,
    sponsorshipPitch: source.sponsorshipPitch,
    sponsorshipPackages: (source.sponsorshipPackages ?? []).map((p) => ({ name: p.name, price: p.price, perks: [...(p.perks ?? [])], benefits: p.benefits })),
    partners: (source.partners ?? []).map((p) => ({ name: p.name, logo: p.logo, website: p.website })),
    // Deliberately reset: startDate/endDate, premiumUnlocked (paid per event),
    // counters, reminder/finalize/appreciation stamps.
  });
  await copy.save();

  // Same speaker lineup is the common case for recurring events.
  const speakers = await EventSpeakerModel.find({ eventId: source._id }).lean();
  if (speakers.length) {
    await EventSpeakerModel.insertMany(
      speakers.map((s) => ({
        eventId: copy._id,
        userId: s.userId,
        speakerType: s.speakerType,
        fullName: s.fullName,
        title: s.title,
        organization: s.organization,
        bio: s.bio,
        photo: s.photo,
        linkedinUrl: s.linkedinUrl,
      })),
    );
  }

  return copy;
}

export async function updateEvent(id: string, actorId: string, input: EventInput) {
  const event = await requireEditableEvent(id, actorId);
  const prevVenue = event.venue;
  const prevLink = event.meetingLink;
  const prevStart = event.startDate ? new Date(event.startDate).getTime() : null;
  applyEventInput(event, input);
  // Free tier keeps the design + one signature; premium unlocks full customization.
  // Premium = community monthly subscription OR this event's per-event unlock.
  {
    const community = await CommunityModel.findById(event.communityId).select('isPremium').lean();
    if (!community?.isPremium && !event.premiumUnlocked) {
      event.certificateTheme = { ...DEFAULT_CERTIFICATE_THEME };
      const firstSig = (event.certificateContent?.signatories ?? []).slice(0, 1);
      event.certificateContent = { ...DEFAULT_CERTIFICATE_CONTENT, signatories: firstSig };
    }
  }
  const newStart = event.startDate ? new Date(event.startDate).getTime() : null;
  if (prevStart !== newStart) {
    event.reminderSentAt = null;
  }
  await event.save();
  if ((event.venue !== prevVenue || event.meetingLink !== prevLink) && ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'].includes(event.status)) {
    void notifyVenueChanged(event._id.toString(), { title: event.title, slug: event.slug, startDate: event.startDate, venue: event.venue, meetingLink: event.meetingLink });
  }
  return event;
}

export async function publishEvent(id: string, actorId: string) {
  const event = await requireEditableEvent(id, actorId);

  if (event.status !== 'DRAFT') {
    return event;
  }
  if (!event.bannerImage) {
    throw new Error('A banner image is required to publish');
  }
  ensureNonEmpty(event.title, 'Event title');
  // Location requirements by mode: physical needs a venue, virtual needs a
  // meeting link, hybrid needs BOTH so every attendee knows where to go.
  if ((event.mode === 'PHYSICAL' || event.mode === 'HYBRID') && !event.venue.trim()) {
    throw new Error(event.mode === 'HYBRID' ? 'Hybrid events need a physical venue AND an online meeting link' : 'A venue is required for physical events');
  }
  if ((event.mode === 'VIRTUAL' || event.mode === 'HYBRID') && !event.meetingLink.trim()) {
    throw new Error(event.mode === 'HYBRID' ? 'Hybrid events need a physical venue AND an online meeting link' : 'A meeting link is required for virtual events');
  }

  event.status = 'PUBLISHED';
  await event.save();

  await CommunityModel.updateOne({ _id: event.communityId }, { $inc: { eventCount: 1 } });

  return event;
}

export async function setEventStatus(id: string, actorId: string, status: EventStatus) {
  const event = await requireEditableEvent(id, actorId);
  event.status = status;
  await event.save();
  return event;
}

export async function archiveEvent(id: string, actorId: string) {
  const event = await EventModel.findOne({ _id: id, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }

  const membership = await MembershipModel.findOne({ communityId: event.communityId, userId: actorId });
  const isOwner = event.createdBy.toString() === actorId;
  if (!membership || (!isOwner && !hasCommunityPermission(membership.role, 'VICE_PRESIDENT'))) {
    throw new Error('Insufficient permissions');
  }

  const wasCounted = COUNTED_STATUSES.includes(event.status);
  event.status = 'ARCHIVED';
  await event.save();

  if (wasCounted) {
    await CommunityModel.updateOne({ _id: event.communityId }, { $inc: { eventCount: -1 } });
  }

  return event;
}

/** Admin-only: take an event down (archive) regardless of ownership. */
export async function adminArchiveEvent(id: string) {
  const event = await EventModel.findOne({ _id: id, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }
  const wasCounted = COUNTED_STATUSES.includes(event.status);
  event.status = 'ARCHIVED';
  await event.save();
  if (wasCounted) {
    await CommunityModel.updateOne({ _id: event.communityId }, { $inc: { eventCount: -1 } });
  }
  return event;
}

export async function deleteEvent(id: string, actorId: string) {
  const event = await EventModel.findOne({ _id: id, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }

  const membership = await MembershipModel.findOne({ communityId: event.communityId, userId: actorId });
  const isOwner = event.createdBy.toString() === actorId;
  if (!membership || (!isOwner && !hasCommunityPermission(membership.role, 'VICE_PRESIDENT'))) {
    throw new Error('Insufficient permissions');
  }

  const wasCounted = COUNTED_STATUSES.includes(event.status);
  event.deletedAt = new Date();
  await event.save();

  if (wasCounted) {
    await CommunityModel.updateOne({ _id: event.communityId }, { $inc: { eventCount: -1 } });
  }

  return { message: 'Event deleted' };
}

export async function addEventSpeaker(
  eventId: string,
  actorId: string,
  input: { fullName?: string; title?: string; organization?: string; bio?: string; photo?: string; linkedinUrl?: string; userId?: string | null; speakerType?: string },
) {
  await requireEditableEvent(eventId, actorId);
  ensureNonEmpty(input.fullName, 'Speaker name');

  let userId: string | null = null;
  if (input.userId) {
    const linked = await authStore.getPublicUserById(input.userId);
    if (!linked) throw new Error('Linked GuildOS user not found');
    userId = input.userId;
  }
  const speakerType = ['WORKSHOP', 'PANEL', 'GUEST'].includes(input.speakerType ?? '') ? input.speakerType : 'GUEST';

  return EventSpeakerModel.create({
    eventId,
    userId,
    speakerType,
    fullName: input.fullName!.trim(),
    title: input.title?.trim() ?? '',
    organization: input.organization?.trim() ?? '',
    bio: input.bio?.trim() ?? '',
    photo: input.photo?.trim() ?? '',
    linkedinUrl: input.linkedinUrl?.trim() ?? '',
  });
}

export async function updateEventSpeaker(
  eventId: string,
  speakerId: string,
  actorId: string,
  input: { fullName?: string; title?: string; organization?: string; bio?: string; photo?: string; linkedinUrl?: string; userId?: string | null; speakerType?: string },
) {
  const event = await requireEditableEvent(eventId, actorId);
  const speaker = await EventSpeakerModel.findOne({ _id: speakerId, eventId });
  if (!speaker) {
    throw new Error('Speaker not found');
  }

  if (input.fullName !== undefined) {
    ensureNonEmpty(input.fullName, 'Speaker name');
    speaker.fullName = input.fullName.trim();
  }
  if (input.title !== undefined) speaker.title = input.title.trim();
  if (input.organization !== undefined) speaker.organization = input.organization.trim();
  if (input.bio !== undefined) speaker.bio = input.bio.trim();
  if (input.photo !== undefined) speaker.photo = input.photo.trim();
  if (input.linkedinUrl !== undefined) speaker.linkedinUrl = input.linkedinUrl.trim();
  if (input.speakerType !== undefined && ['WORKSHOP', 'PANEL', 'GUEST'].includes(input.speakerType)) {
    speaker.speakerType = input.speakerType as 'WORKSHOP' | 'PANEL' | 'GUEST';
  }
  if (input.userId !== undefined) {
    if (input.userId === null || input.userId === '') {
      speaker.userId = null;
    } else {
      const linked = await authStore.getPublicUserById(input.userId);
      if (!linked) throw new Error('Linked GuildOS user not found');
      speaker.userId = new mongoose.Types.ObjectId(input.userId);
    }
  }

  await speaker.save();
  // Late tagging: if the event is already finalized, award the newly linked speaker now.
  if (speaker.userId && (event.status === 'COMPLETED' || event.attendanceFinalizedAt)) {
    await awardEventSpeaker(speaker, event);
  }
  return speaker;
}

export async function searchSpeakerUsers(eventId: string, actorId: string, query: string) {
  await requireEditableEvent(eventId, actorId);
  return authStore.searchPublicUsers(query, 10);
}

async function awardEventSpeaker(
  speaker: { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId | null; speakerType: 'WORKSHOP' | 'PANEL' | 'GUEST' },
  event: { _id: mongoose.Types.ObjectId; title: string; communityId: mongoose.Types.ObjectId },
) {
  if (!speaker.userId) return;
  await awardReputation({
    userId: speaker.userId.toString(),
    category: 'SPEAKER',
    type: 'SPEAKER_CONTRIBUTION',
    referenceId: speaker._id.toString(),
    communityId: event.communityId.toString(),
    scoreAwarded: speakerReputation(speaker.speakerType),
    description: `Spoke at ${event.title}`,
  });
}

export async function listEventVolunteers(eventId: string, actorId: string) {
  await requireEditableEvent(eventId, actorId);
  const volunteers = await EventVolunteerModel.find({ eventId }).sort({ createdAt: 1 }).lean();
  return volunteers.map((v) => ({
    _id: v._id.toString(),
    eventId: v.eventId.toString(),
    userId: v.userId.toString(),
    fullName: v.fullName,
    role: v.role,
    createdAt: v.createdAt,
  }));
}

export async function addEventVolunteer(
  eventId: string,
  actorId: string,
  input: { userId?: string; role?: string },
) {
  const event = await requireEditableEvent(eventId, actorId);
  if (!input.userId) {
    throw new Error('A GuildOS user is required to credit a volunteer');
  }
  const user = await authStore.getPublicUserById(input.userId);
  if (!user) {
    throw new Error('Volunteer user not found');
  }

  const existing = await EventVolunteerModel.findOne({ eventId, userId: input.userId });
  if (existing) {
    throw new Error('This user is already credited as a volunteer for this event');
  }

  const volunteer = await EventVolunteerModel.create({
    eventId,
    userId: input.userId,
    fullName: user.fullName,
    role: input.role?.trim() ?? '',
    addedBy: actorId,
  });

  // Late tagging: if the event already finished, credit the volunteer now.
  if (event.status === 'COMPLETED' || event.attendanceFinalizedAt) {
    await awardEventVolunteer(volunteer, event);
  }

  return {
    _id: volunteer._id.toString(),
    eventId: volunteer.eventId.toString(),
    userId: volunteer.userId.toString(),
    fullName: volunteer.fullName,
    role: volunteer.role,
    createdAt: volunteer.createdAt,
  };
}

export async function removeEventVolunteer(eventId: string, volunteerId: string, actorId: string) {
  await requireEditableEvent(eventId, actorId);
  const volunteer = await EventVolunteerModel.findOne({ _id: volunteerId, eventId });
  if (!volunteer) {
    throw new Error('Volunteer not found');
  }
  await volunteer.deleteOne();
  return { message: 'Volunteer removed' };
}

export async function searchVolunteerUsers(eventId: string, actorId: string, query: string) {
  await requireEditableEvent(eventId, actorId);
  return authStore.searchPublicUsers(query, 10);
}

async function awardEventVolunteer(
  volunteer: { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; role: string },
  event: { _id: mongoose.Types.ObjectId; title: string; communityId: mongoose.Types.ObjectId },
) {
  await awardReputation({
    userId: volunteer.userId.toString(),
    category: 'VOLUNTEER',
    type: 'VOLUNTEER_CONTRIBUTION',
    referenceId: volunteer._id.toString(),
    communityId: event.communityId.toString(),
    scoreAwarded: 20,
    description: volunteer.role ? `Volunteered (${volunteer.role}) at ${event.title}` : `Volunteered at ${event.title}`,
  });
}

export async function addEventSponsor(
  eventId: string,
  actorId: string,
  input: { name?: string; logo?: string; website?: string },
) {
  await requireEditableEvent(eventId, actorId);
  ensureNonEmpty(input.name, 'Sponsor name');

  return EventSponsorModel.create({
    eventId,
    name: input.name!.trim(),
    logo: input.logo?.trim() ?? '',
    website: input.website?.trim() ?? '',
  });
}

export async function removeEventSpeaker(eventId: string, speakerId: string, actorId: string) {
  await requireEditableEvent(eventId, actorId);
  const speaker = await EventSpeakerModel.findOne({ _id: speakerId, eventId });
  if (!speaker) {
    throw new Error('Speaker not found');
  }
  await speaker.deleteOne();
  return { message: 'Speaker removed' };
}

export async function removeEventSponsor(eventId: string, sponsorId: string, actorId: string) {
  await requireEditableEvent(eventId, actorId);
  const sponsor = await EventSponsorModel.findOne({ _id: sponsorId, eventId });
  if (!sponsor) {
    throw new Error('Sponsor not found');
  }
  await sponsor.deleteOne();
  return { message: 'Sponsor removed' };
}

export async function getEventAnalytics(id: string, actorId: string) {
  const event = await EventModel.findOne({ _id: id, deletedAt: null }).lean();
  if (!event) {
    throw new Error('Event not found');
  }

  const memberships = await findEventMemberships(event, actorId);
  if (!membershipWith(memberships, 'COORDINATOR')) {
    throw new Error('Insufficient permissions');
  }

  const registrationCount = event.registrationCount ?? 0;
  const checkedInCount = event.checkedInCount ?? 0;
  const completedCount = event.completedCount ?? 0;

  const attended = await EventRegistrationModel.find({ eventId: id, checkOutAt: { $ne: null } }).select('attendanceMinutes').lean();
  const averageAttendanceDuration = attended.length
    ? Math.round(attended.reduce((sum, r) => sum + (r.attendanceMinutes ?? 0), 0) / attended.length)
    : 0;

  const [confirmedCount, pendingCount, waitlistCount, walkInCount] = await Promise.all([
    EventRegistrationModel.countDocuments({ eventId: id, status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] } }),
    EventRegistrationModel.countDocuments({ eventId: id, status: 'PENDING_APPROVAL' }),
    EventRegistrationModel.countDocuments({ eventId: id, status: 'WAITLISTED' }),
    EventRegistrationModel.countDocuments({ eventId: id, registrationType: 'WALK_IN' }),
  ]);

  return {
    registrationCount,
    confirmedCount,
    pendingCount,
    waitlistCount,
    walkInCount,
    checkedInCount,
    completedCount,
    certificatesIssued: event.certificatesIssued ?? 0,
    checkInRate: registrationCount ? Math.round((checkedInCount / registrationCount) * 100) : 0,
    completionRate: registrationCount ? Math.round((completedCount / registrationCount) * 100) : 0,
    attendanceRate: registrationCount ? Math.round((checkedInCount / registrationCount) * 100) : 0,
    averageAttendanceDuration,
  };
}

export async function listCommunityEventsForManager(communityId: string, actorId: string) {
  await getManagerMembership(communityId, actorId);
  return EventModel.find({ communityId, deletedAt: null }).sort({ createdAt: -1 }).lean();
}

async function recalcEventCounters(eventId: string) {
  const [registrationCount, checkedInCount, completedCount] = await Promise.all([
    EventRegistrationModel.countDocuments({ eventId, status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE', 'NO_SHOW'] } }),
    EventRegistrationModel.countDocuments({ eventId, status: { $in: ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] } }),
    EventRegistrationModel.countDocuments({ eventId, status: 'COMPLETED' }),
  ]);
  await EventModel.updateOne({ _id: eventId }, { registrationCount, checkedInCount, completedCount });
}

async function requireEventManager(eventId: string, actorId: string) {
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

async function requireEventScanner(eventId: string, actorId: string) {
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

export async function registerForEvent(eventId: string, userId: string, options: { attendanceMode?: string | null } = {}) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }
  if (!['PUBLISHED', 'CHECK_IN'].includes(event.status)) {
    throw new Error('Registration is not open for this event');
  }
  if (event.registrationPolicy === 'INVITE') {
    throw new Error('This event is invite only');
  }
  if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
    throw new Error('The registration deadline has passed');
  }

  // Attendance mode: fixed by event mode, except hybrid where the attendee chooses.
  const attendanceMode =
    event.mode === 'VIRTUAL'
      ? 'ONLINE'
      : event.mode === 'PHYSICAL'
        ? 'PHYSICAL'
        : options.attendanceMode === 'ONLINE' || options.attendanceMode === 'PHYSICAL'
          ? options.attendanceMode
          : null;

  const existing = await EventRegistrationModel.findOne({ eventId, userId });
  if (existing && existing.status !== 'CANCELLED') {
    return existing;
  }

  // Approval-required events queue the request for leadership review.
  if (event.registrationPolicy === 'APPROVAL') {
    const registration = existing
      ? Object.assign(existing, { status: 'PENDING_APPROVAL' as EventRegistrationStatus, registrationType: 'APPROVAL', attendanceMode, communityId: event.communityId, registeredAt: new Date(), qrToken: existing.qrToken || randomUUID() })
      : new EventRegistrationModel({ eventId, communityId: event.communityId, userId, registrationType: 'APPROVAL', attendanceMode, status: 'PENDING_APPROVAL', qrToken: randomUUID() });
    await registration.save();
    return registration;
  }

  const activeCount = await EventRegistrationModel.countDocuments({
    eventId,
    status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] },
  });
  const isFull = event.capacity > 0 && activeCount >= event.capacity;
  let status: EventRegistrationStatus = 'CONFIRMED';
  if (isFull) {
    if (!event.waitlistEnabled) {
      throw new Error('This event is full');
    }
    status = 'WAITLISTED';
  }

  const registration = existing
    ? Object.assign(existing, { status, registrationType: 'OPEN', attendanceMode, communityId: event.communityId, registeredAt: new Date(), qrToken: existing.qrToken || randomUUID() })
    : new EventRegistrationModel({ eventId, communityId: event.communityId, userId, registrationType: 'OPEN', attendanceMode, status, qrToken: randomUUID() });
  await registration.save();

  if (status === 'CONFIRMED') {
    notifyRegistrationConfirmed(userId, { title: event.title, slug: event.slug, startDate: event.startDate, venue: event.venue, meetingLink: event.meetingLink });
  }

  await recalcEventCounters(eventId);
  return registration;
}

export async function approveRegistration(eventId: string, registrationId: string, actorId: string) {
  await requireEventManager(eventId, actorId);
  const event = await EventModel.findById(eventId);
  const registration = await EventRegistrationModel.findById(registrationId);
  if (!event || !registration || registration.eventId.toString() !== eventId) {
    throw new Error('Registration not found');
  }
  if (registration.status !== 'PENDING_APPROVAL') {
    return registration;
  }

  const activeCount = await EventRegistrationModel.countDocuments({
    eventId,
    status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] },
  });
  const isFull = event.capacity > 0 && activeCount >= event.capacity;
  registration.status = isFull ? 'WAITLISTED' : 'CONFIRMED';
  registration.approvedAt = new Date();
  registration.approvedBy = actorId as any;
  await registration.save();
  if (registration.status === 'CONFIRMED') {
    notifyRegistrationApproved(registration.userId.toString(), { title: event.title, slug: event.slug, startDate: event.startDate, venue: event.venue, meetingLink: event.meetingLink });
  }
  await recalcEventCounters(eventId);
  return registration;
}

export async function rejectRegistration(eventId: string, registrationId: string, actorId: string) {
  const event = await requireEventManager(eventId, actorId);
  const registration = await EventRegistrationModel.findById(registrationId);
  if (!registration || registration.eventId.toString() !== eventId) {
    throw new Error('Registration not found');
  }
  registration.status = 'REJECTED';
  await registration.save();
  notifyRegistrationRejected(registration.userId.toString(), { title: event.title, slug: event.slug });
  await recalcEventCounters(eventId);
  return registration;
}

export async function cancelRegistration(eventId: string, userId: string) {
  const registration = await EventRegistrationModel.findOne({ eventId, userId });
  if (!registration || registration.status === 'CANCELLED' || registration.status === 'REJECTED') {
    throw new Error('Registration not found');
  }

  registration.status = 'CANCELLED';
  await registration.save();

  const event = await EventModel.findById(eventId);
  if (event?.waitlistEnabled) {
    const nextWaitlisted = await EventRegistrationModel.findOne({ eventId, status: 'WAITLISTED' }).sort({ registeredAt: 1 });
    if (nextWaitlisted) {
      nextWaitlisted.status = 'CONFIRMED';
      await nextWaitlisted.save();
    }
  }

  await recalcEventCounters(eventId);
  return { message: 'Registration cancelled' };
}

export async function getMyRegistration(eventId: string, userId: string) {
  return EventRegistrationModel.findOne({ eventId, userId }).lean();
}

export async function listEventRegistrations(eventId: string, actorId: string) {
  await requireEventManager(eventId, actorId);
  const registrations = await EventRegistrationModel.find({ eventId }).sort({ registeredAt: 1 }).lean();
  const enriched = await Promise.all(
    registrations.map(async (registration) => {
      const user = await authStore.getPublicUserById(registration.userId.toString());
      return {
        registration,
        user: user
          ? {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              department: user.profile?.department ?? '',
              faculty: user.profile?.faculty ?? '',
              university: user.profile?.university ?? '',
            }
          : null,
      };
    }),
  );
  return enriched;
}

/** Organizer-designed appreciation email (rendered in the shared branded shell). */
export type AppreciationDesign = {
  category?: string;
  subject?: string;
  heading?: string;
  message?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  note?: string;
};

/**
 * Send a branded thank-you (email + in-app) to everyone who actually attended.
 * One blast per event; the organizer designs the email (tone, subject, body, CTA).
 */
export async function sendEventAppreciation(eventId: string, actorId: string, design: AppreciationDesign = {}) {
  const event = await requireEventManager(eventId, actorId);
  if (event.appreciationSentAt) {
    throw new Error('An appreciation message was already sent for this event');
  }
  const community = await CommunityModel.findById(event.communityId).select('name').lean();
  const communityName = community?.name ?? 'the organizing community';

  const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const category: EmailCategory = design.category === 'INFO' || design.category === 'CONFIRMATION' ? design.category : 'CONGRATS';
  const message =
    clean(design.message, 2000) ||
    `Thank you for attending ${event.title}. Your presence made the event a success — we hope to see you at the next one!`;
  const subject = clean(design.subject, 120) || `Thank you for attending ${event.title}`;
  const heading = clean(design.heading, 120) || subject;
  const ctaLabel = clean(design.ctaLabel, 40);
  const rawCtaUrl = clean(design.ctaUrl, 300);
  const ctaUrl = rawCtaUrl && /^https?:\/\//i.test(rawCtaUrl) ? rawCtaUrl : '';
  const note = clean(design.note, 200) || `Sent by ${communityName} via GuildOS`;

  const attended = await EventRegistrationModel.find({
    eventId,
    $or: [{ status: { $in: ['CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] } }, { checkInAt: { $ne: null } }],
    status: { $nin: ['CANCELLED', 'REJECTED'] },
  }).select('userId').lean();

  let emailed = 0;
  let notified = 0;
  for (const reg of attended) {
    const user = await authStore.getPublicUserById(reg.userId.toString()).catch(() => null);
    if (!user) continue;
    await createNotification({
      userId: reg.userId.toString(),
      actorId,
      type: 'SYSTEM',
      title: `💚 ${subject}`,
      body: message.slice(0, 200),
      link: `/events/${event.slug}`,
    }).catch(() => undefined);
    notified += 1;
    if (user.email) {
      void sendEmail(
        user.email,
        categoryEmail(category, {
          name: user.fullName,
          subject,
          heading,
          message,
          ctaLabel: ctaLabel && ctaUrl ? ctaLabel : undefined,
          ctaUrl: ctaLabel && ctaUrl ? ctaUrl : undefined,
          note,
        }),
      ).catch(() => undefined);
      emailed += 1;
    }
  }

  event.appreciationSentAt = new Date();
  await event.save();
  return { attendees: attended.length, notified, emailed };
}

export async function checkInRegistration(
  eventId: string,
  registrationId: string,
  actorId: string,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const { event, membership } = await requireEventScanner(eventId, actorId);
  if (!['CHECK_IN', 'CHECK_OUT'].includes(event.status)) {
    throw new Error('Check-in has not started');
  }
  const registration = await EventRegistrationModel.findById(registrationId);
  if (!registration || registration.eventId.toString() !== eventId) {
    throw new Error('Student is not registered');
  }
  if (registration.status === 'CANCELLED' || registration.status === 'REJECTED') {
    throw new Error('This registration is not eligible for check-in');
  }
  if (registration.checkInAt) {
    throw new Error('Student already checked in');
  }
  registration.checkInAt = new Date();
  registration.status = 'CHECKED_IN';
  registration.attendanceVerified = true;
  registration.checkedInBy = actorId as any;
  registration.scannerRole = membership.role;
  if (meta.ip) registration.checkInIp = meta.ip;
  if (meta.userAgent) registration.checkInUserAgent = meta.userAgent;
  await registration.save();
  await recalcEventCounters(eventId);
  return registration;
}

export async function checkInByToken(token: string, actorId: string, meta: { ip?: string; userAgent?: string } = {}) {
  const registration = await EventRegistrationModel.findOne({ qrToken: token });
  if (!registration) {
    throw new Error('Invalid attendance pass');
  }
  return checkInRegistration(registration.eventId.toString(), registration._id.toString(), actorId, meta);
}

export async function attendanceCheckIn(
  actorId: string,
  input: { registrationId?: string; token?: string },
  meta: { ip?: string; userAgent?: string } = {},
) {
  let registration = null;
  if (input.registrationId) {
    registration = await EventRegistrationModel.findById(input.registrationId);
  } else if (input.token) {
    registration = await EventRegistrationModel.findOne({ qrToken: input.token });
  }
  if (!registration) {
    throw new Error('Invalid attendance pass');
  }
  const result = await checkInRegistration(registration.eventId.toString(), registration._id.toString(), actorId, meta);
  const [user, event] = await Promise.all([
    authStore.getPublicUserById(result.userId.toString()),
    EventModel.findById(result.eventId).select('title slug').lean(),
  ]);
  return {
    success: true,
    student: user?.fullName ?? '',
    event: event?.title ?? '',
    checkedInAt: result.checkInAt,
  };
}

/**
 * Shared check-out completion: stamps times, decides COMPLETED vs PARTIAL
 * (stay to the end + minimum duration), saves and awards reputation.
 */
async function finishCheckOut(
  event: InstanceType<typeof EventModel>,
  registration: InstanceType<typeof EventRegistrationModel>,
  actorId: string,
  scannerRole: string,
  meta: { ip?: string; userAgent?: string } = {},
) {
  registration.checkOutAt = new Date();
  registration.attendanceMinutes = Math.max(0, Math.round((registration.checkOutAt.getTime() - registration.checkInAt!.getTime()) / 60000));

  // Attendees must stay to the end: completion requires checking out at/after the event end
  // time (when scheduled) and meeting any configured minimum attendance duration.
  const stayedToEnd = event.endDate ? registration.checkOutAt.getTime() >= new Date(event.endDate).getTime() : true;
  const meetsDuration = registration.attendanceMinutes >= (event.minimumAttendanceDuration ?? 0);
  const completed = stayedToEnd && meetsDuration;
  registration.status = completed ? 'COMPLETED' : 'PARTIAL_ATTENDANCE';
  registration.certificateEligible = completed;
  registration.checkedOutBy = actorId as any;
  registration.scannerRole = scannerRole;
  if (meta.ip) registration.checkInIp = registration.checkInIp || meta.ip;
  if (meta.userAgent) registration.checkInUserAgent = registration.checkInUserAgent || meta.userAgent;
  await registration.save();
  await recalcEventCounters(event._id.toString());
  if (completed) {
    await awardReputation({
      userId: registration.userId.toString(),
      category: 'ATTENDANCE',
      type: 'EVENT_COMPLETED',
      referenceId: event._id.toString(),
      communityId: event.communityId.toString(),
      scoreAwarded: 10,
      description: `Completed ${event.title}`,
    });
  }
  return registration;
}

export async function checkOutRegistration(
  eventId: string,
  registrationId: string,
  actorId: string,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const { event, membership } = await requireEventScanner(eventId, actorId);
  if (!['CHECK_IN', 'CHECK_OUT'].includes(event.status)) {
    throw new Error('Check-out has not started');
  }
  const registration = await EventRegistrationModel.findById(registrationId);
  if (!registration || registration.eventId.toString() !== eventId) {
    throw new Error('Student is not registered');
  }
  if (!registration.checkInAt) {
    throw new Error('Attendee has not checked in');
  }
  if (registration.checkOutAt) {
    throw new Error('Student already checked out');
  }

  return finishCheckOut(event, registration, actorId, membership.role, meta);
}

/** True when this registration attends over the internet (virtual event or hybrid-online choice). */
function isOnlineAttendee(eventMode: string, attendanceMode: string | null) {
  return eventMode === 'VIRTUAL' || (eventMode === 'HYBRID' && attendanceMode !== 'PHYSICAL');
}

/**
 * Online self check-in: virtual (or hybrid-online) attendees mark themselves
 * present while the event is live — this is also what unlocks the meeting link.
 */
export async function selfCheckIn(eventId: string, userId: string, meta: { ip?: string; userAgent?: string } = {}) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) throw new Error('Event not found');
  if (!['CHECK_IN', 'CHECK_OUT'].includes(event.status)) {
    throw new Error('Check-in has not started');
  }
  const registration = await EventRegistrationModel.findOne({ eventId, userId });
  if (!registration || ['CANCELLED', 'REJECTED', 'PENDING_APPROVAL', 'WAITLISTED'].includes(registration.status)) {
    throw new Error('You are not registered for this event');
  }
  if (!isOnlineAttendee(event.mode, registration.attendanceMode)) {
    throw new Error('In-person attendees check in with their QR pass at the venue');
  }
  // Time gate: even if the organizer opens check-in early, online attendees can
  // only check in from 15 minutes before the scheduled start.
  if (event.startDate && Date.now() < new Date(event.startDate).getTime() - 15 * 60 * 1000) {
    throw new Error('Online check-in opens 15 minutes before the event starts');
  }
  if (registration.checkInAt) return registration;

  registration.checkInAt = new Date();
  registration.status = 'CHECKED_IN';
  registration.attendanceVerified = true;
  registration.checkedInBy = userId as any;
  registration.scannerRole = 'SELF';
  if (meta.ip) registration.checkInIp = meta.ip;
  if (meta.userAgent) registration.checkInUserAgent = meta.userAgent;
  await registration.save();
  await recalcEventCounters(eventId);
  return registration;
}

/** Online self check-out: completes attendance using the same rules as the QR flow. */
export async function selfCheckOut(eventId: string, userId: string, meta: { ip?: string; userAgent?: string } = {}) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) throw new Error('Event not found');
  if (!['CHECK_IN', 'CHECK_OUT'].includes(event.status)) {
    throw new Error('Check-out has not started');
  }
  const registration = await EventRegistrationModel.findOne({ eventId, userId });
  if (!registration) throw new Error('You are not registered for this event');
  if (!isOnlineAttendee(event.mode, registration.attendanceMode)) {
    throw new Error('In-person attendees check out with their QR pass at the venue');
  }
  if (!registration.checkInAt) throw new Error('Check in first');
  if (registration.checkOutAt) return registration;

  return finishCheckOut(event, registration, userId, 'SELF', meta);
}

export async function attendanceCheckOut(
  actorId: string,
  input: { registrationId?: string; token?: string },
  meta: { ip?: string; userAgent?: string } = {},
) {
  let registration = null;
  if (input.registrationId) {
    registration = await EventRegistrationModel.findById(input.registrationId);
  } else if (input.token) {
    registration = await EventRegistrationModel.findOne({ qrToken: input.token });
  }
  if (!registration) {
    throw new Error('Invalid attendance pass');
  }
  const result = await checkOutRegistration(registration.eventId.toString(), registration._id.toString(), actorId, meta);
  const user = await authStore.getPublicUserById(result.userId.toString());
  const guildScoreAwarded = result.status === 'COMPLETED' ? 10 : 0;
  return {
    success: true,
    student: user?.fullName ?? '',
    status: result.status,
    attendanceDuration: result.attendanceMinutes,
    certificateEligible: result.certificateEligible,
    guildScoreAwarded,
    checkedOutAt: result.checkOutAt,
  };
}

async function generateCertificateSerial(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `GLD-${year}-`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const count = await CertificateModel.countDocuments({ serial: { $regex: `^${prefix}` } });
    const serial = `${prefix}${String(count + 1 + attempt).padStart(6, '0')}`;
    const exists = await CertificateModel.exists({ serial });
    if (!exists) return serial;
  }
  return `${prefix}${randomUUID().slice(0, 6).toUpperCase()}`;
}

function certificateVerificationUrl(serial: string) {
  return `${config.frontendUrl}/certificates/${serial}`;
}

export async function issueEventCertificates(eventId: string, actorId: string) {
  const event = await requireEventManager(eventId, actorId);
  if (!event.certificateEnabled) {
    throw new Error('Certificates are not enabled for this event');
  }
  const mode = event.certificateMode ?? 'STANDARD';
  if (mode === 'CUSTOM' && !event.certificateTemplate) {
    throw new Error('Upload a certificate template before issuing');
  }

  const community = await CommunityModel.findById(event.communityId).lean();
  if (!community) {
    throw new Error('Community not found');
  }
  if (community.verificationStatus !== 'VERIFIED') {
    throw new Error('Only verified communities can issue certificates');
  }

  const eligible = await EventRegistrationModel.find({ eventId, status: 'COMPLETED', certificateIssued: false });
  let issued = 0;

  for (const registration of eligible) {
    const user = await authStore.getPublicUserById(registration.userId.toString());
    if (!user) continue;

    const existing = await CertificateModel.findOne({ eventId, userId: registration.userId });
    if (!existing) {
      const created = await CertificateModel.create({
        serial: await generateCertificateSerial(),
        verificationToken: randomUUID(),
        eventId,
        communityId: event.communityId,
        userId: registration.userId,
        registrationId: registration._id,
        attendeeName: user.fullName,
        eventTitle: event.title,
        communityName: community.name,
        university: user.profile?.university ?? '',
        type: event.certificateType ?? 'ATTENDANCE',
        mode,
        templateImage: mode === 'CUSTOM' ? event.certificateTemplate : '',
        namePlacement: event.certificateNamePlacement,
        theme: event.certificateTheme ?? DEFAULT_CERTIFICATE_THEME,
        content: event.certificateContent ?? DEFAULT_CERTIFICATE_CONTENT,
        style: event.certificateStyle ?? 'CLASSIC',
        eventDate: event.startDate ?? null,
        attendanceMinutes: registration.attendanceMinutes ?? 0,
        issuedBy: actorId,
      });
      await buildDomainActivityRecord(registration.userId.toString(), 'CERTIFICATE', event.title, `Certificate for ${event.title}`);
      await createMilestonePost(registration.userId.toString(), {
        type: 'CERTIFICATE',
        label: `🎓 Earned a verified certificate for ${event.title} · @${community.name}`,
        refId: created._id.toString(),
        communityId: event.communityId.toString(),
        // Tag the community so the caption renders it as a clickable mention.
        tags: [{ type: 'COMMUNITY', refId: event.communityId.toString(), label: community.name, handle: community.slug }],
      });
      await createNotification({
        userId: registration.userId.toString(),
        type: 'CERTIFICATE_EARNED',
        title: `You earned a certificate for ${event.title}`,
        body: community.name,
        link: `/certificates/${created.serial}`,
      });
      // Instant congratulations email (fire-and-forget so the issue loop stays fast).
      if (user.email) {
        void sendEmail(
          user.email,
          certificateEarnedEmail(user.fullName, event.title, community.name, certificateVerificationUrl(created.serial)),
        ).catch(() => undefined);
      }
    }

    registration.certificateIssued = true;
    await registration.save();
    issued += 1;
  }

  const total = await CertificateModel.countDocuments({ eventId });
  await EventModel.updateOne({ _id: eventId }, { certificatesIssued: total });

  // AUTO appreciation: pair the thank-you blast with the certificate drop so
  // organizers don't have to remember it (CUSTOM = designed by hand, OFF = none).
  let appreciationSent = Boolean(event.appreciationSentAt);
  if (issued > 0 && event.appreciationMode === 'AUTO' && !event.appreciationSentAt) {
    await sendEventAppreciation(eventId, actorId, {})
      .then(() => {
        appreciationSent = true;
      })
      .catch((error) => {
        console.warn('[GuildOS] auto appreciation failed:', error instanceof Error ? error.message : error);
      });
  }

  return { issued, totalCertificates: total, appreciationSent };
}

export async function listUserCertificates(userId: string) {
  const certificates = await CertificateModel.find({ userId }).sort({ issuedAt: -1 }).lean();
  return certificates.map((certificate) => ({
    serial: certificate.serial,
    eventTitle: certificate.eventTitle,
    communityName: certificate.communityName,
    type: certificate.type ?? 'ATTENDANCE',
    status: certificate.status ?? 'VERIFIED',
    verificationUrl: certificateVerificationUrl(certificate.serial),
    issuedAt: certificate.issuedAt,
  }));
}

/** Light certificate lookup for link previews — never touches verification counters. */
export async function getCertificateMetaBySerial(serial: string) {
  const certificate = await CertificateModel.findOne({ serial })
    .select('serial attendeeName eventTitle communityName type status issuedAt')
    .lean();
  if (!certificate) {
    throw new Error('Certificate not found');
  }
  return {
    serial: certificate.serial,
    attendeeName: certificate.attendeeName,
    eventTitle: certificate.eventTitle,
    communityName: certificate.communityName,
    type: certificate.type ?? 'ATTENDANCE',
    status: certificate.status ?? 'VERIFIED',
    issuedAt: certificate.issuedAt,
  };
}

export async function getCertificateBySerial(serial: string) {
  const certificate = await CertificateModel.findOneAndUpdate(
    { serial },
    { $inc: { verificationCount: 1 }, $set: { lastVerifiedAt: new Date() } },
    { new: true },
  ).lean();
  if (!certificate) {
    throw new Error('Certificate not found');
  }
  const status = certificate.status ?? 'VERIFIED';
  // Sponsor perk delivery (LOGO_CERTIFICATES): sponsors flagged for certificate
  // placement appear on every certificate issued for the event.
  const [certificateSponsors, certEvent, acceptedPartnerships] = await Promise.all([
    EventSponsorModel.find({ eventId: certificate.eventId, showOnCertificate: true })
      .sort({ createdAt: 1 })
      .select('name logo')
      .lean(),
    EventModel.findById(certificate.eventId).select('partners').lean(),
    EventPartnershipModel.find({ eventId: certificate.eventId, status: 'ACCEPTED' }).select('communityId').lean(),
  ]);
  const coHostCommunities = acceptedPartnerships.length
    ? await CommunityModel.find({ _id: { $in: acceptedPartnerships.map((p) => p.communityId) } }).select('name logo').lean()
    : [];
  return {
    verified: status === 'VERIFIED',
    status,
    serial: certificate.serial,
    attendeeName: certificate.attendeeName,
    studentName: certificate.attendeeName,
    eventTitle: certificate.eventTitle,
    eventName: certificate.eventTitle,
    communityName: certificate.communityName,
    university: certificate.university ?? '',
    type: certificate.type ?? 'ATTENDANCE',
    mode: certificate.mode ?? 'STANDARD',
    templateImage: certificate.templateImage,
    namePlacement: certificate.namePlacement,
    theme: certificate.theme ?? DEFAULT_CERTIFICATE_THEME,
    content: certificate.content ?? DEFAULT_CERTIFICATE_CONTENT,
    style: certificate.style ?? 'CLASSIC',
    eventDate: certificate.eventDate,
    attendanceDuration: certificate.attendanceMinutes ?? 0,
    attendanceMinutes: certificate.attendanceMinutes ?? 0,
    verificationUrl: certificateVerificationUrl(certificate.serial),
    verificationCount: certificate.verificationCount ?? 0,
    revokeReason: certificate.revokeReason ?? '',
    issueDate: certificate.issuedAt,
    issuedAt: certificate.issuedAt,
    sponsors: certificateSponsors.map((s) => ({ name: s.name, logo: s.logo })),
    partners: (certEvent?.partners ?? []).map((p) => ({ name: p.name, logo: p.logo })),
    coHosts: coHostCommunities.map((c) => ({ name: c.name, logo: c.logo })),
  };
}

export async function revokeCertificate(serial: string, adminId: string, reason: string) {
  const certificate = await CertificateModel.findOne({ serial });
  if (!certificate) {
    throw new Error('Certificate not found');
  }
  certificate.status = 'REVOKED';
  certificate.revokedAt = new Date();
  certificate.revokedBy = new mongoose.Types.ObjectId(adminId);
  certificate.revokeReason = reason?.trim() ?? '';
  await certificate.save();
  return {
    serial: certificate.serial,
    status: certificate.status,
    revokedAt: certificate.revokedAt,
    revokeReason: certificate.revokeReason,
  };
}

export async function walkInCheckIn(eventId: string, userId: string) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }
  if (!event.allowWalkIns) {
    throw new Error('Walk-ins are not allowed for this event');
  }
  if (!['CHECK_IN', 'CHECK_OUT'].includes(event.status)) {
    throw new Error('Check-in is not currently open for this event');
  }

  let registration = await EventRegistrationModel.findOne({ eventId, userId });
  if (registration) {
    if (registration.checkInAt) {
      return registration;
    }
    if (registration.status === 'CANCELLED' || registration.status === 'REJECTED') {
      registration.registrationType = 'WALK_IN';
    }
    registration.status = 'CHECKED_IN';
    registration.checkInAt = new Date();
    await registration.save();
  } else {
    registration = await EventRegistrationModel.create({
      eventId,
      communityId: event.communityId,
      userId,
      registrationType: 'WALK_IN',
      status: 'CHECKED_IN',
      checkInAt: new Date(),
      qrToken: randomUUID(),
    });
  }

  await recalcEventCounters(eventId);
  return registration;
}

const ACTIVE_REGISTRATION_STATUSES = ['CONFIRMED', 'PENDING_APPROVAL', 'WAITLISTED', 'CHECKED_IN'];

export async function getUserRegistrations(userId: string) {
  const registrations = await EventRegistrationModel.find({ userId }).sort({ registeredAt: -1 }).lean();
  const withEvents = await Promise.all(
    registrations.map(async (registration) => {
      const event = await EventModel.findOne({ _id: registration.eventId, deletedAt: null }).lean();
      if (!event) return null;
      return {
        registration: {
          id: registration._id.toString(),
          status: registration.status,
          registrationType: registration.registrationType,
          qrToken: registration.qrToken,
          checkInAt: registration.checkInAt,
          checkOutAt: registration.checkOutAt,
          certificateEligible: registration.certificateEligible,
        },
        event: {
          id: event._id.toString(),
          title: event.title,
          slug: event.slug,
          startDate: event.startDate,
          venue: event.venue,
          mode: event.mode,
          status: event.status,
        },
      };
    }),
  );
  return withEvents.filter(Boolean);
}

export async function getUserUpcomingEvents(userId: string) {
  const now = new Date();
  const registrations = await EventRegistrationModel.find({ userId, status: { $in: ACTIVE_REGISTRATION_STATUSES } }).lean();
  const upcoming = await Promise.all(
    registrations.map(async (registration) => {
      const event = await EventModel.findOne({ _id: registration.eventId, deletedAt: null }).lean();
      if (!event) return null;
      const end = event.endDate ? new Date(event.endDate) : event.startDate ? new Date(event.startDate) : null;
      if (end && end < now) return null;
      return {
        id: event._id.toString(),
        title: event.title,
        slug: event.slug,
        startDate: event.startDate,
        venue: event.venue,
        mode: event.mode,
        status: event.status,
        registrationStatus: registration.status,
      };
    }),
  );
  return upcoming
    .filter(Boolean)
    .sort((a, b) => {
      const da = a!.startDate ? new Date(a!.startDate).getTime() : Infinity;
      const db = b!.startDate ? new Date(b!.startDate).getTime() : Infinity;
      return da - db;
    });
}

export async function getEventCheckins(eventId: string, actorId: string) {
  await requireEventScanner(eventId, actorId);
  const registrations = await EventRegistrationModel.find({ eventId, checkInAt: { $ne: null } }).sort({ checkInAt: -1 }).lean();
  const enriched = await Promise.all(
    registrations.map(async (registration) => {
      const user = await authStore.getPublicUserById(registration.userId.toString());
      return {
        id: registration._id.toString(),
        status: registration.status,
        registrationType: registration.registrationType,
        checkInAt: registration.checkInAt,
        checkOutAt: registration.checkOutAt,
        attendanceVerified: registration.attendanceVerified,
        scannerRole: registration.scannerRole,
        user: user ? { id: user.id, fullName: user.fullName } : null,
      };
    }),
  );
  return enriched;
}

export async function getLiveAttendance(eventId: string, actorId: string) {
  const { event } = await requireEventScanner(eventId, actorId);
  const [checkedIn, checkedOut, walkIns, pendingCheckOuts, completed, earlyDepartures, certificateEligible] = await Promise.all([
    EventRegistrationModel.countDocuments({ eventId, checkInAt: { $ne: null } }),
    EventRegistrationModel.countDocuments({ eventId, checkOutAt: { $ne: null } }),
    EventRegistrationModel.countDocuments({ eventId, registrationType: 'WALK_IN' }),
    EventRegistrationModel.countDocuments({ eventId, status: 'CHECKED_IN' }),
    EventRegistrationModel.countDocuments({ eventId, status: 'COMPLETED' }),
    EventRegistrationModel.countDocuments({ eventId, status: 'PARTIAL_ATTENDANCE' }),
    EventRegistrationModel.countDocuments({ eventId, certificateEligible: true }),
  ]);
  const attended = await EventRegistrationModel.find({ eventId, checkOutAt: { $ne: null } }).select('attendanceMinutes').lean();
  const averageDuration = attended.length
    ? Math.round(attended.reduce((sum, r) => sum + (r.attendanceMinutes ?? 0), 0) / attended.length)
    : 0;
  const registrations = event.registrationCount ?? 0;
  return {
    title: event.title,
    status: event.status,
    registrations,
    checkedIn,
    checkedOut,
    walkIns,
    pendingArrivals: Math.max(0, registrations - checkedIn),
    pendingCheckOuts,
    completed,
    earlyDepartures,
    certificateEligible,
    averageDuration,
    attendanceRate: registrations ? Math.round((checkedIn / registrations) * 100) : 0,
  };
}

export async function getEventCompletions(eventId: string, actorId: string) {
  await requireEventScanner(eventId, actorId);
  const completions = await EventRegistrationModel.find({ eventId, status: 'COMPLETED' }).sort({ checkOutAt: -1 }).lean();
  return Promise.all(
    completions.map(async (registration) => {
      const user = await authStore.getPublicUserById(registration.userId.toString());
      return {
        id: registration._id.toString(),
        attendanceMinutes: registration.attendanceMinutes,
        certificateEligible: registration.certificateEligible,
        user: user ? { id: user.id, fullName: user.fullName } : null,
      };
    }),
  );
}

export async function getCertificateEligible(eventId: string, actorId: string) {
  await requireEventScanner(eventId, actorId);
  const eligible = await EventRegistrationModel.find({ eventId, certificateEligible: true }).sort({ checkOutAt: -1 }).lean();
  return Promise.all(
    eligible.map(async (registration) => {
      const user = await authStore.getPublicUserById(registration.userId.toString());
      return {
        id: registration._id.toString(),
        attendanceMinutes: registration.attendanceMinutes,
        user: user ? { id: user.id, fullName: user.fullName } : null,
      };
    }),
  );
}

export async function getAttendanceReport(eventId: string, actorId: string) {
  await requireEventManager(eventId, actorId);
  const registrations = await EventRegistrationModel.find({ eventId }).sort({ registeredAt: 1 }).lean();
  return Promise.all(
    registrations.map(async (registration) => {
      const user = await authStore.getPublicUserById(registration.userId.toString());
      return {
        id: registration._id.toString(),
        fullName: user?.fullName ?? '',
        email: user?.email ?? '',
        registrationType: registration.registrationType,
        status: registration.status,
        checkInAt: registration.checkInAt,
        checkOutAt: registration.checkOutAt,
        attendanceMinutes: registration.attendanceMinutes,
        certificateEligible: registration.certificateEligible,
      };
    }),
  );
}

/**
 * Post-event feedback: attendees who checked in rate the event 1-5 once it's
 * over. One rating per attendee (re-submitting updates it).
 */
export async function submitEventFeedback(eventId: string, userId: string, input: { rating?: number; comment?: string }) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }
  const eventOver = ['CHECK_OUT', 'COMPLETED', 'ARCHIVED'].includes(event.status) || (event.endDate ? new Date(event.endDate).getTime() < Date.now() : false);
  if (!eventOver) {
    throw new Error('You can rate the event once it has ended');
  }
  const registration = await EventRegistrationModel.findOne({ eventId, userId }).select('checkInAt').lean();
  if (!registration?.checkInAt) {
    throw new Error('Only attendees who checked in can rate this event');
  }
  const rating = Math.round(Number(input.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }
  const comment = String(input.comment ?? '').trim().slice(0, 500);

  const feedback = await EventFeedbackModel.findOneAndUpdate(
    { eventId, userId },
    { $set: { rating, comment } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return { rating: feedback!.rating, comment: feedback!.comment };
}

/** Organizer view: rating distribution + individual comments. */
export async function getEventFeedback(eventId: string, actorId: string) {
  await requireEventManager(eventId, actorId);
  const entries = await EventFeedbackModel.find({ eventId }).sort({ updatedAt: -1 }).lean();
  const count = entries.length;
  const average = count ? Math.round((entries.reduce((sum, e) => sum + e.rating, 0) / count) * 10) / 10 : 0;
  const distribution = [1, 2, 3, 4, 5].map((star) => entries.filter((e) => e.rating === star).length);
  const comments = await Promise.all(
    entries
      .filter((e) => e.comment)
      .slice(0, 100)
      .map(async (e) => {
        const user = await authStore.getPublicUserById(e.userId.toString()).catch(() => null);
        return { rating: e.rating, comment: e.comment, name: user?.fullName ?? 'Attendee', at: e.updatedAt };
      }),
  );
  return { average, count, distribution, comments };
}

export async function finalizeEventAttendance(eventId: string, actorId?: string) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }
  if (actorId) {
    const memberships = await findEventMemberships(event, actorId);
    if (!membershipWith(memberships, 'COORDINATOR')) {
      throw new Error('Insufficient permissions');
    }
    if (event.status === 'ARCHIVED') {
      throw new Error('Event is archived');
    }
  }

  // Registered but never checked in → NO_SHOW.
  const noShow = await EventRegistrationModel.updateMany(
    { eventId, status: { $in: ['CONFIRMED', 'WAITLISTED'] }, checkInAt: null },
    { $set: { status: 'NO_SHOW' } },
  );
  // Checked in but never checked out → PARTIAL_ATTENDANCE (departure unverified, not eligible).
  const partial = await EventRegistrationModel.updateMany(
    { eventId, status: 'CHECKED_IN', checkOutAt: null },
    { $set: { status: 'PARTIAL_ATTENDANCE', certificateEligible: false } },
  );

  if (event.status !== 'ARCHIVED' && event.status !== 'COMPLETED') {
    event.status = 'COMPLETED';
  }
  event.attendanceFinalizedAt = new Date();
  await event.save();
  await recalcEventCounters(eventId);

  // Reward the organizer for running the event (idempotent per event).
  if (event.createdBy) {
    await awardReputation({
      userId: event.createdBy.toString(),
      category: 'ORGANIZER',
      type: 'EVENT_ORGANIZED',
      referenceId: eventId,
      communityId: event.communityId.toString(),
      scoreAwarded: 50,
      description: `Organized ${event.title}`,
    });
  }

  // Partnership award: the leader who accepted each co-host partnership earns points
  // for their community's collaboration (idempotent per partnership).
  const acceptedPartnerships = await EventPartnershipModel.find({ eventId, status: 'ACCEPTED' }).lean();
  for (const partnership of acceptedPartnerships) {
    try {
      const partnerCommunity = await CommunityModel.findById(partnership.communityId).select('name founder').lean();
      const recipient = partnership.respondedBy ?? partnerCommunity?.founder;
      if (!recipient) continue;
      await awardReputation({
        userId: recipient.toString(),
        category: 'ORGANIZER',
        type: 'PARTNERSHIP_HOSTED',
        referenceId: partnership._id.toString(),
        communityId: partnership.communityId.toString(),
        scoreAwarded: REPUTATION_POINTS.PARTNERSHIP_HOSTED,
        description: `Co-hosted ${event.title}${partnerCommunity ? ` with ${partnerCommunity.name}` : ''}`,
      });
    } catch (error) {
      console.warn('[GuildOS] partnership award failed:', error instanceof Error ? error.message : error);
    }
  }

  // Sponsorship award: the organizer earns points per sponsor secured (idempotent per sponsor).
  if (event.createdBy) {
    const sponsors = await EventSponsorModel.find({ eventId }).select('name').lean();
    for (const sponsor of sponsors) {
      try {
        await awardReputation({
          userId: event.createdBy.toString(),
          category: 'ORGANIZER',
          type: 'SPONSORSHIP_SECURED',
          referenceId: sponsor._id.toString(),
          communityId: event.communityId.toString(),
          scoreAwarded: REPUTATION_POINTS.SPONSORSHIP_SECURED,
          description: `Secured sponsorship from ${sponsor.name} for ${event.title}`,
        });
      } catch (error) {
        console.warn('[GuildOS] sponsorship award failed:', error instanceof Error ? error.message : error);
      }
    }
  }

  // Reward linked (on-site) speakers; off-site speakers have no userId and are skipped.
  const speakers = await EventSpeakerModel.find({ eventId, userId: { $ne: null } }).lean();
  for (const speaker of speakers) {
    await awardEventSpeaker(speaker as any, event as any);
  }

  // Reward tagged event volunteers.
  const volunteers = await EventVolunteerModel.find({ eventId }).lean();
  for (const volunteer of volunteers) {
    await awardEventVolunteer(volunteer as any, event as any);
  }

  return { noShows: noShow.modifiedCount ?? 0, partials: partial.modifiedCount ?? 0 };
}

export async function finalizeDueEvents(graceMs = config.eventFinalizeGraceMs) {
  const cutoff = new Date(Date.now() - graceMs);
  const events = await EventModel.find({
    deletedAt: null,
    attendanceFinalizedAt: null,
    status: { $in: ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'] },
    endDate: { $ne: null, $lte: cutoff },
  }).select('_id');

  let finalized = 0;
  for (const event of events) {
    try {
      await finalizeEventAttendance(event._id.toString());
      finalized += 1;
    } catch (error) {
      console.warn('[GuildOS] finalize failed for event', event._id.toString(), error instanceof Error ? error.message : error);
    }
  }
  return finalized;
}

export async function listEventWalkIns(eventId: string, actorId: string) {
  await requireEventScanner(eventId, actorId);
  const walkIns = await EventRegistrationModel.find({ eventId, registrationType: 'WALK_IN' }).sort({ registeredAt: -1 }).lean();
  const enriched = await Promise.all(
    walkIns.map(async (registration) => {
      const user = await authStore.getPublicUserById(registration.userId.toString());
      return {
        id: registration._id.toString(),
        status: registration.status,
        checkInAt: registration.checkInAt,
        user: user ? { id: user.id, fullName: user.fullName } : null,
      };
    }),
  );
  return enriched;
}

export async function searchWalkInUsers(eventId: string, actorId: string, query: string) {
  await requireEventScanner(eventId, actorId);
  return authStore.searchPublicUsers(query, 10);
}

export async function organizerRegisterWalkIn(
  eventId: string,
  actorId: string,
  userId: string,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const { event, membership } = await requireEventScanner(eventId, actorId);
  if (!['CHECK_IN', 'CHECK_OUT'].includes(event.status)) {
    throw new Error('Check-in has not started');
  }
  if (!event.allowWalkIns) {
    throw new Error('Walk-ins are not allowed for this event');
  }

  const student = await authStore.getPublicUserById(userId);
  if (!student) {
    throw new Error('Student not found');
  }

  let registration = await EventRegistrationModel.findOne({ eventId, userId });
  if (registration && registration.checkInAt) {
    throw new Error('Student already checked in');
  }

  if (!registration) {
    registration = new EventRegistrationModel({
      eventId,
      communityId: event.communityId,
      userId,
      registrationType: 'WALK_IN',
      qrToken: randomUUID(),
    });
  } else if (registration.status === 'CANCELLED' || registration.status === 'REJECTED') {
    registration.registrationType = 'WALK_IN';
  }

  registration.status = 'CHECKED_IN';
  registration.checkInAt = new Date();
  registration.attendanceVerified = true;
  registration.checkedInBy = actorId as any;
  registration.scannerRole = membership.role;
  if (meta.ip) registration.checkInIp = meta.ip;
  if (meta.userAgent) registration.checkInUserAgent = meta.userAgent;
  await registration.save();
  await recalcEventCounters(eventId);

  return { success: true, student: student.fullName, checkedInAt: registration.checkInAt };
}


