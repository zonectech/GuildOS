import { sendEmail, categoryEmail, type EmailCategory, type EmailAttachment } from '../utils/email';
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
  attachments?: EmailAttachment[],
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
      attachments,
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

/** Payment receipt for a paid ticket: bell + branded email with the amount, reference — and the ticket PNG attached. */
export function notifyTicketPurchased(
  userId: string,
  event: NotifiableEvent,
  payment: { totalNgn: number; ticketNgn: number; feeNgn: number; reference: string; quantity?: number },
  ticketPng?: Buffer | null,
) {
  const qty = payment.quantity ?? 1;
  void createNotification({
    userId,
    type: 'SYSTEM',
    title: `Ticket${qty > 1 ? `s (${qty})` : ''} confirmed: ${event.title} — ₦${payment.totalNgn.toLocaleString()}`,
    body: `Payment reference ${payment.reference}. Your QR pass is on the event page.${qty > 1 ? ' Share the extra ticket links with your guests from the event page.' : ''}`,
    link: `/events/${event.slug}`,
  });
  void notify(
    userId,
    'CONFIRMATION',
    `Your ticket${qty > 1 ? 's' : ''}: ${event.title}`,
    'Payment received — you have a ticket',
    [
      `Thanks for your purchase! Your payment of ₦${payment.totalNgn.toLocaleString()} (₦${payment.ticketNgn.toLocaleString()} ticket${qty > 1 ? `s ×${qty}` : ''} + ₦${payment.feeNgn.toLocaleString()} processing fee) for ${event.title} was successful.`,
      `Payment reference: ${payment.reference}`,
      ...(qty > 1 ? [`You bought ${qty} tickets — your guests' claim links are on the event page. Each guest gets their own QR pass when they claim.`] : []),
      ...whenWhere(event),
      ticketPng
        ? 'Your ticket is attached — present the QR at the door to check in.'
        : 'Your QR pass is on the event page — present it at the door for check-in, or download your designed ticket there.',
    ],
    event,
    ticketPng ? [{ filename: `ticket-${event.slug}.png`, content: ticketPng, contentType: 'image/png' }] : undefined,
  );
}

/** The event was cancelled — free registrants (no payment involved) get told why. */
export function notifyEventCancelled(userId: string, event: { title: string; slug: string }, reason: string) {
  void createNotification({
    userId,
    type: 'SYSTEM',
    title: `Event cancelled: ${event.title}`,
    body: reason,
    link: `/events/${event.slug}`,
  });
  void notify(
    userId,
    'WARNING',
    `Event cancelled: ${event.title}`,
    'This event has been cancelled',
    [
      `${event.title} has been cancelled and your registration is no longer valid.`,
      `Reason: ${reason}`,
      'We apologise for the inconvenience.',
    ],
    { title: event.title, slug: event.slug },
  );
}

/** One or more days of a multi-day event were cancelled — planned attendees get told why. */
export function notifyEventDayCancelled(userId: string, event: { title: string; slug: string }, days: number[], reason: string) {
  const label = days.length === 1 ? `Day ${days[0]}` : `Days ${days.join(' & ')}`;
  void createNotification({
    userId,
    type: 'SYSTEM',
    title: `${label} of ${event.title} cancelled`,
    body: reason,
    link: `/events/${event.slug}`,
  });
  void notify(
    userId,
    'WARNING',
    `${label} of ${event.title} has been cancelled`,
    `${label} is not going ahead`,
    [
      `The organizers have cancelled ${label.toLowerCase()} of ${event.title}.`,
      `Reason: ${reason}`,
      'The rest of the programme still runs as scheduled — your pass remains valid for the other days.',
    ],
    { title: event.title, slug: event.slug },
  );
}

/** The event was cancelled and the buyer's money is coming back (or queued for manual settlement). */
export function notifyTicketRefunded(
  userId: string,
  event: { title: string; slug: string },
  refund: { amountNgn: number; queued: boolean; reason: string },
) {
  const title = refund.queued
    ? `Refund on its way: ${event.title}`
    : `Refund issued: ${event.title} — ₦${refund.amountNgn.toLocaleString()}`;
  void createNotification({
    userId,
    type: 'SYSTEM',
    title,
    body: refund.queued
      ? 'The event was cancelled. Your refund is being processed manually and will reach you shortly.'
      : 'The event was cancelled and your payment has been refunded — it lands back in your account within a few days depending on your bank.',
    link: `/events/${event.slug}`,
  });
  void notify(
    userId,
    'WARNING',
    `Event cancelled: ${event.title}`,
    'Your ticket has been refunded',
    [
      `${event.title} was cancelled (${refund.reason}). Your ticket is no longer valid.`,
      refund.queued
        ? `Your refund of ₦${refund.amountNgn.toLocaleString()} is being processed manually and will be sent to you shortly.`
        : `Your payment of ₦${refund.amountNgn.toLocaleString()} has been refunded. Card refunds can take 3–15 days to appear; bank transfers are usually back within 24 hours.`,
      'We apologise for the inconvenience.',
    ],
    { title: event.title, slug: event.slug },
  );
}

/** Guest claimed a group-buy ticket: confirmation with THEIR ticket PNG attached. */
export function notifyTicketClaimed(userId: string, event: NotifiableEvent, ticketPng?: Buffer | null) {
  void notify(
    userId,
    'CONFIRMATION',
    `Your ticket: ${event.title}`,
    'Ticket claimed — you are in',
    [
      `A ticket for ${event.title} is now yours.`,
      ...whenWhere(event),
      ticketPng
        ? 'Your personal ticket is attached — present the QR at the door to check in.'
        : 'Your QR pass is on the event page — present it at the door for check-in.',
    ],
    event,
    ticketPng ? [{ filename: `ticket-${event.slug}.png`, content: ticketPng, contentType: 'image/png' }] : undefined,
  );
}

