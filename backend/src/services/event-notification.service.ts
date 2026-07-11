import { sendEmail, categoryEmail, type EmailCategory } from '../utils/email';
import { authStore } from '../store/auth-store';
import { config } from '../config';
import { EventModel } from '../models/event.model';
import { EventRegistrationModel } from '../models/event-registration.model';

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
      registrations.map((registration) =>
        notify(
          registration.userId.toString(),
          'INFO',
          `Reminder: ${event.title}`,
          'Your event is coming up',
          [
            `This is a reminder that ${event.title} is starting soon.`,
            ...whenWhere(payload),
            'Remember to check in when you arrive and check out at the end to earn your certificate.',
          ],
          payload,
        ),
      ),
    );

    event.reminderSentAt = new Date();
    await event.save();
    sent += 1;
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
