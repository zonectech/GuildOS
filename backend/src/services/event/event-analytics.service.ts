import { EventFeedbackModel } from '../../models/event-feedback.model';
import { EventModel } from '../../models/event.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { authStore } from '../../store/auth-store';
import { findEventMemberships, membershipWith, requireEventManager, isMultiDayEvent, distinctDaysAttended } from './event-shared';

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

export async function getAttendanceReport(eventId: string, actorId: string) {
  const event = await requireEventManager(eventId, actorId);
  const registrations = await EventRegistrationModel.find({ eventId }).sort({ registeredAt: 1 }).lean();
  const multiDay = isMultiDayEvent(event);
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
        daysAttended: multiDay ? distinctDaysAttended(event, registration) : registration.checkInAt ? 1 : 0,
        plannedDays: registration.plannedDays ?? [],
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
