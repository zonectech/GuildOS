import { EventFeedbackModel } from '../../models/event-feedback.model';
import { EventModel } from '../../models/event.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { authStore } from '../../store/auth-store';
import { aiChat, isAiConfigured, parseJsonLoose } from '../ai-provider';
import { findEventMemberships, membershipWith, requireEventManager, getManagerMembership, isMultiDayEvent, distinctDaysAttended } from './event-shared';

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

export type FeedbackInsights = {
  summary: string;
  wentWell: string[];
  improvements: string[];
  suggestions: string[];
  nextEventOutlook: string;
};

/**
 * AI planning brief for organizers: digests every rating and comment across the
 * community's events into what worked, what to fix, and concrete suggestions for
 * the next event. Falls back to pure stats when no AI provider is configured.
 */
export async function getCommunityFeedbackInsights(communityId: string, actorId: string) {
  await getManagerMembership(communityId, actorId);

  const events = await EventModel.find({ communityId, deletedAt: null })
    .select('title startDate status')
    .sort({ startDate: -1 })
    .limit(30)
    .lean();
  const eventIds = events.map((e) => e._id);
  const feedback = eventIds.length
    ? await EventFeedbackModel.find({ eventId: { $in: eventIds } }).sort({ updatedAt: -1 }).limit(500).lean()
    : [];

  const byEvent = new Map<string, { ratings: number[]; comments: string[] }>();
  for (const entry of feedback) {
    const key = entry.eventId.toString();
    const bucket = byEvent.get(key) ?? { ratings: [], comments: [] };
    bucket.ratings.push(entry.rating);
    if (entry.comment) bucket.comments.push(entry.comment);
    byEvent.set(key, bucket);
  }

  const perEvent = events
    .map((event) => {
      const bucket = byEvent.get(event._id.toString());
      if (!bucket?.ratings.length) return null;
      const average = Math.round((bucket.ratings.reduce((a, b) => a + b, 0) / bucket.ratings.length) * 10) / 10;
      return {
        title: event.title,
        date: event.startDate,
        average,
        count: bucket.ratings.length,
        comments: bucket.comments.slice(0, 8),
      };
    })
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  const totalRatings = perEvent.reduce((sum, e) => sum + e.count, 0);
  const averageRating = totalRatings
    ? Math.round((perEvent.reduce((sum, e) => sum + e.average * e.count, 0) / totalRatings) * 10) / 10
    : 0;
  // Trend: newest half of rated events vs the older half (events are date-sorted desc).
  const half = Math.ceil(perEvent.length / 2);
  const avgOf = (list: typeof perEvent) => {
    const n = list.reduce((s, e) => s + e.count, 0);
    return n ? Math.round((list.reduce((s, e) => s + e.average * e.count, 0) / n) * 10) / 10 : 0;
  };
  const trend = perEvent.length >= 2 ? { recent: avgOf(perEvent.slice(0, half)), earlier: avgOf(perEvent.slice(half)) } : null;

  const base = { averageRating, totalRatings, ratedEvents: perEvent.length, events: perEvent, trend, aiAvailable: isAiConfigured() };
  if (!totalRatings || !isAiConfigured()) {
    return { ...base, insights: null as FeedbackInsights | null };
  }

  const corpus = perEvent
    .map((e) => `Event: ${e.title} (${e.average}/5 from ${e.count} verified attendees)\nComments:\n${e.comments.map((c) => `- ${c}`).join('\n') || '- (no comments)'}`)
    .join('\n\n');
  const content = await aiChat({
    messages: [
      {
        role: 'system',
        content:
          'You are an event-planning analyst for student community organizers in Nigeria. You are given verified attendee feedback (1-5 ratings and comments) from past events. Reply ONLY with a JSON object: {"summary": string (2-3 sentences), "wentWell": string[] (max 4), "improvements": string[] (max 4), "suggestions": string[] (max 4, concrete actions for the NEXT event), "nextEventOutlook": string (1 sentence predicting turnout/rating if suggestions are applied)}. Be specific and practical; quote recurring themes, never invent facts not in the feedback.',
      },
      { role: 'user', content: `Community event feedback history:\n\n${corpus}` },
    ],
    temperature: 0.4,
    maxTokens: 700,
    jsonMode: true,
  });

  const parsed = content ? (parseJsonLoose(content) as Partial<FeedbackInsights> | null) : null;
  const asList = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, max) : []);
  const insights: FeedbackInsights | null = parsed && typeof parsed.summary === 'string'
    ? {
        summary: parsed.summary.slice(0, 600),
        wentWell: asList(parsed.wentWell, 4),
        improvements: asList(parsed.improvements, 4),
        suggestions: asList(parsed.suggestions, 4),
        nextEventOutlook: typeof parsed.nextEventOutlook === 'string' ? parsed.nextEventOutlook.slice(0, 300) : '',
      }
    : null;

  return { ...base, insights };
}
