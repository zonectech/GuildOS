import { randomUUID } from 'node:crypto';
import {
  EventModel,
  DEFAULT_CERTIFICATE_THEME,
  DEFAULT_CERTIFICATE_CONTENT,
  type EventDocument,
  type EventStatus,
} from '../../models/event.model';
import { EventSpeakerModel } from '../../models/event-speaker.model';
import { refundEventTickets, refundDayScopedTickets } from './event-ticket.service';
import { notifySponsorshipEventCancelled, hideSponsorAnnouncementPosts } from '../sponsorship-notify.service';
import { refundEventSponsorships } from '../sponsorship-payment.service';
import { EventSponsorModel } from '../../models/event-sponsor.model';
import { EventBookmarkModel } from '../../models/event-bookmark.model';
import { EventPartnershipModel } from '../../models/event-partnership.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { EventFeedbackModel } from '../../models/event-feedback.model';
import { CommunityModel } from '../../models/community.model';
import { MembershipModel } from '../../models/membership.model';
import { hasCommunityPermission } from '../community.service';
import { ratableEventDays } from './event-analytics.service';
import { notifyVenueChanged, notifyEventDayCancelled, notifySpeakerDayCancelled, notifyDateChanged, notifyEventTeamCancelled, notifyWaitlistPromoted, notifyEventPostponed, notifyRegistrationOpened } from '../event-notification.service';
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
  isMultiDayEvent,
  COUNTED_STATUSES,
  PUBLIC_LIST_STATUSES,
  applyEventInput,
  recalcCommunityEventCount,
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
  if (community.verificationStatus !== 'VERIFIED' && community.verificationStatus !== 'UNVERIFIED') {
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
  // Unverified tier: free events only — money handling requires verification.
  if (community.verificationStatus !== 'VERIFIED') {
    const hasPaidTier = (event.ticketTiers ?? []).some((tier) => tier.price > 0);
    if (event.ticketPrice > 0 || hasPaidTier) {
      throw new Error('Unverified communities can only host free events — verify the community to sell tickets');
    }
  }
  const identity = await enforceUniqueEventTitle({ communityId, title: event.title, startDate: event.startDate });
  event.normalizedTitle = identity.normalizedTitle;
  event.eventStartDay = identity.eventStartDay;
  // Free tier: pick any ready-made design + ONE signature. Premium unlocks the rest
  // (colours, fonts, custom wording, and 2–3 signatures). Premium can come from a
  // community-wide monthly subscription OR a per-event unlock.
  // The issuer's OWN logo is free for everyone (a professional look shouldn't be
  // paywalled) — only wording/theme customization and extra signatures are premium.
  if (!community.isPremium && !event.premiumUnlocked) {
    event.certificateTheme = { ...DEFAULT_CERTIFICATE_THEME };
    const firstSig = (event.certificateContent?.signatories ?? []).slice(0, 1);
    const keepLogo = event.certificateContent?.logo ?? '';
    const keepLogoAlign = event.certificateContent?.logoAlign ?? 'CENTER';
    event.certificateContent = { ...DEFAULT_CERTIFICATE_CONTENT, signatories: firstSig, logo: keepLogo, logoAlign: keepLogoAlign };
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
    // Live/upcoming/finished events, PLUS organizer-cancelled ones (students
    // should see "cancelled" rather than have events vanish). Moderation
    // removals stay hidden.
    $or: [
      { status: { $in: PUBLIC_LIST_STATUSES } },
      { status: 'ARCHIVED', cancellationReason: { $nin: ['', 'Removed by GuildOS moderation'] } },
    ],
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
  const communityIds = [...new Set(events.map((e) => e.communityId?.toString()).filter(Boolean))] as string[];
  const [sponsors, speakers, hostCommunities] = await Promise.all([
    EventSponsorModel.find({ eventId: { $in: eventIds } }).sort({ createdAt: 1 }).lean(),
    EventSpeakerModel.find({ eventId: { $in: eventIds } }).sort({ createdAt: 1 }).lean(),
    CommunityModel.find({ _id: { $in: communityIds } }).select('name university').lean(),
  ]);
  const communityById = new Map(hostCommunities.map((c) => [c._id.toString(), c]));
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
    // Never serve meeting links in listings — they unlock via check-in on the detail page.
    meetingLink: '',
    sponsors: sponsorsByEvent.get(event._id.toString()) ?? [],
    speakers: speakersByEvent.get(event._id.toString()) ?? [],
    // Host community identity — powers the university filter + "my university first" sort.
    communityName: communityById.get(event.communityId?.toString() ?? '')?.name ?? '',
    communityUniversity: communityById.get(event.communityId?.toString() ?? '')?.university ?? '',
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

  // The meeting link is a perk of verified attendance — the API only serves it to
  // organizers and checked-in attendees. (The frontend "unlocks at check-in" rule
  // is enforced here, not just visually.)
  if (event.meetingLink) {
    const viewerCheckedIn = Boolean(
      viewerRegistration?.checkInAt || (viewerRegistration?.attendanceDays ?? []).some((d) => d.checkInAt),
    );
    if (!canManage && !viewerCheckedIn) {
      (event as { meetingLink: string }).meetingLink = '';
    }
  }

  // Attendee group-chat links are for people who actually hold a spot (paid ticket or
  // confirmed registration) — stripped from the public page, and each registrant only
  // sees THEIR section's group. Enforced here, not just visually.
  {
    const holdsSpot = Boolean(
      viewerRegistration && ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'].includes(viewerRegistration.status),
    );
    if (!canManage) {
      const sections = (event.sections ?? []) as { key: string; chatLink?: string }[];
      if (!holdsSpot) {
        (event as { attendeeChatLink?: string }).attendeeChatLink = '';
        for (const s of sections) s.chatLink = '';
      } else {
        const mySection = String(viewerRegistration?.sectionKey ?? '');
        for (const s of sections) if (s.key !== mySection) s.chatLink = '';
      }
    }
  }

  // Public rating summary + whether this viewer may rate (attended + event over).
  const feedbackAgg = await EventFeedbackModel.aggregate([
    { $match: { eventId: event._id } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  // Anticipation: how many people saved this event (public hype signal).
  const anticipatedCount = await EventBookmarkModel.countDocuments({ eventId: event._id });
  const feedback = feedbackAgg[0] ? { average: Math.round(feedbackAgg[0].average * 10) / 10, count: feedbackAgg[0].count } : { average: 0, count: 0 };
  const eventOver = ['CHECK_OUT', 'COMPLETED', 'ARCHIVED'].includes(event.status) || (event.endDate ? new Date(event.endDate).getTime() < Date.now() : false);
  const multiDay = isMultiDayEvent(event);
  const viewerCanRate = Boolean(viewerId && viewerRegistration?.checkInAt && eventOver && !multiDay);
  const viewerFeedback = viewerId
    ? await EventFeedbackModel.findOne({ eventId: event._id, userId: viewerId, day: 0 }).select('rating comment').lean()
    : null;
  // Multi-day: which ended days this viewer can rate now, plus ratings already given.
  const viewerRatableDays = viewerId && multiDay ? ratableEventDays(event, viewerRegistration) : [];
  const viewerDayFeedback = viewerId && multiDay
    ? await EventFeedbackModel.find({ eventId: event._id, userId: viewerId, day: { $gt: 0 } }).select('day rating comment').lean()
    : [];

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

  // Per-day seat availability — only computed when some day carries its own cap.
  // Buyers use it to see "Day 2: 3 seats left" and full days disabled in the picker.
  let dayAvailability: { day: number; capacity: number; taken: number }[] = [];
  const cappedDays = (event.days ?? [])
    .map((d, i) => ({ day: i + 1, capacity: d.capacity ?? 0, cancelled: Boolean(d.cancelled) }))
    .filter((d) => d.capacity > 0 && !d.cancelled);
  if (cappedDays.length) {
    dayAvailability = await Promise.all(
      cappedDays.map(async ({ day, capacity }) => ({
        day,
        capacity,
        taken: await EventRegistrationModel.countDocuments({
          eventId: event._id,
          status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE', 'PENDING_APPROVAL'] },
          $or: [{ plannedDays: day }, { plannedDays: { $size: 0 } }],
        }),
      })),
    );
  }

  // Per-section seat availability — the picker shows "Data Science: 3 seats left" and
  // disables full sections (capacity 0 = unlimited, taken still shown for organizers).
  let sectionAvailability: { key: string; capacity: number; taken: number }[] = [];
  if ((event.sections ?? []).length) {
    sectionAvailability = await Promise.all(
      (event.sections ?? []).map(async (s) => ({
        key: s.key,
        capacity: s.capacity ?? 0,
        taken: await EventRegistrationModel.countDocuments({
          eventId: event._id,
          sectionKey: s.key,
          status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE', 'PENDING_APPROVAL'] },
        }),
      })),
    );
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
    dayAvailability,
    sectionAvailability,
    feedback,
    anticipatedCount,
    viewerCanRate,
    viewerFeedback: viewerFeedback ? { rating: viewerFeedback.rating, comment: viewerFeedback.comment } : null,
    viewerRatableDays,
    viewerDayFeedback: viewerDayFeedback.map((f) => ({ day: f.day, rating: f.rating, comment: f.comment })),
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
      sessions: (d.sessions ?? []).map((s) => ({ time: s.time, title: s.title, venue: s.venue, facilitator: s.facilitator, sectionKey: s.sectionKey ?? '' })),
      capacity: d.capacity ?? 0,
      // A fresh run starts with every day back on.
      cancelled: false,
      cancellationNote: '',
    })),
    minimumAttendanceDays: source.minimumAttendanceDays,
    // Sections carry over verbatim — same tracks, fresh registrations. Group-chat links
    // reset: a new run means a new cohort, and the old group shouldn't leak to it.
    sections: (source.sections ?? []).map((s) => ({ key: s.key, name: s.name, description: s.description, capacity: s.capacity ?? 0, venue: s.venue, chatLink: '' })),
    contacts: (source.contacts ?? []).map((c) => ({ name: c.name, phone: c.phone, email: c.email })),
    bannerImage: source.bannerImage,
    mode: source.mode,
    venue: source.venue,
    address: source.address,
    meetingLink: source.meetingLink,
    attendeeChatLink: '',
    tags: [...(source.tags ?? [])],
    refreshments: source.refreshments,
    gallery: [...(source.gallery ?? [])],
    appreciationMode: source.appreciationMode,
    timezone: source.timezone,
    state: source.state ?? '',
    registrationPolicy: source.registrationPolicy,
    registrationQuestions: (source.registrationQuestions ?? []).map((q) => ({ key: q.key, label: q.label, type: q.type, options: [...(q.options ?? [])], required: q.required })),
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
    ticketTiers: (source.ticketTiers ?? []).map((t) => ({ name: t.name, price: t.price, capacity: t.capacity, days: [...(t.days ?? [])] })),
    ticketPromoCodes: (source.ticketPromoCodes ?? []).map((p) => ({ code: p.code, percentOff: p.percentOff, maxUses: p.maxUses, usedCount: 0 })),
    ticketGroupDiscount: { minQuantity: source.ticketGroupDiscount?.minQuantity ?? 0, percentOff: source.ticketGroupDiscount?.percentOff ?? 0 },
    ticketTemplate: source.ticketTemplate,
    ticketStyle: source.ticketStyle,
    ticketAccent: source.ticketAccent,
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
        sectionKey: s.sectionKey ?? '',
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
  const prevCapacity = event.capacity;
  const prevDayCount = (event.days ?? []).length;
  const prevSections = (event.sections ?? []).map((s) => ({ key: s.key, capacity: s.capacity ?? 0 }));
  applyEventInput(event, input);
  // Day numbers are load-bearing once the event is live: tickets ("Day 2 only"),
  // speakers, RSVPs, and cancellations all reference Day N by position. Removing
  // agenda days after publish would silently re-number everything.
  if (input.days !== undefined && !['DRAFT'].includes(event.status) && (event.days ?? []).length < prevDayCount) {
    throw new Error('Days cannot be removed after publishing — cancel a day instead so attendees and tickets stay consistent');
  }
  // Section keys are load-bearing too: registrations and trainers reference them.
  // Renames are fine (key survives); dropping a section would strand its attendees.
  if (input.sections !== undefined && !['DRAFT'].includes(event.status)) {
    const newKeys = new Set((event.sections ?? []).map((s) => s.key));
    const missing = prevSections.filter((s) => !newKeys.has(s.key));
    if (missing.length) {
      throw new Error('Sections cannot be removed after publishing — attendees are registered into them');
    }
  }
  validateEventContent(event);
  validateEventDates(event.startDate, event.endDate);
  // Unverified tier: block sneaking paid tickets in via an update.
  if (event.ticketPrice > 0 || (event.ticketTiers ?? []).some((tier) => tier.price > 0)) {
    const hostCommunity = await CommunityModel.findById(event.communityId).select('verificationStatus').lean();
    if (hostCommunity && hostCommunity.verificationStatus !== 'VERIFIED') {
      throw new Error('Unverified communities can only host free events — verify the community to sell tickets');
    }
  }
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
  // The issuer's OWN logo is free for everyone — see createEvent for rationale.
  {
    const community = await CommunityModel.findById(event.communityId).select('isPremium').lean();
    if (!community?.isPremium && !event.premiumUnlocked) {
      event.certificateTheme = { ...DEFAULT_CERTIFICATE_THEME };
      const firstSig = (event.certificateContent?.signatories ?? []).slice(0, 1);
      const keepLogo = event.certificateContent?.logo ?? '';
      const keepLogoAlign = event.certificateContent?.logoAlign ?? 'CENTER';
      event.certificateContent = { ...DEFAULT_CERTIFICATE_CONTENT, signatories: firstSig, logo: keepLogo, logoAlign: keepLogoAlign };
    }
  }
  const newStart = event.startDate ? new Date(event.startDate).getTime() : null;
  if (prevStart !== newStart) {
    event.reminderSentAt = null;
  }
  await event.save();
  const isLive = ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'].includes(event.status);
  if ((event.venue !== prevVenue || event.meetingLink !== prevLink) && isLive) {
    void notifyVenueChanged(event._id.toString(), { title: event.title, slug: event.slug, startDate: event.startDate, venue: event.venue, meetingLink: event.meetingLink });
  }
  // A date move is as disruptive as a venue move — same alert treatment.
  if (prevStart !== newStart && isLive) {
    void notifyDateChanged(event._id.toString(), { title: event.title, slug: event.slug, startDate: event.startDate, venue: event.venue, meetingLink: event.meetingLink });
  }
  // Organizer raised (or removed) the capacity cap — seats just opened, promote the
  // waitlist immediately instead of making people wait for someone to cancel.
  const capacityOpened = prevCapacity > 0 && (event.capacity === 0 || event.capacity > prevCapacity);
  // Same when a SECTION's cap was raised/removed — its waitlist can move.
  const sectionOpened = (event.sections ?? []).some((s) => {
    const prev = prevSections.find((p) => p.key === s.key);
    return prev && prev.capacity > 0 && ((s.capacity ?? 0) === 0 || (s.capacity ?? 0) > prev.capacity);
  });
  if ((capacityOpened || sectionOpened) && isLive && event.waitlistEnabled) {
    void promoteWaitlistedForEvent(event._id.toString()).catch(() => undefined);
  }
  return event;
}

/**
 * Confirms as many WAITLISTED registrations (oldest first) as the current capacity
 * allows — used when the organizer raises the cap mid-sale. Each promoted person
 * gets the same bell + email as a cancellation-driven promotion.
 */
async function promoteWaitlistedForEvent(eventId: string) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) return { promoted: 0 };
  const activeCount = await EventRegistrationModel.countDocuments({
    eventId,
    status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] },
  });
  const seats = event.capacity === 0 ? Number.MAX_SAFE_INTEGER : event.capacity - activeCount;
  if (seats <= 0) return { promoted: 0 };

  const waitlisted = await EventRegistrationModel.find({ eventId, status: 'WAITLISTED' })
    .sort({ registeredAt: 1 })
    .limit(Math.min(seats, 500));
  let promoted = 0;
  for (const registration of waitlisted) {
    if (promoted >= seats) break;
    // Someone waitlisted for a still-full section keeps waiting even when the
    // event-level cap opens — their seat is in the section, not the room.
    const section = (event.sections ?? []).find((s) => s.key === registration.sectionKey);
    if (section && (section.capacity ?? 0) > 0) {
      const taken = await EventRegistrationModel.countDocuments({
        eventId,
        _id: { $ne: registration._id },
        sectionKey: section.key,
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] },
      });
      if (taken >= section.capacity) continue;
    }
    registration.status = 'CONFIRMED';
    await registration.save();
    promoted += 1;
    notifyWaitlistPromoted(String(registration.userId), {
      title: event.title,
      slug: event.slug,
      startDate: event.startDate,
      venue: event.venue,
      meetingLink: event.meetingLink,
    });
  }
  return { promoted };
}

