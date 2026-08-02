import { randomUUID } from 'node:crypto';
import { EventModel } from '../../models/event.model';
import { EventRegistrationModel, type EventRegistrationStatus } from '../../models/event-registration.model';
import { CommunityModel } from '../../models/community.model';
import { TicketClaimModel } from '../../models/ticket-claim.model';
import { authStore } from '../../store/auth-store';
import { createNotification } from '../notification.service';
import { sendEmail, categoryEmail, type EmailCategory } from '../../utils/email';
import {
  notifyRegistrationApproved,
  notifyRegistrationConfirmed,
  notifyRegistrationRejected,
} from '../event-notification.service';
import { requireEventManager, recalcEventCounters, eventTotalDays, isMultiDayEvent } from './event-shared';

export async function registerForEvent(
  eventId: string,
  userId: string,
  options: { attendanceMode?: string | null; plannedDays?: number[] } = {},
) {
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
  // Paid events register exclusively through the ticket checkout — the free
  // path would otherwise hand out tickets without payment.
  if ((event.ticketPrice ?? 0) > 0) {
    throw new Error('This is a paid event — get a ticket to register');
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

  // Multi-day RSVP: which days they plan to attend ([] / all days selected = every day).
  // Purely informational for organizer planning — it never restricts check-in.
  const totalDays = eventTotalDays(event);
  let plannedDays: number[] = [];
  if (isMultiDayEvent(event) && Array.isArray(options.plannedDays)) {
    plannedDays = [...new Set(options.plannedDays.map((d) => Math.round(Number(d))))].filter((d) => d >= 1 && d <= totalDays).sort((a, b) => a - b);
    if (plannedDays.length === totalDays) plannedDays = [];
  }

  const existing = await EventRegistrationModel.findOne({ eventId, userId });
  if (existing && existing.status !== 'CANCELLED') {
    return existing;
  }

  // Approval-required events queue the request for leadership review.
  if (event.registrationPolicy === 'APPROVAL') {
    const registration = existing
      ? Object.assign(existing, { status: 'PENDING_APPROVAL' as EventRegistrationStatus, registrationType: 'APPROVAL', attendanceMode, plannedDays, communityId: event.communityId, registeredAt: new Date(), qrToken: existing.qrToken || randomUUID() })
      : new EventRegistrationModel({ eventId, communityId: event.communityId, userId, registrationType: 'APPROVAL', attendanceMode, plannedDays, status: 'PENDING_APPROVAL', qrToken: randomUUID() });
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
    ? Object.assign(existing, { status, registrationType: 'OPEN', attendanceMode, plannedDays, communityId: event.communityId, registeredAt: new Date(), qrToken: existing.qrToken || randomUUID() })
    : new EventRegistrationModel({ eventId, communityId: event.communityId, userId, registrationType: 'OPEN', attendanceMode, plannedDays, status, qrToken: randomUUID() });
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
