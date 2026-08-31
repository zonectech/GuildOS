import { randomUUID } from 'node:crypto';
import { config } from '../../config';
import { EventModel } from '../../models/event.model';
import { EventRegistrationModel, type EventRegistrationStatus } from '../../models/event-registration.model';
import { CommunityModel } from '../../models/community.model';
import { TicketClaimModel } from '../../models/ticket-claim.model';
import { EventBookmarkModel } from '../../models/event-bookmark.model';
import { authStore } from '../../store/auth-store';
import { createNotification } from '../notification.service';
import { sendEmail, categoryEmail, type EmailCategory } from '../../utils/email';
import {
  notifyRegistrationApproved,
  notifyRegistrationConfirmed,
  notifyRegistrationRejected,
  notifyWaitlistPromoted,
} from '../event-notification.service';
import { requireEventManager, recalcEventCounters, eventTotalDays, isMultiDayEvent, resolveRegistrationAnswers } from './event-shared';

/** Checks a presented invite secret against the event's stored one (select:false field — targeted query). */
export async function inviteTokenValid(eventId: string, presented?: string) {
  const token = String(presented ?? '').trim();
  if (!token) return false;
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null }).select('+inviteToken').lean();
  return Boolean(event?.inviteToken) && token === event!.inviteToken;
}

