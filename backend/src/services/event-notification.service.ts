import { sendEmail, categoryEmail, type EmailCategory } from '../utils/email';
import { authStore } from '../store/auth-store';
import { config } from '../config';
import { EventModel } from '../models/event.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { createNotification } from './notification.service';

export type NotifiableEvent = {
  title: string;
  slug: string;
  startDate?: Date | null;
  venue?: string;
  meetingLink?: string;
};

function eventUrl(slug: string) {
  return `${config.frontendUrl}/events/${encodeURIComponent(slug)}`;
}

async function notify(
  userId: string,
  category: EmailCategory,
  subject: string,
  heading: string,
  lines: string[],
  event?: NotifiableEvent,
) {
  try {
    const user = await authStore.getPublicUserById(userId);
    if (!user?.email) return;
    await sendEmail(
      user.email,
      categoryEmail(category, {
        name: user.fullName,
        subject,
        heading,
        message: lines.join('\n\n'),
        ...(event ? { ctaLabel: 'View event details', ctaUrl: eventUrl(event.slug) } : {}),
      }),
    );
  } catch (error) {
    console.warn('[GuildOS] notification failed:', error instanceof Error ? error.message : error);
  }
}

function whenWhere(event: NotifiableEvent) {
  const lines: string[] = [];
  lines.push(`When: ${event.startDate ? new Date(event.startDate).toLocaleString() : 'TBA'}`);
  if (event.venue) lines.push(`Where: ${event.venue}`);
  // The meeting link is NOT emailed — online attendees unlock it by checking in
  // on the event page once the event is live (keeps attendance honest).
  if (event.meetingLink) lines.push('Online: check in on the event page when it goes live to get the meeting link');
  return lines;
}

export function notifyRegistrationConfirmed(userId: string, event: NotifiableEvent) {
  void notify(
    userId,
    'CONFIRMATION',
    `You're registered: ${event.title}`,
    'Registration confirmed',
    [
      `You are successfully registered for ${event.title}.`,
      ...whenWhere(event),
      'Remember to complete both Check-In and Check-Out to qualify for certificates and Guild Score rewards.',
    ],
    event,
  );
}

export function notifyRegistrationApproved(userId: string, event: NotifiableEvent) {
  void notify(
    userId,
    'CONGRATS',
    `Registration approved: ${event.title}`,
    'Registration approved',
    [`Your registration for ${event.title} has been approved.`, ...whenWhere(event)],
    event,
  );
}

export function notifyRegistrationRejected(userId: string, event: NotifiableEvent) {
  void notify(
    userId,
    'WARNING',
    `Registration update: ${event.title}`,
    'Registration not approved',
    [`Unfortunately your registration for ${event.title} was not approved.`],
    event,
  );
}

export async function notifyVenueChanged(eventId: string, event: NotifiableEvent) {
  const registrations = await EventRegistrationModel.find({
    eventId,
    status: { $in: ['CONFIRMED', 'WAITLISTED', 'CHECKED_IN'] },
  })
    .select('userId')
    .lean();

  await Promise.all(
    registrations.map((registration) =>
      notify(
        registration.userId.toString(),
        'WARNING',
        `Venue updated: ${event.title}`,
        'Event location changed',
        [`The location for ${event.title} has been updated.`, ...whenWhere(event)],
        event,
      ),
    ),
  );
}

// Sends a one-time reminder to active registrants for events starting within the window.
export async function sendDueEventReminders(windowMs = config.eventReminderWindowMs) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMs);

  const events = await EventModel.find({
    deletedAt: null,
    status: { $in: ['PUBLISHED', 'CHECK_IN'] },
    reminderSentAt: null,
    startDate: { $ne: null, $gte: now, $lte: windowEnd },
  });

  let sent = 0;
  for (const event of events) {
    const registrations = await EventRegistrationModel.find({
      eventId: event._id,
      status: { $in: ['CONFIRMED', 'WAITLISTED', 'CHECKED_IN'] },
    })
      .select('userId')
      .lean();

    const payload: NotifiableEvent = {
      title: event.title,
      slug: event.slug,
      startDate: event.startDate,
      venue: event.venue,
      meetingLink: event.meetingLink,
    };

    await Promise.all(
      registrations.map(async (registration) => {
        const userId = registration.userId.toString();
        // Bell + realtime push, alongside the email.
        await createNotification({
          userId,
          type: 'SYSTEM',
          title: `⏰ ${event.title} starts soon`,
          body: event.startDate ? `Starts ${new Date(event.startDate).toLocaleString()}${event.venue ? ` · ${event.venue}` : ''}` : '',
          link: `/events/${event.slug}`,
        }).catch(() => undefined);
        await notify(
          userId,
          'INFO',
          `Reminder: ${event.title}`,
          'Your event is coming up',
          [
            `This is a reminder that ${event.title} is starting soon.`,
            ...whenWhere(payload),
            'Remember to check in when you arrive and check out at the end to earn your certificate.',
          ],
          payload,
        );
      }),
    );

    event.reminderSentAt = new Date();
    await event.save();
    sent += 1;
  }

  sent += await sendDueDayReminders(now, windowEnd);

  return sent;
}

