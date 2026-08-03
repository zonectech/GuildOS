import { randomUUID } from 'node:crypto';
import {
  EventModel,
  DEFAULT_CERTIFICATE_THEME,
  DEFAULT_CERTIFICATE_CONTENT,
  type EventDocument,
  type EventStatus,
} from '../../models/event.model';
import { EventSpeakerModel } from '../../models/event-speaker.model';
import { refundEventTickets } from './event-ticket.service';
import { EventSponsorModel } from '../../models/event-sponsor.model';
import { EventPartnershipModel } from '../../models/event-partnership.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { EventFeedbackModel } from '../../models/event-feedback.model';
import { CommunityModel } from '../../models/community.model';
import { MembershipModel } from '../../models/membership.model';
import { hasCommunityPermission } from '../community.service';
import { notifyVenueChanged } from '../event-notification.service';
import {
  enforceUniqueEventTitle,
  releaseEventCreation,
  reserveEventCreation,
  validateEventContent,
  validateEventDates,
} from '../event-abuse.service';
import {
  slugify,
  ensureNonEmpty,
  getManagerMembership,
  findEventMemberships,
  membershipWith,
  requireEventManager,
  COUNTED_STATUSES,
  PUBLIC_LIST_STATUSES,
  applyEventInput,
  type EventInput,
} from './event-shared';

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
  validateEventContent(event);
  validateEventDates(event.startDate, event.endDate);
  const identity = await enforceUniqueEventTitle({ communityId, title: event.title, startDate: event.startDate });
  event.normalizedTitle = identity.normalizedTitle;
  event.eventStartDay = identity.eventStartDay;
  // Free tier: pick any ready-made design + ONE signature. Premium unlocks the rest
  // (colours, fonts, custom wording, and 2–3 signatures). Premium can come from a
  // community-wide monthly subscription OR a per-event unlock.
  if (!community.isPremium && !event.premiumUnlocked) {
    event.certificateTheme = { ...DEFAULT_CERTIFICATE_THEME };
    const firstSig = (event.certificateContent?.signatories ?? []).slice(0, 1);
    event.certificateContent = { ...DEFAULT_CERTIFICATE_CONTENT, signatories: firstSig };
  }
  const reservation = await reserveEventCreation(communityId, creatorId);
  try {
    await event.save();
  } catch (error) {
    await releaseEventCreation(reservation);
    throw error;
  }

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

  validateEventContent(source);
  const identity = await enforceUniqueEventTitle({
    communityId: source.communityId.toString(),
    title: source.title,
    startDate: null,
  });
  const reservation = await reserveEventCreation(source.communityId.toString(), actorId);

  const copy = new EventModel({
    communityId: source.communityId,
    slug: `${slugify(source.title)}-${randomUUID().slice(0, 8)}`,
    createdBy: actorId,
    status: 'DRAFT',
    title: source.title,
    normalizedTitle: identity.normalizedTitle,
    eventStartDay: identity.eventStartDay,
    type: source.type,
    shortDescription: source.shortDescription,
    description: source.description,
    theme: source.theme,
    features: [...(source.features ?? [])],
    // Day agenda carries over as content; per-day dates reset with the event dates.
    days: (source.days ?? []).map((d) => ({
      date: null,
      theme: d.theme,
      venue: d.venue,
      startTime: d.startTime ?? '',
      endTime: d.endTime ?? '',
      features: [...(d.features ?? [])],
      facilitators: (d.facilitators ?? []).map((p) => ({ name: p.name, title: p.title })),
      sessions: (d.sessions ?? []).map((s) => ({ time: s.time, title: s.title, venue: s.venue, facilitator: s.facilitator })),
    })),
    minimumAttendanceDays: source.minimumAttendanceDays,
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
    // Ticketing setup carries over; promo usage counters reset for the new run.
    ticketPrice: source.ticketPrice,
    ticketTiers: (source.ticketTiers ?? []).map((t) => ({ name: t.name, price: t.price, capacity: t.capacity })),
    ticketPromoCodes: (source.ticketPromoCodes ?? []).map((p) => ({ code: p.code, percentOff: p.percentOff, maxUses: p.maxUses, usedCount: 0 })),
    ticketGroupDiscount: { minQuantity: source.ticketGroupDiscount?.minQuantity ?? 0, percentOff: source.ticketGroupDiscount?.percentOff ?? 0 },
    ticketTemplate: source.ticketTemplate,
    ticketQrPlacement: source.ticketQrPlacement,
    // Deliberately reset: startDate/endDate, premiumUnlocked (paid per event),
    // counters, reminder/finalize/appreciation stamps.
  });
  try {
    await copy.save();
  } catch (error) {
    await releaseEventCreation(reservation);
    throw error;
  }

  // Same speaker lineup is the common case for recurring events.
  const speakers = await EventSpeakerModel.find({ eventId: source._id }).lean();
  if (speakers.length) {
    await EventSpeakerModel.insertMany(
      speakers.map((s) => ({
        eventId: copy._id,
        userId: s.userId,
        speakerType: s.speakerType,
        day: s.day ?? null,
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
  validateEventContent(event);
  validateEventDates(event.startDate, event.endDate);
  const identity = await enforceUniqueEventTitle({
    communityId: event.communityId.toString(),
    title: event.title,
    startDate: event.startDate,
    excludeId: event._id.toString(),
  });
  event.normalizedTitle = identity.normalizedTitle;
  event.eventStartDay = identity.eventStartDay;
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
  validateEventContent(event);
  validateEventDates(event.startDate, event.endDate, new Date(), true);
  const identity = await enforceUniqueEventTitle({
    communityId: event.communityId.toString(),
    title: event.title,
    startDate: event.startDate,
    excludeId: event._id.toString(),
  });
  event.normalizedTitle = identity.normalizedTitle;
  event.eventStartDay = identity.eventStartDay;
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

/** Organizer's manual registration switch — stop (or resume) sign-ups without touching the deadline or status. */
export async function setEventRegistrationClosed(id: string, actorId: string, closed: boolean) {
  const event = await requireEditableEvent(id, actorId);
  if (!['PUBLISHED', 'CHECK_IN'].includes(event.status)) {
    throw new Error('Registration can only be toggled while the event is live');
  }
  event.registrationClosed = closed;
  await event.save();
  return event;
}

export async function archiveEvent(id: string, actorId: string, reason?: string) {
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
  // Cancelling before the event finished = ticket buyers get their money back.
  const shouldRefund = ['PUBLISHED', 'CHECK_IN'].includes(event.status);
  event.status = 'ARCHIVED';
  if (shouldRefund) {
    event.cancellationReason = String(reason ?? '').trim().slice(0, 300) || 'Cancelled by the organizers';
  }
  await event.save();

  if (wasCounted) {
    await CommunityModel.updateOne({ _id: event.communityId }, { $inc: { eventCount: -1 } });
  }
  if (shouldRefund) {
    void refundEventTickets(String(event._id), event.cancellationReason).catch((error) =>
      console.error('[GuildOS] refund sweep failed:', error instanceof Error ? error.message : error),
    );
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
  const shouldRefund = ['PUBLISHED', 'CHECK_IN'].includes(event.status);
  event.status = 'ARCHIVED';
  if (shouldRefund) {
    event.cancellationReason = 'Removed by GuildOS moderation';
  }
  await event.save();
  if (wasCounted) {
    await CommunityModel.updateOne({ _id: event.communityId }, { $inc: { eventCount: -1 } });
  }
  if (shouldRefund) {
    void refundEventTickets(String(event._id), 'event taken down').catch((error) =>
      console.error('[GuildOS] refund sweep failed:', error instanceof Error ? error.message : error),
    );
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
  const shouldRefund = ['PUBLISHED', 'CHECK_IN'].includes(event.status);
  event.deletedAt = new Date();
  await event.save();

  if (wasCounted) {
    await CommunityModel.updateOne({ _id: event.communityId }, { $inc: { eventCount: -1 } });
  }
  if (shouldRefund) {
    void refundEventTickets(String(event._id), 'event cancelled by the organizers').catch((error) =>
      console.error('[GuildOS] refund sweep failed:', error instanceof Error ? error.message : error),
    );
  }

  return { message: 'Event deleted' };
}

export async function listCommunityEventsForManager(communityId: string, actorId: string) {
  await getManagerMembership(communityId, actorId);
  return EventModel.find({ communityId, deletedAt: null }).sort({ createdAt: -1 }).lean();
}