/** Shared publish/announce validation: content, dates, unique title, and mode-appropriate location. */
async function ensurePublishable(event: Awaited<ReturnType<typeof requireEditableEvent>>) {
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
}

/**
 * Announce mode: the event goes public so people can anticipate it, but
 * registration stays closed until the organizer opens it (publish).
 */
export async function announceEvent(id: string, actorId: string) {
  const event = await requireEditableEvent(id, actorId);
  if (event.status !== 'DRAFT') {
    return event;
  }
  await ensurePublishable(event);
  event.status = 'ANNOUNCED';
  await event.save();
  await recalcCommunityEventCount(event.communityId);
  return event;
}

export async function publishEvent(id: string, actorId: string) {
  const event = await requireEditableEvent(id, actorId);

  if (event.status !== 'DRAFT' && event.status !== 'ANNOUNCED') {
    return event;
  }
  const wasAnnounced = event.status === 'ANNOUNCED';
  await ensurePublishable(event);

  event.status = 'PUBLISHED';
  await event.save();

  await recalcCommunityEventCount(event.communityId);

  // The whole point of announcing: everyone who anticipated hears the moment
  // registration opens.
  if (wasAnnounced) {
    void notifyRegistrationOpened(String(event._id), { title: event.title, slug: event.slug, startDate: event.startDate, venue: event.venue, meetingLink: event.meetingLink }).catch(() => undefined);
  }

  return event;
}

