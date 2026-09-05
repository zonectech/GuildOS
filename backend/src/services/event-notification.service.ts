import { sendEmail, categoryEmail, type EmailCategory, type EmailAttachment } from '../utils/email';
import { authStore } from '../store/auth-store';
import { config } from '../config';
import { EventModel } from '../models/event.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { EventBookmarkModel } from '../models/event-bookmark.model';
import { EventSpeakerModel } from '../models/event-speaker.model';
import { EventVolunteerModel } from '../models/event-volunteer.model';
import { EventPartnershipModel } from '../models/event-partnership.model';
import { EventFeedbackModel } from '../models/event-feedback.model';
import { TicketPaymentModel } from '../models/ticket-payment.model';
import { MembershipModel } from '../models/membership.model';
import { createNotification } from './notification.service';

export type NotifiableEvent = {
  title: string;
  slug: string;
  startDate?: Date | null;
  venue?: string;
  meetingLink?: string;
  /** Attendee group chat resolved for THIS recipient (their section's group when they have one). */
  chatLink?: string;
};

/** Resolve the group-chat link a specific attendee should get: their section's group first, else the event-wide one. */
export function attendeeChatLinkFor(
  event: { attendeeChatLink?: string; sections?: { key: string; chatLink?: string }[] },
  sectionKey?: string | null,
): string {
  const section = sectionKey ? (event.sections ?? []).find((s) => s.key === sectionKey) : undefined;
  return section?.chatLink || event.attendeeChatLink || '';
}

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

/** Nigeria-standard date-time for emails/bells (server may run in any timezone). */
function fmtWhen(d: Date): string {
  return d.toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
}

