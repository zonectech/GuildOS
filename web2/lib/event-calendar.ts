import type { Event } from './api/types';

const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n|\r/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const stamp = (value: string | number) => new Date(value).toISOString().replace(/[-:]|\.\d{3}/g, '');
function fold(line: string) {
  let result = '', current = '', bytes = 0;
  const encoder = new TextEncoder();
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { result += current + '\r\n'; current = ' '; bytes = 1; }
    current += char; bytes += size;
  }
  return result + current;
}

/** A calendar entry contains public event details; it never embeds a pass or a private meeting link. */
export function eventCalendar(event: Event, eventUrl: string, now = Date.now()) {
  if (!event.startDate || !event.endDate || !Number.isFinite(Date.parse(event.startDate)) || !Number.isFinite(Date.parse(event.endDate))) throw new Error('The event dates are not available yet');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kintriva//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${escape(event.id)}@kintriva`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(event.startDate)}`, `DTEND:${stamp(event.endDate)}`,
    `SUMMARY:${escape(event.title)}`, `LOCATION:${escape(event.mode === 'VIRTUAL' ? 'Online — join through the event page' : event.venue)}`,
    `DESCRIPTION:${escape([event.summary, event.whatToBring ? 'What to bring: ' + event.whatToBring : '', 'Event details and your pass: ' + eventUrl].filter(Boolean).join('\n\n'))}`,
    `URL:${eventUrl}`, 'END:VEVENT', 'END:VCALENDAR'];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadEventCalendar(event: Event) {
  const url = URL.createObjectURL(new Blob([eventCalendar(event, new URL(`/events/${event.slug}`, window.location.origin).href)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `${event.slug}.ics`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
