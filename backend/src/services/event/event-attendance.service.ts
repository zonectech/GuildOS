import { randomUUID } from 'node:crypto';
import { config } from '../../config';
import { EventModel } from '../../models/event.model';
import { EventSpeakerModel } from '../../models/event-speaker.model';
import { EventSponsorModel } from '../../models/event-sponsor.model';
import { EventPartnershipModel } from '../../models/event-partnership.model';
import { EventVolunteerModel } from '../../models/event-volunteer.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { CommunityModel } from '../../models/community.model';
import { authStore } from '../../store/auth-store';
import { awardReputation, REPUTATION_POINTS } from '../reputation.service';
import { awardEventSpeaker, awardEventVolunteer } from './event-people.service';
import {
  requireEventScanner,
  findEventMemberships,
  membershipWith,
  recalcEventCounters,
  applyCheckIn,
  isMultiDayEvent,
  eventTotalDays,
  dayKeyOf,
  currentEventDay,
  distinctDaysAttended,
  requiredAttendanceDays,
  lastEventDayKey,
  scheduledDayEnd,
} from './event-shared';

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
  if (!applyCheckIn(event, registration)) {
    throw new Error(isMultiDayEvent(event) ? 'Student already checked in today' : 'Student already checked in');
  }
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
 * (single-day: stay to the end + minimum duration; multi-day: enough distinct
 * days + minimum total duration), saves and awards reputation. Mid-event
 * multi-day checkouts settle as CHECKED_OUT — the attendee returns tomorrow
 * and finalize decides the rest.
 */