function whenWhere(event: NotifiableEvent) {
  const lines: string[] = [];
  lines.push(`When: ${event.startDate ? fmtWhen(new Date(event.startDate)) : 'TBA'}`);
  if (event.venue) lines.push(`Where: ${event.venue}`);
  // The meeting link is NOT emailed — online attendees unlock it by checking in
  // on the event page once the event is live (keeps attendance honest).
  if (event.meetingLink) lines.push('Online: check in on the event page when it goes live to get the meeting link');
  // The group chat IS emailed — every recipient of a whenWhere() notification holds a confirmed spot.
  if (event.chatLink) lines.push(`Join the attendee group chat: ${event.chatLink}`);
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

/** A spot opened up and the first person on the waitlist got it — bell + email so they actually show up. */
export function notifyWaitlistPromoted(userId: string, event: NotifiableEvent) {
  void createNotification({
    userId,
    type: 'SYSTEM',
    title: `You're in! A spot opened up for ${event.title}`,
    body: 'You have been moved off the waitlist — your registration is confirmed.',
    link: `/events/${event.slug}`,
  });
  void notify(
    userId,
    'CONGRATS',
    `You're off the waitlist: ${event.title}`,
    'A spot opened up — you are confirmed',
    [
      `Someone gave up their spot at ${event.title}, and you were first in line — your registration is now CONFIRMED.`,
      ...whenWhere(event),
      'Your QR pass is on the event page. Remember to check in and out to qualify for certificates.',
    ],
    event,
  );
}

/** Someone handed their ticket over — the new holder gets the good news + their own QR pointer. */
export function notifyTicketTransferred(userId: string, event: NotifiableEvent, fromName: string) {
  void createNotification({
    userId,
    type: 'SYSTEM',
    title: `${fromName} transferred you a ticket: ${event.title}`,
    body: 'The ticket is now yours — your personal QR pass is on the event page.',
    link: `/events/${event.slug}`,
  });
  void notify(
    userId,
    'CONGRATS',
    `A ticket to ${event.title} is now yours`,
    'Ticket transferred to you',
    [
      `${fromName} transferred their ticket for ${event.title} to you.`,
      ...whenWhere(event),
      'Your personal QR pass is on the event page — present it at the door for check-in.',
    ],
    event,
  );
}

/** Ticket confirmation: bell + branded email — a payment receipt for paid orders, a plain "you're in" for free ones. */
export function notifyTicketPurchased(
  userId: string,
  event: NotifiableEvent,
  payment: { totalNgn: number; ticketNgn: number; feeNgn: number; reference: string; quantity?: number; passCode?: string },
  ticketPng?: Buffer | null,
) {
  const qty = payment.quantity ?? 1;
  // Free orders (free tier / 100% promo) must never read like a ₦0 card charge.
  const free = payment.totalNgn <= 0;
  const gateCode = payment.passCode ? `${payment.passCode.slice(0, 3)}-${payment.passCode.slice(3)}` : '';
  void createNotification({
    userId,
    type: 'SYSTEM',
    title: free
      ? `Free ticket${qty > 1 ? `s (${qty})` : ''} confirmed: ${event.title}`
      : `Ticket${qty > 1 ? `s (${qty})` : ''} confirmed: ${event.title} — ₦${payment.totalNgn.toLocaleString()}`,
    body: `${free ? 'No payment was needed.' : `Payment reference ${payment.reference}.`} Your QR pass is on the event page.${qty > 1 ? ' Share the extra ticket links with your guests from the event page.' : ''}`,
    link: `/events/${event.slug}`,
  });
  void notify(
    userId,
    'CONFIRMATION',
    `Your ticket${qty > 1 ? 's' : ''}: ${event.title}`,
    free ? 'You’re in — your free ticket is confirmed' : 'Payment received — you have a ticket',
    [
      free
        ? `Your free ticket${qty > 1 ? `s (×${qty})` : ''} for ${event.title} ${qty > 1 ? 'are' : 'is'} confirmed — there was nothing to pay.`
        : `Thanks for your purchase! Your payment of ₦${payment.totalNgn.toLocaleString()} (₦${payment.ticketNgn.toLocaleString()} ticket${qty > 1 ? `s ×${qty}` : ''} + ₦${payment.feeNgn.toLocaleString()} processing fee) for ${event.title} was successful.`,
      `${free ? 'Order' : 'Payment'} reference: ${payment.reference}`,
      ...(gateCode ? [`Gate code: ${gateCode} — if QR scanning fails at the door, tell the crew this code.`] : []),
      ...(qty > 1 ? [`You have ${qty} tickets — your guests' claim links are on the event page. Each guest gets their own QR pass when they claim.`] : []),
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

/** A speaker was billed on a day that just got cancelled — tell them their session is off. */
export function notifySpeakerDayCancelled(userId: string, event: { title: string; slug: string }, days: number[], reason: string) {
  const label = days.length === 1 ? `Day ${days[0]}` : `Days ${days.join(' & ')}`;
  void createNotification({
    userId,
    type: 'SYSTEM',
    title: `Your speaking day at ${event.title} was cancelled`,
    body: reason,
    link: `/events/${event.slug}`,
  });
  void notify(
    userId,
    'WARNING',
    `${label} of ${event.title} has been cancelled`,
    'A day you were speaking on is not going ahead',
    [
      `The organizers have cancelled ${label.toLowerCase()} of ${event.title}, which you were scheduled to speak on.`,
      `Reason: ${reason}`,
      'The rest of the programme still runs as scheduled. Reach out to the organizers if you need to rearrange your session.',
    ],
    { title: event.title, slug: event.slug },
  );
}

/**
 * Part of the buyer's ticket days got cancelled — a proportional slice of the ticket
 * price is coming back, and the ticket stays valid for the remaining day(s).
 */
export function notifyTicketPartiallyRefunded(
  userId: string,
  event: { title: string; slug: string },
  refund: { amountNgn: number; days: number[]; queued: boolean; reason: string },
) {
  const label = refund.days.length === 1 ? `Day ${refund.days[0]}` : `Days ${refund.days.join(' & ')}`;
  const title = refund.queued
    ? `Partial refund on its way: ${event.title}`
    : `Partial refund issued: ${event.title} — ₦${refund.amountNgn.toLocaleString()}`;
  void createNotification({
    userId,
    type: 'SYSTEM',
    title,
    body: refund.queued
      ? `${label} was cancelled. Your ₦${refund.amountNgn.toLocaleString()} refund is being processed manually and will reach you shortly. Your ticket remains valid for the other days.`
      : `${label} was cancelled and ₦${refund.amountNgn.toLocaleString()} of your ticket has been refunded. Your ticket remains valid for the other days.`,
    link: `/events/${event.slug}`,
  });
  void notify(
    userId,
    'WARNING',
    `${label} of ${event.title} cancelled — partial refund`,
    'Part of your ticket has been refunded',
    [
      `The organizers have cancelled ${label.toLowerCase()} of ${event.title}, which your ticket covered.`,
      `Reason: ${refund.reason}`,
      refund.queued
        ? `A partial refund of ₦${refund.amountNgn.toLocaleString()} is being processed manually and will reach you shortly.`
        : `A partial refund of ₦${refund.amountNgn.toLocaleString()} has been issued — it lands back in your account within a few days depending on your bank.`,
      'Your ticket remains valid for the remaining day(s) — no action needed.',
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

/** The organizers cancelled this person's (free) registration — they hear why immediately. */
export function notifyRegistrationCancelledByOrganizer(userId: string, event: { title: string; slug: string }, reason: string) {
  void createNotification({
    userId,
    type: 'SYSTEM',
    title: `Registration cancelled: ${event.title}`,
    body: reason,
    link: `/events/${event.slug}`,
  });
  void notify(
    userId,
    'WARNING',
    `Registration cancelled: ${event.title}`,
    'The organizers cancelled your registration',
    [
      `Your registration for ${event.title} was cancelled by the organizers.`,
      `Reason: ${reason}`,
      'If you believe this was a mistake, you can contact the organizers through the event page.',
    ],
    { title: event.title, slug: event.slug },
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

/** Registration just opened on an announced event — tell everyone who anticipated it. */
export async function notifyRegistrationOpened(eventId: string, event: NotifiableEvent) {
  const bookmarks = await EventBookmarkModel.find({ eventId }).select('userId').lean();
  const when = event.startDate
    ? new Date(event.startDate).toLocaleString('en-NG', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
    : 'soon';

  await Promise.all(
    bookmarks.map(async (b) => {
      const userId = b.userId.toString();
      await createNotification({
        userId,
        type: 'SYSTEM',
        title: `Registration is open: ${event.title}`,
        body: `The event you anticipated starts ${when} — grab your spot before it fills up.`,
        link: `/events/${event.slug}`,
      }).catch(() => undefined);
      await notify(
        userId,
        'CONFIRMATION',
        `Registration is open: ${event.title}`,
        'The event you anticipated is ready',
        [`Registration just opened for ${event.title}.`, 'You saved this event — register now before spots run out.', ...whenWhere(event)],
        event,
      );
    }),
  );
}

/** The event was postponed — registrations stay valid; a new date is coming. */
export async function notifyEventPostponed(eventId: string, event: NotifiableEvent, note = '') {
  const registrations = await EventRegistrationModel.find({
    eventId,
    status: { $in: ['CONFIRMED', 'WAITLISTED', 'CHECKED_IN'] },
  })
    .select('userId')
    .lean();

  await Promise.all(
    registrations.map(async (registration) => {
      const userId = registration.userId.toString();
      await createNotification({
        userId,
        type: 'SYSTEM',
        title: `Postponed: ${event.title}`,
        body: note || 'The event is postponed — a new date will be announced. Your registration stays valid.',
        link: `/events/${event.slug}`,
      }).catch(() => undefined);
      await notify(
        userId,
        'WARNING',
        `Postponed: ${event.title}`,
        'Event postponed — new date coming',
        [
          `${event.title} has been postponed by the organizers.`,
          note ? `Organizer's note: ${note}` : '',
          'Your registration and any ticket remain valid — you will be notified as soon as the new date is announced.',
        ].filter(Boolean),
        event,
      );
    }),
  );
}

/** The event's date/time moved — every active registrant gets a bell + email (venue-change parallel). */
export async function notifyDateChanged(eventId: string, event: NotifiableEvent) {
  const registrations = await EventRegistrationModel.find({
    eventId,
    status: { $in: ['CONFIRMED', 'WAITLISTED', 'CHECKED_IN'] },
  })
    .select('userId')
    .lean();

  const when = event.startDate
    ? new Date(event.startDate).toLocaleString('en-NG', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
    : 'a new date — see the event page';

  await Promise.all(
    registrations.map(async (registration) => {
      const userId = registration.userId.toString();
      await createNotification({
        userId,
        type: 'SYSTEM',
        title: `New date: ${event.title}`,
        body: `The event now starts ${when}.`,
        link: `/events/${event.slug}`,
      }).catch(() => undefined);
      await notify(
        userId,
        'WARNING',
        `Date changed: ${event.title}`,
        'Event schedule changed',
        [`${event.title} has moved — it now starts ${when}.`, 'Your registration and pass remain valid for the new date.', ...whenWhere(event)],
        event,
      );
    }),
  );

  // Anticipators too: people who SAVED the event but never registered still want
  // to hear the new date — that interest is exactly what the bookmark captured.
  const registrantIds = new Set(registrations.map((r) => r.userId.toString()));
  const bookmarks = await EventBookmarkModel.find({ eventId }).select('userId').lean();
  await Promise.all(
    bookmarks
      .filter((b) => !registrantIds.has(b.userId.toString()))
      .map((b) =>
        createNotification({
          userId: b.userId.toString(),
          type: 'SYSTEM',
          title: `New date: ${event.title}`,
          body: `An event you saved now starts ${when} — register before it fills up.`,
          link: `/events/${event.slug}`,
        }).catch(() => undefined),
      ),
  );
}

/**
 * Anticipation nudge: people who saved an event but never registered get one
 * reminder when it starts within 48 hours. Runs from the server scheduler;
 * `anticipatorsRemindedAt` dedupes it to once per event.
 */
export async function remindAnticipators(now = new Date()) {
  const events = await EventModel.find({
    deletedAt: null,
    status: 'PUBLISHED',
    anticipatorsRemindedAt: null,
    startDate: { $gt: now, $lt: new Date(now.getTime() + 48 * 60 * 60 * 1000) },
  })
    .select('title slug startDate venue meetingLink')
    .limit(50)
    .lean();

  for (const event of events) {
    const [bookmarks, registrations] = await Promise.all([
      EventBookmarkModel.find({ eventId: event._id }).select('userId').lean(),
      EventRegistrationModel.find({ eventId: event._id, status: { $nin: ['CANCELLED', 'REJECTED'] } }).select('userId').lean(),
    ]);
    const registered = new Set(registrations.map((r) => r.userId.toString()));
    const when = event.startDate
      ? new Date(event.startDate).toLocaleString('en-NG', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
      : 'soon';
    await Promise.all(
      bookmarks
        .filter((b) => !registered.has(b.userId.toString()))
        .map((b) =>
          createNotification({
            userId: b.userId.toString(),
            type: 'SYSTEM',
            title: `Starts ${when}: ${event.title}`,
            body: 'You saved this event — it starts soon and you have not registered yet.',
            link: `/events/${event.slug}`,
          }).catch(() => undefined),
        ),
    );
    await EventModel.updateOne({ _id: event._id }, { anticipatorsRemindedAt: new Date() });
  }
}

/**
 * The event was cancelled — tell the TEAM, not just the audience: speakers with linked
 * accounts, volunteers, and the leadership (VP+) of accepted co-host communities.
 * Pending co-host invites are deleted (a dead event must not keep collecting partners).
 * Best-effort per person; deduped so someone who is both speaker and volunteer hears once.
 */
export async function notifyEventTeamCancelled(eventId: string, event: { title: string; slug: string }, reason: string) {
  const [speakers, volunteers, partnerships] = await Promise.all([
    EventSpeakerModel.find({ eventId, userId: { $ne: null } }).select('userId').lean(),
    EventVolunteerModel.find({ eventId }).select('userId').lean(),
    EventPartnershipModel.find({ eventId, status: { $in: ['ACCEPTED', 'PENDING'] } }).select('communityId status').lean(),
  ]);

  const teamIds = new Set<string>();
  for (const s of speakers) if (s.userId) teamIds.add(s.userId.toString());
  for (const v of volunteers) teamIds.add(v.userId.toString());

  // Co-host leadership (VP+) of every accepted or still-pending partner community.
  const partnerCommunityIds = partnerships.map((p) => p.communityId);
  if (partnerCommunityIds.length) {
    const leaders = await MembershipModel.find({
      communityId: { $in: partnerCommunityIds },
      role: { $in: ['VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'] },
      status: 'ACTIVE',
    })
      .select('userId')
      .lean();
    for (const l of leaders) teamIds.add(l.userId.toString());
  }

  // A dead event must not keep an open co-host invitation dangling.
  await EventPartnershipModel.deleteMany({ eventId, status: 'PENDING' }).catch(() => undefined);

  await Promise.all(
    [...teamIds].map(async (userId) => {
      await createNotification({
        userId,
        type: 'SYSTEM',
        title: `Event cancelled: ${event.title}`,
        body: reason,
        link: `/events/${event.slug}`,
      }).catch(() => undefined);
      await notify(
        userId,
        'WARNING',
        `Event cancelled: ${event.title}`,
        'An event you are part of has been cancelled',
        [
          `${event.title} — which you were involved in as a speaker, volunteer, or co-host — has been cancelled.`,
          `Reason: ${reason}`,
          'No further action is needed from you.',
        ],
        { title: event.title, slug: event.slug },
      );
    }),
  );

  return { teamNotified: teamIds.size };
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
          body: event.startDate ? `Starts ${fmtWhen(new Date(event.startDate))}${event.venue ? ` · ${event.venue}` : ''}` : '',
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
        body: [startsAt.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }), venue].filter(Boolean).join(' · '),
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
            body: [day.theme, `Starts ${fmtWhen(startsAt)}`, day.venue || event.venue].filter(Boolean).join(' · '),
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

/**
 * Event finished → ask everyone who actually showed up to rate it (bell + email,
 * once per event via ratingNudgeSentAt). Ratings feed the public score and the
 * sponsor report's AI summary, so silence here costs organizers real money.
 */
export async function notifyRateEventRequest(eventId: string) {
  // Atomic one-time claim — re-finalizing never re-nudges.
  const event = await EventModel.findOneAndUpdate(
    { _id: eventId, deletedAt: null, ratingNudgeSentAt: null },
    { $set: { ratingNudgeSentAt: new Date() } },
  ).lean();
  if (!event) return { nudged: 0 };

  const attended = await EventRegistrationModel.find({
    eventId,
    $or: [{ checkInAt: { $ne: null } }, { 'attendanceDays.checkInAt': { $ne: null } }],
    status: { $in: ['COMPLETED', 'PARTIAL_ATTENDANCE', 'CHECKED_OUT', 'CHECKED_IN'] },
  })
    .select('userId')
    .lean();
  if (!attended.length) return { nudged: 0 };

  const alreadyRated = new Set(
    (await EventFeedbackModel.find({ eventId }).select('userId').lean()).map((f) => String(f.userId)),
  );

  let nudged = 0;
  for (const registration of attended) {
    const userId = String(registration.userId);
    if (alreadyRated.has(userId)) continue;
    nudged += 1;
    await createNotification({
      userId,
      type: 'SYSTEM',
      title: `How was ${event.title}?`,
      body: 'Leave a quick rating — it helps the organizers and takes ten seconds.',
      link: `/events/${event.slug}`,
    }).catch(() => undefined);
    await notify(
      userId,
      'INFO',
      `How was ${event.title}?`,
      'Rate the event',
      [
        `Thanks for attending ${event.title}! A quick star rating (and a comment if you like) helps the organizers improve and takes ten seconds.`,
        'You can rate it right on the event page.',
      ],
      { title: event.title, slug: event.slug },
    );
  }
  return { nudged };
}

/**
 * Event finished → one wrap-up digest to the organizer: attendance, revenue,
 * ratings, and the next steps (report + certificates). One-time per event.
 */
export async function notifyOrganizerWrapUp(eventId: string) {
  const event = await EventModel.findOneAndUpdate(
    { _id: eventId, deletedAt: null, organizerSummarySentAt: null, createdBy: { $ne: null } },
    { $set: { organizerSummarySentAt: new Date() } },
  ).lean();
  if (!event?.createdBy) return { sent: false };

  const [regAgg, salesAgg, feedbackAgg] = await Promise.all([
    EventRegistrationModel.aggregate<{ _id: string; count: number }>([
      { $match: { eventId: event._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    TicketPaymentModel.aggregate<{ _id: null; sold: number; earned: number }>([
      { $match: { eventId: event._id, status: 'PAID' } },
      { $group: { _id: null, sold: { $sum: { $ifNull: ['$quantity', 1] } }, earned: { $sum: '$organizerAmount' } } },
    ]),
    EventFeedbackModel.aggregate<{ _id: null; average: number; count: number }>([
      { $match: { eventId: event._id } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
  ]);

  const byStatus = new Map(regAgg.map((r) => [r._id, r.count]));
  const registered = regAgg.filter((r) => !['CANCELLED', 'REJECTED'].includes(r._id)).reduce((sum, r) => sum + r.count, 0);
  const completed = byStatus.get('COMPLETED') ?? 0;
  const partial = byStatus.get('PARTIAL_ATTENDANCE') ?? 0;
  const noShows = byStatus.get('NO_SHOW') ?? 0;
  const checkedIn = completed + partial;
  const rate = registered > 0 ? Math.round((checkedIn / registered) * 100) : 0;
  const sales = salesAgg[0] ?? { sold: 0, earned: 0 };
  const feedback = feedbackAgg[0] ?? { average: 0, count: 0 };

  const lines = [
    `${event.title} is wrapped — here's how it went:`,
    [
      `Registered: ${registered}`,
      `Showed up: ${checkedIn} (${rate}%)`,
      `Completed: ${completed}`,
      ...(partial ? [`Partial attendance: ${partial}`] : []),
      ...(noShows ? [`No-shows: ${noShows}`] : []),
    ].join('\n'),
    ...(sales.sold > 0 ? [`Tickets: ${sales.sold} sold · ₦${Math.round(sales.earned / 100).toLocaleString()} earned (see your Wallet — earnings are now released for withdrawal).`] : []),
    feedback.count > 0
      ? `Ratings so far: ${feedback.average.toFixed(1)}/5 from ${feedback.count} attendee${feedback.count === 1 ? '' : 's'} — attendees have just been invited to rate, so this will grow.`
      : 'Attendees have just been invited to rate the event — ratings will appear on the event page.',
    'Next steps: download the attendance report from the Attendees page, and issue certificates if you enabled them.',
  ];

  await createNotification({
    userId: String(event.createdBy),
    type: 'SYSTEM',
    title: `Wrap-up: ${event.title} — ${checkedIn} attended (${rate}%)`,
    body: `${registered} registered · ${completed} completed${sales.sold ? ` · ₦${Math.round(sales.earned / 100).toLocaleString()} earned` : ''}`,
    link: `/dashboard/events/attendees?eventId=${event._id}`,
  }).catch(() => undefined);
  await notify(
    String(event.createdBy),
    'CONGRATS',
    `Your event wrap-up: ${event.title}`,
    'Event wrapped — your numbers',
    lines,
    { title: event.title, slug: event.slug },
  );
  return { sent: true };
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
