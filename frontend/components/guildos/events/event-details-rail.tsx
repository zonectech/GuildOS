'use client';

import { CalendarDays, Mail, MapPin, Phone, Share2, Ticket, UtensilsCrossed, Video } from 'lucide-react';
import type { EventRegistration, EventSummary } from '../event-api';

function icsStamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

// ICS text fields must escape backslashes, commas, semicolons and newlines.
function icsEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Instant for an agenda day at "HH:mm" wall-clock time (dates are stored at the day's midnight). */
function dayInstant(date: string, hhmm: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  const base = new Date(date).getTime();
  return new Date(match ? base + Number(match[1]) * 3600_000 + Number(match[2]) * 60_000 : base);
}

/**
 * The event page's right rail: details card (dates/venue/online/seats),
 * organizer contacts, and calendar/share buttons. Owns the ICS export
 * (one VEVENT per agenda day for multi-day events) and Web Share fallback.
 */
export function EventDetailsRail({
  event,
  isMultiDay,
  totalDays,
  hasPerDayVenues,
  seats,
  activeRegistration,
  checkedInToday,
  meetingHref,
  referralCode = '',
  onNotice,
  onError,
}: {
  event: EventSummary;
  isMultiDay: boolean;
  totalDays: number;
  hasPerDayVenues: boolean;
  seats: string;
  activeRegistration: EventRegistration | null;
  checkedInToday: boolean;
  meetingHref: string;
  /** Logged-in viewer's username on paid events — shared links become tracked referral links. */
  referralCode?: string;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const eventStart = event.startDate ? new Date(event.startDate) : null;
  const eventEnd = event.endDate ? new Date(event.endDate) : eventStart ? new Date(eventStart.getTime() + 3600000) : null;
  const googleCalendarUrl = eventStart && eventEnd
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${icsStamp(eventStart)}/${icsStamp(eventEnd)}&details=${encodeURIComponent(event.shortDescription || '')}&location=${encodeURIComponent(event.venue || event.meetingLink || '')}`
    : '';
  const agendaDays = (event.days ?? []).filter((d) => d.date);

  function downloadIcs() {
    if (!eventStart || !eventEnd) return;
    const stamp = icsStamp(new Date());
    const events: string[] = [];
    if (isMultiDay && agendaDays.length) {
      // One calendar entry per agenda day — each with its own time, venue, and theme.
      agendaDays.forEach((day) => {
        const dayNo = (event.days ?? []).indexOf(day) + 1;
        const start = dayInstant(day.date as string, day.startTime || '09:00');
        const end = day.endTime
          ? dayInstant(day.date as string, day.endTime)
          : new Date(start.getTime() + 4 * 3600_000);
        const summary = day.theme ? `${event.title} — Day ${dayNo}: ${day.theme}` : `${event.title} — Day ${dayNo}`;
        const sessionLines = (day.sessions ?? []).map((s) => `${s.time ? `${s.time} — ` : ''}${s.title}${s.venue ? ` @ ${s.venue}` : ''}`);
        const description = [event.shortDescription, ...sessionLines].filter(Boolean).join('\n');
        events.push(
          'BEGIN:VEVENT',
          `UID:${event._id}-day${dayNo}@guildos`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${icsStamp(start)}`,
          `DTEND:${icsStamp(end)}`,
          `SUMMARY:${icsEscape(summary)}`,
          `DESCRIPTION:${icsEscape(description)}`,
          `LOCATION:${icsEscape(day.venue || event.venue || event.meetingLink || '')}`,
          'END:VEVENT',
        );
      });
    } else {
      events.push(
        'BEGIN:VEVENT',
        `UID:${event._id}@guildos`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsStamp(eventStart)}`,
        `DTEND:${icsStamp(eventEnd)}`,
        `SUMMARY:${icsEscape(event.title)}`,
        `DESCRIPTION:${icsEscape(event.shortDescription || '')}`,
        `LOCATION:${icsEscape(event.venue || event.meetingLink || '')}`,
        'END:VEVENT',
      );
    }
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GuildOS//EN', ...events, 'END:VCALENDAR'];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.slug}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleShare() {
    // On paid events, a logged-in sharer's link carries their referral code — the organizer's
    // sales card credits every ticket bought through it.
    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
    const url = referralCode ? `${base}?ref=${encodeURIComponent(referralCode)}` : base;
    const nav = navigator as Navigator & { share?: (data: { title: string; url: string }) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: event.title, url }); } catch { /* share cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        onNotice(referralCode ? 'Your tracked share link is copied — tickets bought through it are credited to you.' : 'Event link copied to clipboard.');
      } catch {
        onError('Unable to copy link');
      }
    }
  }

  return (
    <>
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Event details</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex items-start gap-2.5">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{isMultiDay ? 'Dates' : 'Date & time'}</p>
              {isMultiDay && eventStart && eventEnd ? (
                <>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {eventStart.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} – {eventEnd.toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{totalDays}-day event · daily times in the agenda</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{event.startDate ? new Date(event.startDate).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : 'TBA'}</p>
                  {event.endDate ? <p className="text-xs text-slate-500 dark:text-slate-400">until {new Date(event.endDate).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</p> : null}
                </>
              )}
            </div>
          </div>
          {event.mode === 'PHYSICAL' || event.mode === 'HYBRID' ? (
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">In person</p>
                {hasPerDayVenues ? (
                  <>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{event.mode === 'HYBRID' ? 'Hybrid event' : 'Physical event'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Each day has its own venue — see the day-by-day agenda</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{event.venue || 'Venue TBA'}</p>
                    {event.address ? <p className="text-xs text-slate-500 dark:text-slate-400">{event.address}</p> : null}
                  </>
                )}
                {event.refreshments ? <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700"><UtensilsCrossed className="h-3.5 w-3.5 shrink-0" /> Refreshments provided (Item 7)</p> : null}
              </div>
            </div>
          ) : null}
          {event.mode === 'VIRTUAL' || event.mode === 'HYBRID' ? (
            <div className="flex items-start gap-2.5">
              <Video className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Online</p>
                {event.meetingLink && checkedInToday ? (
                  <a href={meetingHref} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">Join meeting →</a>
                ) : (
                  // The link is the reward for checking in — the API only serves it once
                  // attendance is recorded, so before that we always show the unlock hint.
                  <p className="font-medium text-slate-800 dark:text-slate-200">{activeRegistration ? 'Tap “Check in & join” — opens 15 min before start' : 'Link unlocked at check-in'}</p>
                )}
              </div>
            </div>
          ) : null}
          <div className="flex items-start gap-2.5">
            <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Seats</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">{seats} · {event.status.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      {(event.contacts ?? []).length ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Contact the organizers</h2>
          <div className="mt-3 space-y-3">
            {(event.contacts ?? []).map((contact, i) => (
              <div key={i} className="text-sm">
                {contact.name ? <p className="font-medium text-slate-800 dark:text-slate-200">{contact.name}</p> : null}
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {contact.phone ? (
                    <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline">
                      <Phone className="h-3.5 w-3.5 shrink-0" /> {contact.phone}
                    </a>
                  ) : null}
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> {contact.email}
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {googleCalendarUrl ? (
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                // Popup blockers (and embedded browsers) can silently swallow
                // target="_blank" — fall back to same-tab navigation so the
                // button always does something.
                const win = window.open(googleCalendarUrl, '_blank', 'noopener,noreferrer');
                if (!win) window.location.href = googleCalendarUrl;
                e.preventDefault();
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Google Calendar
            </a>
          ) : null}
          {eventStart ? (
            <button onClick={downloadIcs} title="Downloads a calendar file — open it and the event appears in Google/Apple/Outlook calendar" className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
              Add to calendar{isMultiDay && agendaDays.length ? ` (${agendaDays.length} days)` : ''}
            </button>
          ) : null}
          <button onClick={() => void handleShare()} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"><Share2 className="h-3.5 w-3.5" /> Share</button>
        </div>
      </div>
    </>
  );
}