async function finishCheckOut(
  event: InstanceType<typeof EventModel>,
  registration: InstanceType<typeof EventRegistrationModel>,
  actorId: string,
  scannerRole: string,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const now = new Date();
  const multiDay = isMultiDayEvent(event);
  registration.checkOutAt = now;
  if (multiDay) {
    const entry = (registration.attendanceDays ?? []).find((d) => d.day === dayKeyOf(now, event.timezone) && d.checkInAt);
    if (entry) {
      entry.checkOutAt = now;
      entry.minutes = Math.max(0, Math.round((now.getTime() - new Date(entry.checkInAt as Date).getTime()) / 60000));
    }
    registration.attendanceMinutes = (registration.attendanceDays ?? []).reduce((sum, d) => sum + (d.minutes ?? 0), 0);
  } else {
    registration.attendanceMinutes = Math.max(0, Math.round((now.getTime() - registration.checkInAt!.getTime()) / 60000));
  }

  const meetsDuration = registration.attendanceMinutes >= (event.minimumAttendanceDuration ?? 0);
  let completed: boolean;
  if (multiDay) {
    // The distinct-day quota replaces the single-day "stay to the end" rule.
    const metDayQuota = distinctDaysAttended(event, registration) >= requiredAttendanceDays(event);
    completed = metDayQuota && meetsDuration;
    const finalDay = lastEventDayKey(event);
    const isFinalDay = finalDay !== null && dayKeyOf(now, event.timezone) >= finalDay;
    if (!completed && !isFinalDay) {
      // Done for today but the event continues — they can check in again tomorrow.
      registration.status = 'CHECKED_OUT';
      registration.checkedOutBy = actorId as any;
      registration.scannerRole = scannerRole;
      if (meta.ip) registration.checkInIp = registration.checkInIp || meta.ip;
      if (meta.userAgent) registration.checkInUserAgent = registration.checkInUserAgent || meta.userAgent;
      await registration.save();
      await recalcEventCounters(event._id.toString());
      return registration;
    }
  } else {
    // Attendees must stay to the end: completion requires checking out at/after the event end
    // time (when scheduled) and meeting any configured minimum attendance duration.
    const stayedToEnd = event.endDate ? now.getTime() >= new Date(event.endDate).getTime() : true;
    completed = stayedToEnd && meetsDuration;
  }
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
  if (isMultiDayEvent(event)) {
    const today = dayKeyOf(new Date(), event.timezone);
    const entry = (registration.attendanceDays ?? []).find((d) => d.day === today && d.checkInAt);
    if (!entry) {
      throw new Error('Attendee has not checked in today');
    }
    if (entry.checkOutAt) {
      throw new Error('Student already checked out today');
    }
  } else {
    if (!registration.checkInAt) {
      throw new Error('Attendee has not checked in');
    }
    if (registration.checkOutAt) {
      throw new Error('Student already checked out');
    }
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
  if (!applyCheckIn(event, registration)) return registration;

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
  if (isMultiDayEvent(event)) {
    const today = dayKeyOf(new Date(), event.timezone);
    const entry = (registration.attendanceDays ?? []).find((d) => d.day === today && d.checkInAt);
    if (!entry) throw new Error('Check in first');
    if (entry.checkOutAt) return registration;
  } else {
    if (!registration.checkInAt) throw new Error('Check in first');
    if (registration.checkOutAt) return registration;
  }

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
    if (registration.status === 'CANCELLED' || registration.status === 'REJECTED') {
      registration.registrationType = 'WALK_IN';
    }
    if (!applyCheckIn(event, registration)) {
      return registration;
    }
    await registration.save();
  } else {
    registration = new EventRegistrationModel({
      eventId,
      communityId: event.communityId,
      userId,
      registrationType: 'WALK_IN',
      qrToken: randomUUID(),
    });
    applyCheckIn(event, registration);
    await registration.save();
  }

  await recalcEventCounters(eventId);
  return registration;
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

  // Multi-day pulse: which day it is, who's in today, and who said they'd come today.
  let day: { current: number; total: number; checkedInToday: number; expectedToday: number } | null = null;
  if (isMultiDayEvent(event)) {
    const current = currentEventDay(event);
    const today = dayKeyOf(new Date(), event.timezone);
    const [checkedInToday, expectedToday] = await Promise.all([
      EventRegistrationModel.countDocuments({ eventId, attendanceDays: { $elemMatch: { day: today, checkInAt: { $ne: null } } } }),
      current >= 1
        ? EventRegistrationModel.countDocuments({
            eventId,
            status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] },
            $or: [{ plannedDays: { $size: 0 } }, { plannedDays: current }],
          })
        : Promise.resolve(0),
    ]);
    day = { current, total: eventTotalDays(event), checkedInToday, expectedToday };
  }
  return {
    title: event.title,
    status: event.status,
    day,
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
  let partialCount = 0;
  if (isMultiDayEvent(event)) {
    // Multi-day settlement: anyone still open is judged on distinct days attended
    // (a check-in counts the day; minutes only accrue through checkouts).
    const open = await EventRegistrationModel.find({ eventId, status: { $in: ['CHECKED_IN', 'CHECKED_OUT', 'PARTIAL_ATTENDANCE'] } });
    const required = requiredAttendanceDays(event);
    for (const registration of open) {
      // Forgot-to-scan-out days: credit minutes up to the day's scheduled end so
      // duration reports aren't skewed (the day counted either way).
      let credited = false;
      for (const entry of registration.attendanceDays ?? []) {
        if (entry.checkInAt && !entry.checkOutAt) {
          const end = scheduledDayEnd(event, entry.day);
          const checkIn = new Date(entry.checkInAt).getTime();
          if (end && end > checkIn) {
            entry.minutes = Math.min(Math.round((end - checkIn) / 60000), 16 * 60);
            credited = true;
          }
        }
      }
      if (credited) {
        registration.attendanceMinutes = (registration.attendanceDays ?? []).reduce((sum, d) => sum + (d.minutes ?? 0), 0);
        registration.markModified('attendanceDays');
      }
      const completed =
        distinctDaysAttended(event, registration) >= required &&
        (registration.attendanceMinutes ?? 0) >= (event.minimumAttendanceDuration ?? 0);
      registration.status = completed ? 'COMPLETED' : 'PARTIAL_ATTENDANCE';
      registration.certificateEligible = completed;
      await registration.save();
      if (completed) {
        await awardReputation({
          userId: registration.userId.toString(),
          category: 'ATTENDANCE',
          type: 'EVENT_COMPLETED',
          referenceId: eventId,
          communityId: event.communityId.toString(),
          scoreAwarded: 10,
          description: `Completed ${event.title}`,
        });
      } else {
        partialCount += 1;
      }
    }
  } else {
    // Checked in but never checked out → PARTIAL_ATTENDANCE (departure unverified, not eligible).
    const partial = await EventRegistrationModel.updateMany(
      { eventId, status: 'CHECKED_IN', checkOutAt: null },
      { $set: { status: 'PARTIAL_ATTENDANCE', certificateEligible: false } },
    );
    partialCount = partial.modifiedCount ?? 0;
  }

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

  return { noShows: noShow.modifiedCount ?? 0, partials: partialCount };
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
