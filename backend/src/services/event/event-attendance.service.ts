import { randomUUID } from 'node:crypto';
import { config } from '../../config';
import { EventModel } from '../../models/event.model';
import { EventSpeakerModel } from '../../models/event-speaker.model';
import { EventSponsorModel } from '../../models/event-sponsor.model';
import { EventPartnershipModel } from '../../models/event-partnership.model';
import { EventVolunteerModel } from '../../models/event-volunteer.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { ScannerPassModel } from '../../models/scanner-pass.model';
import { CommunityModel } from '../../models/community.model';
import { authStore } from '../../store/auth-store';
import { awardReputation, REPUTATION_POINTS } from '../reputation.service';
import { awardEventSpeaker, awardEventVolunteer } from './event-people.service';
import { notifyRateEventRequest, notifyOrganizerWrapUp } from '../event-notification.service';
import { ticketCoveredDays } from './event-ticket.service';
import {
  requireEventScanner,
  requireEventManager,
  findEventMemberships,
  membershipWith,
  recalcEventCounters,
  applyCheckIn,
  isMultiDayEvent,
  eventTotalDays,
  dayKeyOf,
  currentEventDay,
  cancelledEventDays,
  distinctDaysAttended,
  requiredAttendanceDays,
  lastEventDayKey,
  scheduledDayEnd,
} from './event-shared';

/**
 * Multi-day gate shared by QR and self check-in: no entry on a cancelled day,
 * and day-scoped tickets only work on the days they cover. Walk-ins skip this
 * (cash at the door is the organizer's call).
 */