export async function registerForEvent(
  eventId: string,
  userId: string,
  options: { attendanceMode?: string | null; plannedDays?: number[]; inviteToken?: string; sectionKey?: string; answers?: Record<string, unknown> } = {},
) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }
  if (!['PUBLISHED', 'CHECK_IN'].includes(event.status)) {
    throw new Error('Registration is not open for this event');
  }
  if (event.registrationPolicy === 'INVITE' && !(await inviteTokenValid(eventId, options.inviteToken))) {
    throw new Error('This event is invite only — ask the organizers for an invite link');
  }
  // Ticketed events register exclusively through the ticket checkout — the free
  // path would otherwise hand out tickets without payment, and tiered events
  // (even all-free tiers) need the per-tier capacity accounting.
  if ((event.ticketPrice ?? 0) > 0 || (event.ticketTiers ?? []).length > 0) {
    throw new Error('This event uses tickets — get a ticket to register');
  }
  if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
    throw new Error('The registration deadline has passed');
  }
  if (event.registrationClosed) {
    throw new Error('The organizers have closed registration for this event');
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

  // Multi-day RSVP: which days they plan to attend ([] / all days selected = every day).
  // Informational for organizer planning — except where a day has its own seat cap.
  const totalDays = eventTotalDays(event);
  let plannedDays: number[] = [];
  if (isMultiDayEvent(event) && Array.isArray(options.plannedDays)) {
    plannedDays = [...new Set(options.plannedDays.map((d) => Math.round(Number(d))))].filter((d) => d >= 1 && d <= totalDays).sort((a, b) => a - b);
    if (plannedDays.length === totalDays) plannedDays = [];
  }

  // Per-day capacity: days with their own seat cap (venues often differ per day) are a
  // hard stop at RSVP time. An empty plannedDays means "every day", so it must clear
  // every capped day. Walk-ins at the door remain the organizer's call.
  const cappedDays = (event.days ?? [])
    .map((d, i) => ({ day: i + 1, capacity: d.capacity ?? 0, cancelled: Boolean(d.cancelled) }))
    .filter((d) => d.capacity > 0 && !d.cancelled);
  if (isMultiDayEvent(event) && cappedDays.length) {
    const wanted = plannedDays.length ? plannedDays : Array.from({ length: totalDays }, (_, i) => i + 1);
    const fullDays: number[] = [];
    for (const capped of cappedDays) {
      if (!wanted.includes(capped.day)) continue;
      const taken = await EventRegistrationModel.countDocuments({
        eventId,
        userId: { $ne: userId },
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE', 'PENDING_APPROVAL'] },
        // Empty plannedDays = attending every day, so it occupies a seat on each capped day.
        $or: [{ plannedDays: capped.day }, { plannedDays: { $size: 0 } }],
      });
      if (taken >= capped.capacity) fullDays.push(capped.day);
    }
    if (fullDays.length) {
      throw new Error(
        fullDays.length === 1
          ? `Day ${fullDays[0]} is full — unselect it or pick different days`
          : `Days ${fullDays.join(', ')} are full — unselect them or pick different days`,
      );
    }
  }

  // Sections/tracks: events with parallel sections (e.g. Data Science vs Coding) require
  // picking exactly one — trainers, venues and seat caps are per section.
  const sections = event.sections ?? [];
  let sectionKey = '';
  let sectionWaitlisted = false;
  if (sections.length) {
    sectionKey = String(options.sectionKey ?? '').trim();
    const section = sections.find((s) => s.key === sectionKey);
    if (!section) {
      throw new Error('Pick a section to register for this event');
    }
    if (section.capacity > 0) {
      const taken = await EventRegistrationModel.countDocuments({
        eventId,
        userId: { $ne: userId },
        sectionKey,
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE', 'PENDING_APPROVAL'] },
      });
      if (taken >= section.capacity) {
        if (!event.waitlistEnabled) {
          throw new Error(`The ${section.name} section is full — pick another section`);
        }
        sectionWaitlisted = true;
      }
    }
  }

  const existing = await EventRegistrationModel.findOne({ eventId, userId });
  if (existing && existing.status !== 'CANCELLED') {
    return existing;
  }

  // Custom registration questions — validated before any registration is created so a
  // missing required answer never leaves a half-made registration behind.
  const answers = await resolveRegistrationAnswers(event, userId, options.answers);

  // Approval-required events queue the request for leadership review.
  if (event.registrationPolicy === 'APPROVAL') {
    const registration = existing
      ? Object.assign(existing, { status: 'PENDING_APPROVAL' as EventRegistrationStatus, registrationType: 'APPROVAL', attendanceMode, plannedDays, sectionKey, answers, communityId: event.communityId, registeredAt: new Date(), qrToken: existing.qrToken || randomUUID() })
      : new EventRegistrationModel({ eventId, communityId: event.communityId, userId, registrationType: 'APPROVAL', attendanceMode, plannedDays, sectionKey, answers, status: 'PENDING_APPROVAL', qrToken: randomUUID() });
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
  if (sectionWaitlisted) status = 'WAITLISTED';

  const registration = existing
    ? Object.assign(existing, { status, registrationType: 'OPEN', attendanceMode, plannedDays, sectionKey, answers, communityId: event.communityId, registeredAt: new Date(), qrToken: existing.qrToken || randomUUID() })
    : new EventRegistrationModel({ eventId, communityId: event.communityId, userId, registrationType: 'OPEN', attendanceMode, plannedDays, sectionKey, answers, status, qrToken: randomUUID() });
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
  // The approved attendee still needs a seat in their section.
  let sectionFull = false;
  const approvedSection = (event.sections ?? []).find((s) => s.key === registration.sectionKey);
  if (approvedSection && approvedSection.capacity > 0) {
    const taken = await EventRegistrationModel.countDocuments({
      eventId,
      _id: { $ne: registration._id },
      sectionKey: approvedSection.key,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] },
    });
    sectionFull = taken >= approvedSection.capacity;
  }
  registration.status = isFull || sectionFull ? 'WAITLISTED' : 'CONFIRMED';
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

export async function cancelRegistration(eventId: string, userId: string, reason?: string) {
  const registration = await EventRegistrationModel.findOne({ eventId, userId });
  if (!registration || registration.status === 'CANCELLED' || registration.status === 'REJECTED') {
    throw new Error('Registration not found');
  }

  registration.status = 'CANCELLED';
  // Why they left — shown to organizers on the attendees page so they learn from drop-offs.
  registration.cancellationReason = String(reason ?? '').trim().slice(0, 200);
  registration.cancelledBy = 'SELF';
  await registration.save();

  // Paid tickets are NOT refunded on cancellation — but a guest ticket from a group
  // purchase goes back to the buyer as a fresh claim link, so the seat isn't wasted.
  const claim = await TicketClaimModel.findOne({ registrationId: registration._id });
  if (claim) {
    claim.claimedBy = null;
    claim.registrationId = null;
    claim.claimedAt = null;
    await claim.save();
    const event = await EventModel.findById(eventId).select('title slug').lean();
    if (event) {
      void createNotification({
        userId: String(claim.createdBy),
        type: 'SYSTEM',
        title: `A guest ticket for ${event.title} is available again`,
        body: 'Your guest cancelled — the invite link can now be sent to someone else.',
        link: `/events/${event.slug}`,
      });
    }
  }

  const event = await EventModel.findById(eventId);
  if (event?.waitlistEnabled) {
    const nextWaitlisted = await findPromotableWaitlisted(event);
    if (nextWaitlisted) {
      nextWaitlisted.status = 'CONFIRMED';
      await nextWaitlisted.save();
      notifyWaitlistPromoted(String(nextWaitlisted.userId), {
        title: event.title,
        slug: event.slug,
        startDate: event.startDate,
        venue: event.venue,
        meetingLink: event.meetingLink,
      });
    }
  }

  await recalcEventCounters(eventId);
  return { message: 'Registration cancelled' };
}