/** Heads-up to the event creator that a ticket was sold (bell only — no email spam on busy sales days). */
export function notifyTicketSold(organizerId: string, event: NotifiableEvent, sale: { ticketNgn: number; buyerName: string }) {
  void createNotification({
    userId: organizerId,
    type: 'SYSTEM',
    title: `Ticket sold: ${event.title} — ₦${sale.ticketNgn.toLocaleString()}`,
    body: `${sale.buyerName} bought a ticket. See your earnings in the Wallet.`,
    link: `/dashboard/wallet`,
  });
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
    registrations.map(async (registration) => {
      const userId = registration.userId.toString();
      // Bell + realtime push, alongside the email.
      await createNotification({
        userId,
        type: 'SYSTEM',
        title: `Venue updated: ${event.title}`,
        body: event.venue ? `New location: ${event.venue}` : 'The location has changed — see the event page.',
        link: `/events/${event.slug}`,
      }).catch(() => undefined);
      await notify(
        userId,
        'WARNING',
        `Venue updated: ${event.title}`,
        'Event location changed',
        [`The location for ${event.title} has been updated.`, ...whenWhere(event)],
        event,
      );
    }),
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
          title: `${event.title} starts soon`,
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
  sent += await sendFinalReminders(now);

  return sent;
}

/** "Starting in less than an hour" window for the last-call nudge. */
const FINAL_REMINDER_WINDOW_MS = 60 * 60_000;

/** Shared last-call blast: bell + short email to active registrants. */
async function sendLastCall(
  event: { _id: unknown; title: string; slug: string; venue: string; meetingLink: string },
  startsAt: Date,
  options: { dayNumber?: number; venue?: string; plannedDaysFilter?: number } = {},
) {
  const registrations = await EventRegistrationModel.find({
    eventId: event._id,
    status: { $in: ['CONFIRMED', 'WAITLISTED', 'CHECKED_IN', 'CHECKED_OUT'] },
    ...(options.plannedDaysFilter ? { $or: [{ plannedDays: { $size: 0 } }, { plannedDays: options.plannedDaysFilter }] } : {}),
  })
    .select('userId')
    .lean();

  const what = options.dayNumber ? `Day ${options.dayNumber} of ${event.title}` : event.title;
  const venue = options.venue || event.venue;
  const payload: NotifiableEvent = { title: event.title, slug: event.slug, startDate: startsAt, venue, meetingLink: event.meetingLink };
  await Promise.all(
    registrations.map(async (registration) => {
      const userId = registration.userId.toString();
      await createNotification({
        userId,
        type: 'SYSTEM',
        title: `${what} starts in less than an hour`,
        body: [startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), venue].filter(Boolean).join(' · '),
        link: `/events/${event.slug}`,
      }).catch(() => undefined);
      await notify(
        userId,
        'INFO',
        `Starting soon: ${what}`,
        `${what} starts in less than an hour`,
        [`${what} is about to begin — head over and check in on arrival.`, ...whenWhere(payload)],
        payload,
      );
    }),
  );
}

/**
 * Last-call nudges (~1 hour before): the event start, and each agenda day of a
 * multi-day event. Skipped when the day-before reminder just went out (avoids
 * a double ping for events created at the last minute).
 */
async function sendFinalReminders(now: Date) {
  const windowEnd = new Date(now.getTime() + FINAL_REMINDER_WINDOW_MS);
  let sent = 0;

  // Event start (covers single-day events and Day 1 of multi-day ones).
  const starting = await EventModel.find({
    deletedAt: null,
    status: { $in: ['PUBLISHED', 'CHECK_IN'] },
    finalReminderSentAt: null,
    startDate: { $ne: null, $gte: now, $lte: windowEnd },
  });
  for (const event of starting) {
    const dayBeforeAge = event.reminderSentAt ? now.getTime() - new Date(event.reminderSentAt).getTime() : Infinity;
    if (dayBeforeAge < 30 * 60_000) continue; // the 24h reminder just went out — don't double-ping
    await sendLastCall(event, new Date(event.startDate as Date));
    event.finalReminderSentAt = new Date();
    await event.save();
    sent += 1;
  }

  // Multi-day: each later agenda day gets its own last call.
  const multiDay = await EventModel.find({
    deletedAt: null,
    status: { $in: ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'] },
    'days.1': { $exists: true },
  });
  for (const event of multiDay) {
    let stamped = false;
    for (let index = 1; index < (event.days ?? []).length; index += 1) {
      const day = event.days[index];
      const marker = `d${index + 1}-final`;
      if (!day.date || event.dayRemindersSent.includes(marker)) continue;
      const timeMatch = day.startTime ? /^(\d{2}):(\d{2})$/.exec(day.startTime) : null;
      const startsAt = new Date(new Date(day.date).getTime() + (timeMatch ? Number(timeMatch[1]) * 3600_000 + Number(timeMatch[2]) * 60_000 : 0));
      if (startsAt < now || startsAt > windowEnd) continue;
      await sendLastCall(event, startsAt, { dayNumber: index + 1, venue: day.venue, plannedDaysFilter: index + 1 });
      event.dayRemindersSent.push(marker);
      stamped = true;
      sent += 1;
    }
    if (stamped) await event.save();
  }

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
            title: `Day ${dayNumber} of ${event.title} starts soon`,
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