async function assertDayAccess(event: InstanceType<typeof EventModel>, registration: { userId: unknown; _id: unknown }) {
  if (!isMultiDayEvent(event)) return;
  const day = currentEventDay(event);
  if (day === 0) return;
  if ((event.days ?? [])[day - 1]?.cancelled) {
    throw new Error(`Day ${day} of this event has been cancelled`);
  }
  const covered = await ticketCoveredDays(event, String(registration.userId), String(registration._id));
  if (covered && !covered.includes(day)) {
    throw new Error(`This ticket is only valid on day ${covered.join(' & ')} — today is day ${day}`);
  }
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
  await assertDayAccess(event, registration);
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

/** Cap on scanner passes per event — enough for a big gate crew, small enough to audit. */
const MAX_SCANNER_PASSES = 10;

/** Mint `count` fresh door-scanner passes (manager only). Each is single-device: first open claims it. */
export async function createScannerPasses(eventId: string, actorId: string, count = 1) {
  await requireEventManager(eventId, actorId);
  const wanted = Math.min(Math.max(Math.round(count) || 1, 1), 6);
  const existing = await ScannerPassModel.countDocuments({ eventId });
  if (existing + wanted > MAX_SCANNER_PASSES) {
    throw new Error(`An event can have at most ${MAX_SCANNER_PASSES} scanner links — revoke unused ones first`);
  }
  const passes = await ScannerPassModel.insertMany(
    Array.from({ length: wanted }, (_, i) => ({
      eventId,
      createdBy: actorId,
      token: `SCN-${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      label: `Scanner ${existing + i + 1}`,
    })),
  );
  return passes.map(serializeScannerPass);
}

/** The organizer's view: every pass with its claim status. */
export async function listScannerPasses(eventId: string, actorId: string) {
  await requireEventManager(eventId, actorId);
  const passes = await ScannerPassModel.find({ eventId }).sort({ createdAt: 1 }).lean();
  return passes.map(serializeScannerPass);
}

/** Revoke one pass — the link dies instantly on whatever device claimed it. */
export async function revokeScannerPass(eventId: string, passId: string, actorId: string) {
  await requireEventManager(eventId, actorId);
  const removed = await ScannerPassModel.findOneAndDelete({ _id: passId, eventId });
  if (!removed) throw new Error('Scanner link not found');
  return { revoked: true as const };
}

function serializeScannerPass(pass: { _id: unknown; token: string; label: string; deviceId: string; claimedAt: Date | null; createdAt: Date }) {
  return {
    id: String(pass._id),
    token: pass.token,
    label: pass.label,
    claimed: Boolean(pass.deviceId),
    claimedAt: pass.claimedAt,
    createdAt: pass.createdAt,
  };
}

/**
 * Resolve + device-lock a scanner pass. The first device to present a deviceId
 * claims the pass atomically; any other device is refused afterwards. A pass
 * opened without a deviceId is readable (info) but cannot scan.
 */
async function requireScannerPass(scannerToken: string, deviceId?: string) {
  if (!scannerToken.startsWith('SCN-')) {
    throw new Error('This scanner link is invalid or has been revoked');
  }
  let pass = await ScannerPassModel.findOne({ token: scannerToken });
  if (!pass) {
    throw new Error('This scanner link is invalid or has been revoked');
  }
  if (deviceId) {
    if (!pass.deviceId) {
      // Atomic claim — two devices racing the first open can't both win.
      pass = await ScannerPassModel.findOneAndUpdate(
        { _id: pass._id, deviceId: '' },
        { $set: { deviceId, claimedAt: new Date() } },
        { new: true },
      ) ?? await ScannerPassModel.findOne({ _id: pass._id });
    }
    if (pass && pass.deviceId && pass.deviceId !== deviceId) {
      throw new Error('This scanner link is already in use on another device — ask the organizer for your own link');
    }
  }
  if (!pass) throw new Error('This scanner link is invalid or has been revoked');
  return pass;
}

/** Public info for the door-scanner page header: which event this link controls. */
export async function getDoorScannerInfo(scannerToken: string, deviceId?: string) {
  const pass = await requireScannerPass(scannerToken, deviceId);
  const event = await EventModel.findOne({ _id: pass.eventId, deletedAt: null }).select('title slug status startDate venue mode').lean();
  if (!event) {
    throw new Error('This scanner link is invalid or has been revoked');
  }
  return {
    title: event.title,
    status: event.status,
    startDate: event.startDate,
    venue: event.venue,
    mode: event.mode,
    label: pass.label,
    scanningOpen: ['CHECK_IN', 'CHECK_OUT'].includes(event.status),
  };
}

/**
 * Door-link scan: the scanner pass IS the authorization — no account needed.
 * Helpers at the gate open /scan/<token> on their phones and scan QR passes.
 * Same rules as the logged-in scanner (day access, duplicates, stay-to-end);
 * scans are attributed to the organizer with scannerRole DOOR_LINK, and the
 * link only works while the organizer has check-in/check-out open.
 */
export async function doorScan(scannerToken: string, qrToken: string, action: 'in' | 'out', deviceId: string, meta: { ip?: string; userAgent?: string } = {}) {
  if (!deviceId) {
    throw new Error('This device could not be identified — reload the page and try again');
  }
  const pass = await requireScannerPass(scannerToken, deviceId);
  const event = await EventModel.findOne({ _id: pass.eventId, deletedAt: null });
  if (!event) {
    throw new Error('This scanner link is invalid or has been revoked');
  }
  if (!['CHECK_IN', 'CHECK_OUT'].includes(event.status)) {
    throw new Error('Scanning is closed — ask the organizer to open check-in');
  }
  // Accept the QR token OR the short typed gate code (case/dash-insensitive).
  const scanned = qrToken.trim();
  let registration = await EventRegistrationModel.findOne({ qrToken: scanned });
  if (!registration) {
    const code = scanned.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length >= 4 && code.length <= 10) {
      registration = await EventRegistrationModel.findOne({ eventId: event._id, passCode: code });
    }
  }
  if (!registration || registration.eventId.toString() !== event._id.toString()) {
    throw new Error('Invalid attendance pass for this event');
  }
  const actorId = String(event.createdBy);

  if (action === 'in') {
    if (registration.status === 'CANCELLED' || registration.status === 'REJECTED') {
      throw new Error('This registration is not eligible for check-in');
    }
    await assertDayAccess(event, registration);
    if (!applyCheckIn(event, registration)) {
      throw new Error(isMultiDayEvent(event) ? 'Already checked in today' : 'Already checked in');
    }
    registration.attendanceVerified = true;
    registration.checkedInBy = actorId as any;
    registration.scannerRole = 'DOOR_LINK';
    if (meta.ip) registration.checkInIp = meta.ip;
    if (meta.userAgent) registration.checkInUserAgent = meta.userAgent;
    await registration.save();
    await recalcEventCounters(event._id.toString());
    const user = await authStore.getPublicUserById(registration.userId.toString());
    // Their track rides along so the gate crew can point them to the right room.
    const scanSection = (event.sections ?? []).find((s) => s.key === registration.sectionKey) ?? null;
    return {
      success: true as const,
      action,
      student: user?.fullName ?? '',
      status: registration.status,
      section: scanSection ? { name: scanSection.name, venue: scanSection.venue ?? '' } : null,
    };
  }

  // Check-out: same per-day duplicate guards as the logged-in scanner.
  if (isMultiDayEvent(event)) {
    const today = dayKeyOf(new Date(), event.timezone);
    const entry = (registration.attendanceDays ?? []).find((d) => d.day === today && d.checkInAt);
    if (!entry) throw new Error('Attendee has not checked in today');
    if (entry.checkOutAt) throw new Error('Already checked out today');
  } else {
    if (!registration.checkInAt) throw new Error('Attendee has not checked in');
    if (registration.checkOutAt) throw new Error('Already checked out');
  }
  const result = await finishCheckOut(event, registration, actorId, 'DOOR_LINK', meta);
  const user = await authStore.getPublicUserById(result.userId.toString());
  return { success: true as const, action, student: user?.fullName ?? '', status: result.status };
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
    EventModel.findById(result.eventId).select('title slug sections').lean(),
  ]);
  const stationSection = (event?.sections ?? []).find((s) => s.key === result.sectionKey) ?? null;
  return {
    success: true,
    student: user?.fullName ?? '',
    event: event?.title ?? '',
    checkedInAt: result.checkInAt,
    section: stationSection ? { name: stationSection.name, venue: stationSection.venue ?? '' } : null,
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
    // Day-scoped tickets are judged only on the days they cover (minus any cancelled).
    const baseRequired = requiredAttendanceDays(event);
    const covered = await ticketCoveredDays(event, String(registration.userId), String(registration._id));
    const cancelledSet = new Set(cancelledEventDays(event));
    const required = covered ? Math.max(1, Math.min(baseRequired, covered.filter((d) => !cancelledSet.has(d)).length)) : baseRequired;
    const metDayQuota = distinctDaysAttended(event, registration) >= required;
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
 * Returns the meeting link too so "check in & join" is a single round trip
 * (the link is otherwise stripped from event payloads until check-in).
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
  await assertDayAccess(event, registration);
  if (!applyCheckIn(event, registration)) return { registration, meetingLink: event.meetingLink ?? '' };

  registration.attendanceVerified = true;
  registration.checkedInBy = userId as any;
  registration.scannerRole = 'SELF';
  if (meta.ip) registration.checkInIp = meta.ip;
  if (meta.userAgent) registration.checkInUserAgent = meta.userAgent;
  await registration.save();
  await recalcEventCounters(eventId);
  return { registration, meetingLink: event.meetingLink ?? '' };
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

  // Per-track pulse: arrivals per section so staff can balance rooms at a glance.
  let sections: { key: string; name: string; venue: string; capacity: number; registered: number; checkedIn: number; checkedInToday: number | null }[] = [];
  if ((event.sections ?? []).length) {
    const today = isMultiDayEvent(event) ? dayKeyOf(new Date(), event.timezone) : null;
    sections = await Promise.all(
      (event.sections ?? []).map(async (s) => {
        const [registered, sectionCheckedIn, sectionCheckedInToday] = await Promise.all([
          EventRegistrationModel.countDocuments({
            eventId,
            sectionKey: s.key,
            status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] },
          }),
          EventRegistrationModel.countDocuments({ eventId, sectionKey: s.key, checkInAt: { $ne: null } }),
          today
            ? EventRegistrationModel.countDocuments({ eventId, sectionKey: s.key, attendanceDays: { $elemMatch: { day: today, checkInAt: { $ne: null } } } })
            : Promise.resolve(-1),
        ]);
        return {
          key: s.key,
          name: s.name,
          venue: s.venue ?? '',
          capacity: s.capacity ?? 0,
          registered,
          checkedIn: sectionCheckedIn,
          checkedInToday: today ? sectionCheckedInToday : null,
        };
      }),
    );
  }
  return {
    title: event.title,
    status: event.status,
    day,
    sections,
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
    const cancelledSet = new Set(cancelledEventDays(event));
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
      // Day-scoped tickets are judged only on the days they cover (minus any cancelled).
      const covered = await ticketCoveredDays(event, String(registration.userId), String(registration._id));
      const personalRequired = covered
        ? Math.max(1, Math.min(required, covered.filter((d) => !cancelledSet.has(d)).length))
        : required;
      const completed =
        distinctDaysAttended(event, registration) >= personalRequired &&
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

  // Post-event follow-ups (each one-time via its own stamp): ask attendees to
  // rate the event, and send the organizer their wrap-up digest.
  void notifyRateEventRequest(eventId).catch(() => undefined);
  void notifyOrganizerWrapUp(eventId).catch(() => undefined);

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