/** Oldest waitlisted registration that can actually take a seat (its section must have room). */
async function findPromotableWaitlisted(event: { _id: unknown; sections?: { key: string; capacity: number }[] }) {
  const sections = event.sections ?? [];
  const waitlisted = await EventRegistrationModel.find({ eventId: event._id, status: 'WAITLISTED' }).sort({ registeredAt: 1 });
  for (const candidate of waitlisted) {
    const section = sections.find((s) => s.key === candidate.sectionKey);
    if (!section || !(section.capacity > 0)) return candidate;
    const taken = await EventRegistrationModel.countDocuments({
      eventId: event._id,
      _id: { $ne: candidate._id },
      sectionKey: section.key,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] },
    });
    if (taken < section.capacity) return candidate;
  }
  return null;
}

/**
 * Self-service section/track switch — allowed until check-in opens, when the target
 * section has room. Frees the old seat for anyone waitlisted on that section.
 */
export async function switchRegistrationSection(eventId: string, userId: string, sectionKey: string) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) throw new Error('Event not found');
  const sections = event.sections ?? [];
  if (!sections.length) throw new Error('This event has no sections');
  if (event.status !== 'PUBLISHED') throw new Error('Sections are locked once check-in opens — ask the organizers to move you');
  const registration = await EventRegistrationModel.findOne({ eventId, userId });
  if (!registration || ['CANCELLED', 'REJECTED', 'NO_SHOW'].includes(registration.status)) {
    throw new Error('Registration not found');
  }
  if (registration.checkInAt || (registration.attendanceDays ?? []).length > 0) {
    throw new Error('You have already checked in — ask the organizers to move you');
  }
  const target = sections.find((s) => s.key === String(sectionKey ?? '').trim());
  if (!target) throw new Error('Section not found');
  if (target.key === registration.sectionKey) return registration;
  if (target.capacity > 0) {
    const taken = await EventRegistrationModel.countDocuments({
      eventId,
      _id: { $ne: registration._id },
      sectionKey: target.key,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE', 'PENDING_APPROVAL'] },
    });
    if (taken >= target.capacity) throw new Error(`The ${target.name} section is full`);
  }
  registration.sectionKey = target.key;
  await registration.save();
  // The freed seat may unblock someone waitlisted for the old section.
  if (event.waitlistEnabled) {
    const nextWaitlisted = await findPromotableWaitlisted(event);
    if (nextWaitlisted) {
      nextWaitlisted.status = 'CONFIRMED';
      await nextWaitlisted.save();
      notifyWaitlistPromoted(String(nextWaitlisted.userId), {
        title: event.title,
        slug: event.slug,
        startDate: event.startDate,
        venue: event.venue,
        meetingLink: event.meetingLink,
      });
    }
  }
  return registration;
}

export async function getMyRegistration(eventId: string, userId: string) {
  return EventRegistrationModel.findOne({ eventId, userId }).lean();
}

/** Save/unsave an event without registering ("interested"). Returns the new state. */
export async function toggleEventBookmark(eventId: string, userId: string) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null }).select('_id').lean();
  if (!event) throw new Error('Event not found');
  const existing = await EventBookmarkModel.findOne({ userId, eventId });
  if (existing) {
    await EventBookmarkModel.deleteOne({ _id: existing._id });
    return { bookmarked: false as const };
  }
  await EventBookmarkModel.create({ userId, eventId });
  return { bookmarked: true as const };
}

