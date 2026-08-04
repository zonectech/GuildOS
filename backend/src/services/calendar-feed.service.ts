import { randomUUID } from 'node:crypto';
import { UserModel } from '../models/user.model';
import { EventModel } from '../models/event.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { config } from '../config';

/**
 * Personal iCal subscription feed ("subscribe once, every event you register for
 * shows up in your phone calendar automatically").
 *
 * - Each user gets a private, unguessable calendar token (minted on first request,
 *   revocable by regenerating).
 * - The feed itself is PUBLIC by token — calendar apps (Google/Apple/Outlook) poll
 *   it without cookies, so the token IS the authorization.
 * - Multi-day events emit one VEVENT per agenda day (own time/venue/theme), matching
 *   the on-page "Add to calendar" export.
 * - Nigeria-first: agenda day times are fixed-offset +01:00 (Africa/Lagos, no DST).
 */

const ACTIVE_STATUSES = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'];

export async function getCalendarFeedUrl(userId: string, regenerate = false) {
  const user = await UserModel.findById(userId).select('calendarToken');
  if (!user) throw new Error('User not found');
  if (!user.calendarToken || regenerate) {
    user.calendarToken = `CAL-${randomUUID()}`;
    await user.save();
  }
  return { path: `/api/events/calendar/${user.calendarToken}/guildos.ics` };
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Agenda-day date (+ "HH:mm") in Africa/Lagos (+01:00, no DST) → absolute instant. */
function dayInstant(date: Date, time: string): Date {
  const ymd = date.toISOString().slice(0, 10);
  return new Date(`${ymd}T${(time || '09:00').padStart(5, '0')}:00+01:00`);
}

/** RFC 5545 lines must fold at 75 octets — Google Calendar rejects longer ones. */
function foldLine(line: string): string[] {
  if (line.length <= 74) return [line];
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length) {
    parts.push(' ' + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  return parts;
}

export async function buildUserCalendar(calendarToken: string): Promise<string> {
  const user = await UserModel.findOne({ calendarToken, deletedAt: null, status: 'ACTIVE' }).select('_id fullName').lean();
  if (!user) throw new Error('Invalid calendar link');

  const registrations = await EventRegistrationModel.find({ userId: user._id, status: { $in: ACTIVE_STATUSES } })
    .select('eventId')
    .lean();

  // Past 30 days for context, everything upcoming.
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const events = await EventModel.find({
    _id: { $in: registrations.map((r) => r.eventId) },
    deletedAt: null,
    status: { $nin: ['DRAFT'] },
    endDate: { $gte: cutoff },
  })
    .select('title slug shortDescription venue meetingLink startDate endDate days status cancellationReason')
    .lean();

  const stamp = icsStamp(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GuildOS//My Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:GuildOS — My events',
    'X-WR-TIMEZONE:Africa/Lagos',
    // Ask clients to re-poll roughly hourly.
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];

  for (const event of events) {
    const cancelled = event.status === 'ARCHIVED' && Boolean(event.cancellationReason);
    if (cancelled) continue; // registrations get cancelled + refunded separately; keep the feed clean
    const url = `${config.frontendUrl}/events/${event.slug}`;
    const agendaDays = (event.days ?? []).filter((d) => d.date && !d.cancelled);
    if (agendaDays.length > 1) {
      agendaDays.forEach((day) => {
        const dayNo = (event.days ?? []).indexOf(day) + 1;
        const start = dayInstant(day.date as Date, day.startTime || '09:00');
        const end = day.endTime ? dayInstant(day.date as Date, day.endTime) : new Date(start.getTime() + 4 * 3600_000);
        const summary = day.theme ? `${event.title} — Day ${dayNo}: ${day.theme}` : `${event.title} — Day ${dayNo}`;
        lines.push(
          'BEGIN:VEVENT',
          `UID:${event._id}-day${dayNo}@guildos`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${icsStamp(start)}`,
          `DTEND:${icsStamp(end)}`,
          ...foldLine(`SUMMARY:${icsEscape(summary)}`),
          ...foldLine(`DESCRIPTION:${icsEscape([event.shortDescription, url].filter(Boolean).join('\n'))}`),
          ...foldLine(`LOCATION:${icsEscape(day.venue || event.venue || event.meetingLink || '')}`),
          ...foldLine(`URL:${url}`),
          'END:VEVENT',
        );
      });
    } else if (event.startDate) {
      const start = new Date(event.startDate);
      const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 3600_000);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${event._id}@guildos`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsStamp(start)}`,
        `DTEND:${icsStamp(end)}`,
        ...foldLine(`SUMMARY:${icsEscape(event.title)}`),
        ...foldLine(`DESCRIPTION:${icsEscape([event.shortDescription, url].filter(Boolean).join('\n'))}`),
        ...foldLine(`LOCATION:${icsEscape(event.venue || event.meetingLink || '')}`),
        ...foldLine(`URL:${url}`),
        'END:VEVENT',
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