/**
 * Multi-day events: remind registrants the evening before each agenda day
 * ("Day 2 starts soon") — the hardest problem of multi-day events is day-2+
 * turnout. Day 1 is covered by the whole-event reminder above. Recipients are
 * filtered by their RSVP plan (no plan = attending every day).
 */
async function sendDueDayReminders(now: Date, windowEnd: Date) {
  const events = await EventModel.find({
    deletedAt: null,
    status: { $in: ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'] },
    'days.1': { $exists: true }, // at least two agenda days
  });

  let sent = 0;
  for (const event of events) {
    let stamped = false;
    for (let index = 1; index < (event.days ?? []).length; index += 1) {
      const day = event.days[index];
      const marker = `d${index + 1}`;
      if (!day.date || event.dayRemindersSent.includes(marker)) continue;
      // Day start = agenda date (+ its start time when set).
      const timeMatch = day.startTime ? /^(\d{2}):(\d{2})$/.exec(day.startTime) : null;
      const startsAt = new Date(new Date(day.date).getTime() + (timeMatch ? Number(timeMatch[1]) * 3600_000 + Number(timeMatch[2]) * 60_000 : 0));
      if (startsAt < now || startsAt > windowEnd) continue;

      const dayNumber = index + 1;
      const registrations = await EventRegistrationModel.find({
        eventId: event._id,
        status: { $in: ['CONFIRMED', 'WAITLISTED', 'CHECKED_IN', 'CHECKED_OUT'] },
        $or: [{ plannedDays: { $size: 0 } }, { plannedDays: dayNumber }],
      })
        .select('userId')
        .lean();

      const payload: NotifiableEvent = { title: event.title, slug: event.slug, startDate: startsAt, venue: day.venue || event.venue, meetingLink: event.meetingLink };
      await Promise.all(
        registrations.map(async (registration) => {
          const userId = registration.userId.toString();
          // Bell + realtime push, alongside the email.
          await createNotification({
            userId,
            type: 'SYSTEM',
            title: `⏰ Day ${dayNumber} of ${event.title} starts soon`,
            body: [day.theme, `Starts ${startsAt.toLocaleString()}`, day.venue || event.venue].filter(Boolean).join(' · '),
            link: `/events/${event.slug}`,
          }).catch(() => undefined);
          await notify(
            userId,
            'INFO',
            `Reminder: Day ${dayNumber} of ${event.title}`,
            `Day ${dayNumber} starts soon`,
            [
              day.theme
                ? `Day ${dayNumber} of ${event.title} — ${day.theme} — is coming up.`
                : `Day ${dayNumber} of ${event.title} is coming up.`,
              ...whenWhere(payload),
              'Bring your QR pass — the same pass works every day. Check in on arrival to have the day counted.',
            ],
            payload,
          );
        }),
      );

      event.dayRemindersSent.push(marker);
      stamped = true;
      sent += 1;
    }
    if (stamped) await event.save();
  }

  return sent;
}

let reminderRunning = false;

export function startEventReminderScheduler(intervalMs = config.eventReminderIntervalMs) {
  const tick = async () => {
    if (reminderRunning) return;
    reminderRunning = true;
    try {
      const count = await sendDueEventReminders();
      if (count) {
        console.log(`[GuildOS] Sent reminders for ${count} event(s)`);
      }
    } catch (error) {
      console.warn('[GuildOS] reminder sweep failed:', error instanceof Error ? error.message : error);
    } finally {
      reminderRunning = false;
    }
  };

  // Run shortly after boot, then on the configured interval.
  setTimeout(() => void tick(), 10_000);
  const handle = setInterval(() => void tick(), intervalMs);
  if (typeof handle.unref === 'function') handle.unref();
  console.log(`[GuildOS] Event reminder scheduler started (every ${Math.round(intervalMs / 60000)} min)`);
  return handle;
}