/** The viewer's saved events (upcoming first) for the my-events page. */
export async function listMyBookmarkedEvents(userId: string) {
  const bookmarks = await EventBookmarkModel.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
  const events = await EventModel.find({
    _id: { $in: bookmarks.map((b) => b.eventId) },
    deletedAt: null,
    status: { $in: ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'] },
  })
    .select('title slug bannerImage startDate endDate venue mode status ticketPrice registrationCount capacity')
    .lean();
  return events.sort((a, b) => {
    const ta = a.startDate ? new Date(a.startDate).getTime() : Infinity;
    const tb = b.startDate ? new Date(b.startDate).getTime() : Infinity;
    return ta - tb;
  });
}

/** Whether the viewer has saved this event. */
export async function isEventBookmarked(eventId: string, userId: string) {
  return Boolean(await EventBookmarkModel.exists({ userId, eventId }));
}

/** Organizer view: who is anticipating (saved) this event, with registration state. */
export async function listEventAnticipators(eventId: string, actorId: string) {
  await requireEventManager(eventId, actorId);
  const bookmarks = await EventBookmarkModel.find({ eventId }).sort({ createdAt: -1 }).limit(200).lean();
  if (!bookmarks.length) return [];
  const registrations = await EventRegistrationModel.find({
    eventId,
    userId: { $in: bookmarks.map((b) => b.userId) },
    status: { $nin: ['CANCELLED', 'REJECTED'] },
  })
    .select('userId')
    .lean();
  const registered = new Set(registrations.map((r) => r.userId.toString()));
  const anticipators = await Promise.all(
    bookmarks.map(async (b) => {
      const user = await authStore.getPublicUserById(b.userId.toString()).catch(() => null);
      if (!user) return null;
      return {
        id: user.id,
        fullName: user.fullName,
        username: user.username ?? '',
        avatar: user.profile?.avatar ?? '',
        registered: registered.has(b.userId.toString()),
        savedAt: b.createdAt,
      };
    }),
  );
  return anticipators.filter((a): a is NonNullable<typeof a> => Boolean(a));
}

/**
 * Organizer blast to everyone registered for THIS event (bell + branded email).
 * Distinct from community announcements — reaches exactly the people coming,
 * including non-members who bought tickets. "Bring your laptop tomorrow."
 */
export async function messageEventAttendees(
  eventId: string,
  actorId: string,
  input: { subject?: string; message?: string; sectionKey?: string },
) {
  const event = await requireEventManager(eventId, actorId);
  const subject = String(input.subject ?? '').trim().slice(0, 120);
  const message = String(input.message ?? '').trim().slice(0, 2000);
  if (subject.length < 3) throw new Error('A subject is required');
  if (message.length < 5) throw new Error('A message is required');

  // Optional per-track blast: "bring laptops tomorrow" only needs to reach Data Science.
  const sectionKey = String(input.sectionKey ?? '').trim();
  let sectionName = '';
  if (sectionKey) {
    const section = (event.sections ?? []).find((s) => s.key === sectionKey);
    if (!section) throw new Error('Section not found');
    sectionName = section.name;
  }

  const registrations = await EventRegistrationModel.find({
    eventId,
    status: { $nin: ['CANCELLED', 'REJECTED'] },
    ...(sectionKey ? { sectionKey } : {}),
  }).select('userId').lean();

  const seen = new Set<string>();
  let notified = 0;
  for (const registration of registrations) {
    const userId = String(registration.userId);
    if (seen.has(userId)) continue;
    seen.add(userId);
    void createNotification({
      userId,
      type: 'SYSTEM',
      title: `${event.title}: ${subject}`,
      body: message.slice(0, 300),
      link: `/events/${event.slug}`,
    });
    void (async () => {
      try {
        const user = await authStore.getPublicUserById(userId);
        if (!user?.email) return;
        await sendEmail(user.email, categoryEmail('INFO', {
          name: user.fullName,
          subject: `${event.title}: ${subject}`,
          heading: subject,
          message,
          ctaLabel: 'View event details',
          ctaUrl: `${config.frontendUrl}/events/${event.slug}`,
        }));
      } catch { /* best effort per recipient */ }
    })();
    notified += 1;
  }
  return { recipients: seen.size, notified, section: sectionName || null };
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
      title: subject,
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
