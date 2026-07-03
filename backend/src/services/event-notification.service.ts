import { sendEmail } from '../utils/email';
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

function buildHtml(title: string, lines: string[]) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="color: #0f172a;">${title}</h2>
      ${lines.map((l) => `<p>${l}</p>`).join('')}
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #6b7280;">GuildOS</p>
    </div>
  `;
}

async function notify(userId: string, subject: string, heading: string, lines: string[]) {
  try {
    const user = await authStore.getPublicUserById(userId);
    if (!user?.email) return;
    await sendEmail(user.email, { subject, text: lines.join('\n'), html: buildHtml(heading, lines) });
  } catch (error) {
    console.warn('[GuildOS] notification failed:', error instanceof Error ? error.message : error);
  }
}

function whenWhere(event: NotifiableEvent) {
  const lines: string[] = [];
  lines.push(`When: ${event.startDate ? new Date(event.startDate).toLocaleString() : 'TBA'}`);
  if (event.venue) lines.push(`Where: ${event.venue}`);
  if (event.meetingLink) lines.push(`Link: ${event.meetingLink}`);
  lines.push(`Details: ${eventUrl(event.slug)}`);
  return lines;
}

export function notifyRegistrationConfirmed(userId: string, event: NotifiableEvent) {
  void notify(userId, `You're registered: ${event.title}`, 'Registration confirmed', [
    `You are successfully registered for ${event.title}.`,
    ...whenWhere(event),
    'Remember to complete both Check-In and Check-Out to qualify for certificates and Guild Score rewards.',
  ]);
}

export function notifyRegistrationApproved(userId: string, event: NotifiableEvent) {
  void notify(userId, `Registration approved: ${event.title}`, 'Registration approved', [
    `Your registration for ${event.title} has been approved.`,
    ...whenWhere(event),
  ]);
}

export function notifyRegistrationRejected(userId: string, event: NotifiableEvent) {
  void notify(userId, `Registration update: ${event.title}`, 'Registration not approved', [
    `Unfortunately your registration for ${event.title} was not approved.`,
    `Details: ${eventUrl(event.slug)}`,
  ]);
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
      notify(registration.userId.toString(), `Venue updated: ${event.title}`, 'Event location changed', [
        `The location for ${event.title} has been updated.`,
        ...whenWhere(event),
      ]),
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
        notify(registration.userId.toString(), `Reminder: ${event.title}`, 'Your event is coming up', [
          `This is a reminder that ${event.title} is starting soon.`,
          ...whenWhere(payload),
          'Remember to check in when you arrive and check out at the end to earn your certificate.',
        ]),
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