export async function setEventStatus(id: string, actorId: string, status: EventStatus) {
  const event = await requireEditableEvent(id, actorId);
  event.status = status;
  await event.save();
  return event;
}

/**
 * Postpone a live event without cancelling it: registrations and tickets stay
 * valid and frozen (no refunds), sign-ups pause, and every registrant is told
 * a new date is coming. Resume with `resumeEvent` once new dates are set.
 */
export async function postponeEvent(id: string, actorId: string, note = '') {
  const event = await requireEditableEvent(id, actorId);
  if (!['PUBLISHED', 'CHECK_IN'].includes(event.status)) {
    throw new Error('Only live events can be postponed');
  }
  event.status = 'POSTPONED';
  event.postponedAt = new Date();
  event.postponementNote = String(note ?? '').trim().slice(0, 300);
  await event.save();

  void notifyEventPostponed(String(event._id), { title: event.title, slug: event.slug, startDate: event.startDate, venue: event.venue, meetingLink: event.meetingLink }, event.postponementNote).catch(() => undefined);
  return event;
}

/**
 * Republish a postponed event. Requires the (new) start date to be in the
 * future — edit the dates first. Registrants are notified of the new date.
 */
export async function resumeEvent(id: string, actorId: string) {
  const event = await requireEditableEvent(id, actorId);
  if (event.status !== 'POSTPONED') {
    throw new Error('Only postponed events can be republished');
  }
  if (!event.startDate || new Date(event.startDate).getTime() < Date.now()) {
    throw new Error('Set the new event date first (it must be in the future), then republish');
  }
  event.status = 'PUBLISHED';
  event.postponedAt = null;
  event.postponementNote = '';
  await event.save();

  void notifyDateChanged(String(event._id), { title: event.title, slug: event.slug, startDate: event.startDate, venue: event.venue, meetingLink: event.meetingLink });
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

/**
 * Public page-view counter (fire-and-forget from the event page, deduped per browser
 * session client-side). Powers the organizer's views → checkouts → sold funnel.
 */
export async function recordEventView(slug: string) {
  await EventModel.updateOne({ slug, deletedAt: null }, { $inc: { viewCount: 1 } });
}

/**
 * Invite-only events: get (or mint) the shareable invite link secret.
 * `regenerate` kills every previously shared link — for when one leaks.
 */
export async function getEventInviteLink(id: string, actorId: string, regenerate = false) {
  await requireEventManager(id, actorId);
  const event = await EventModel.findOne({ _id: id, deletedAt: null }).select('+inviteToken registrationPolicy slug');
  if (!event) throw new Error('Event not found');
  if (event.registrationPolicy !== 'INVITE') {
    throw new Error('This event is not invite-only — switch the registration policy first');
  }
  if (!event.inviteToken || regenerate) {
    event.inviteToken = `INV-${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    await event.save();
  }
  return { inviteToken: event.inviteToken, slug: event.slug };
}

/**
 * Cancel specific day(s) of a multi-day event. Attendees who planned those days
 * are notified with the reason; day-scoped tickets whose EVERY covered day is now
 * cancelled are refunded automatically. Whole-event tickets are never refunded
 * here — the rest of the programme still runs (cancel the whole event for that).
 */
export async function cancelEventDays(id: string, actorId: string, dayNumbers: number[], reason: string) {
  const event = await requireEditableEvent(id, actorId);
  if (!['PUBLISHED', 'CHECK_IN'].includes(event.status)) {
    throw new Error('Days can only be cancelled while the event is live');
  }
  const agendaDays = event.days ?? [];
  if (agendaDays.length < 2) {
    throw new Error('Only multi-day events with a day agenda support per-day cancellation');
  }
  const trimmedReason = String(reason ?? '').trim().slice(0, 300);
  if (trimmedReason.length < 5) {
    throw new Error('A short reason is required so attendees know why');
  }
  const targets = [...new Set(dayNumbers.map((d) => Math.round(Number(d))))].filter((d) => d >= 1 && d <= agendaDays.length);
  if (!targets.length) {
    throw new Error('Pick at least one day to cancel');
  }
  const fresh = targets.filter((d) => !agendaDays[d - 1].cancelled);
  if (!fresh.length) {
    throw new Error('Those days are already cancelled');
  }
  const remaining = agendaDays.filter((d, i) => !d.cancelled && !fresh.includes(i + 1)).length;
  if (remaining === 0) {
    throw new Error('That would cancel every day — cancel the whole event instead so everyone is refunded');
  }

  for (const dayNo of fresh) {
    agendaDays[dayNo - 1].cancelled = true;
    agendaDays[dayNo - 1].cancellationNote = trimmedReason;
  }
  event.markModified('days');
  await event.save();

  // Tell everyone who planned (or defaulted to) those days. plannedDays [] = attending all days.
  const registrants = await EventRegistrationModel.find({
    eventId: event._id,
    status: { $nin: ['CANCELLED', 'REJECTED', 'NO_SHOW'] },
  }).select('userId plannedDays').lean();
  let notified = 0;
  const notifiedIds = new Set<string>();
  for (const reg of registrants) {
    const planned: number[] = (reg.plannedDays ?? []) as number[];
    if (planned.length === 0 || planned.some((d) => fresh.includes(d))) {
      notifyEventDayCancelled(String(reg.userId), { title: event.title, slug: event.slug }, fresh, trimmedReason);
      notifiedIds.add(String(reg.userId));
      notified += 1;
    }
  }

  // Linked speakers billed on the cancelled day(s) hear it too (deduped — a
  // registered speaker already got the attendee notice above).
  const daySpeakers = await EventSpeakerModel.find({
    eventId: event._id,
    userId: { $ne: null },
    day: { $in: fresh },
  }).select('userId').lean();
  for (const speaker of daySpeakers) {
    const speakerId = String(speaker.userId);
    if (notifiedIds.has(speakerId)) continue;
    notifySpeakerDayCancelled(speakerId, { title: event.title, slug: event.slug }, fresh, trimmedReason);
    notifiedIds.add(speakerId);
    notified += 1;
  }

  // Money: dead day-scoped tickets get fully refunded; partly-hit tickets get a
  // proportional slice back and stay valid for their remaining days.
  const { refunded, queued, partial } = await refundDayScopedTickets(event._id.toString(), `Day cancelled: ${trimmedReason}`);

  return { event, cancelledDays: fresh, notified, refunded, queued, partial };
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
    await recalcCommunityEventCount(event.communityId);
  }
  if (shouldRefund) {
    void refundEventTickets(String(event._id), event.cancellationReason).catch((error) =>
      console.error('[GuildOS] refund sweep failed:', error instanceof Error ? error.message : error),
    );
    // Platform-paid sponsorships are refunded automatically; off-platform deals and
    // open inquiries still get the cancellation notice below.
    void refundEventSponsorships(String(event._id), event.cancellationReason).catch((error) =>
      console.error('[GuildOS] sponsorship refund sweep failed:', error instanceof Error ? error.message : error),
    );
    void notifySponsorshipEventCancelled(String(event._id), event.cancellationReason).catch(() => undefined);
    void hideSponsorAnnouncementPosts(String(event._id)).catch(() => undefined);
    // The team too: speakers, volunteers, co-host community leadership; pending co-host invites voided.
    void notifyEventTeamCancelled(String(event._id), { title: event.title, slug: event.slug }, event.cancellationReason).catch(() => undefined);
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
    await recalcCommunityEventCount(event.communityId);
  }
  if (shouldRefund) {
    void refundEventTickets(String(event._id), 'event taken down').catch((error) =>
      console.error('[GuildOS] refund sweep failed:', error instanceof Error ? error.message : error),
    );
    void refundEventSponsorships(String(event._id), 'Removed by GuildOS moderation').catch((error) =>
      console.error('[GuildOS] sponsorship refund sweep failed:', error instanceof Error ? error.message : error),
    );
    void notifySponsorshipEventCancelled(String(event._id), 'Removed by GuildOS moderation').catch(() => undefined);
    void hideSponsorAnnouncementPosts(String(event._id)).catch(() => undefined);
    void notifyEventTeamCancelled(String(event._id), { title: event.title, slug: event.slug }, 'Removed by GuildOS moderation').catch(() => undefined);
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
    await recalcCommunityEventCount(event.communityId);
  }
  if (shouldRefund) {
    void refundEventTickets(String(event._id), 'event cancelled by the organizers').catch((error) =>
      console.error('[GuildOS] refund sweep failed:', error instanceof Error ? error.message : error),
    );
    void refundEventSponsorships(String(event._id), 'Event cancelled by the organizers').catch((error) =>
      console.error('[GuildOS] sponsorship refund sweep failed:', error instanceof Error ? error.message : error),
    );
    void notifySponsorshipEventCancelled(String(event._id), 'Event cancelled by the organizers').catch(() => undefined);
    void hideSponsorAnnouncementPosts(String(event._id)).catch(() => undefined);
    void notifyEventTeamCancelled(String(event._id), { title: event.title, slug: event.slug }, 'Event cancelled by the organizers').catch(() => undefined);
  }

  return { message: 'Event deleted' };
}

export async function listCommunityEventsForManager(communityId: string, actorId: string) {
  await getManagerMembership(communityId, actorId);
  return EventModel.find({ communityId, deletedAt: null }).sort({ createdAt: -1 }).lean();
}
