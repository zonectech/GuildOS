// Event grouping and labels, the same rules as the current Events page.
import type { EventSummary } from './api';

export const LEARNING_TYPES = ['WORKSHOP', 'TRAINING', 'BOOTCAMP'];
export const MODE_LABEL: Record<string, string> = { PHYSICAL: 'In person', HYBRID: 'Hybrid', VIRTUAL: 'Online' };
export const STATUS_FILTERS = ['Upcoming & Live', 'Ended', 'Cancelled', 'All'] as const;

export type Bucket = 'LIVE' | 'UPCOMING' | 'ENDED' | 'CANCELLED';
const time = (value?: string | null) => (value ? new Date(value).getTime() : NaN);

export function bucketOf(event: EventSummary, now = Date.now()): Bucket {
  if (event.status === 'ARCHIVED' && event.cancellationReason) return 'CANCELLED';
  if (event.status === 'COMPLETED' || event.status === 'ARCHIVED') return 'ENDED';
  if (['POSTPONED', 'ANNOUNCED', 'DRAFT'].includes(event.status)) return 'UPCOMING';
  const end = time(event.endDate);
  if (Number.isFinite(end) && now >= end) return 'ENDED';
  const start = time(event.startDate);
  if (Number.isFinite(start)) return now >= start ? 'LIVE' : 'UPCOMING';
  return event.status === 'CHECK_IN' || event.status === 'CHECK_OUT' ? 'LIVE' : 'UPCOMING';
}

export function registrationOpen(event: EventSummary, now = Date.now()) {
  return ['PUBLISHED', 'CHECK_IN'].includes(event.status) && !event.registrationClosed
    && (!Number.isFinite(time(event.registrationDeadline)) || now <= time(event.registrationDeadline));
}

// Event times show in the event's own timezone, so a Lagos event reads the same on any phone.
export const DEFAULT_TZ = 'Africa/Lagos';
const zone = (tz?: string | null) => { try { new Intl.DateTimeFormat('en-NG', { timeZone: tz || DEFAULT_TZ }); return tz || DEFAULT_TZ; } catch { return DEFAULT_TZ; } };

export function dateBadge(value: string | null, tz?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const timeZone = zone(tz);
  return { day: d.toLocaleString('en-NG', { day: '2-digit', timeZone }), month: d.toLocaleString('en-NG', { month: 'short', timeZone }).toUpperCase() };
}

export function whenLabel(value: string | null, tz?: string | null) {
  if (!value) return 'Date to be announced';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date to be announced';
  const timeZone = zone(tz);
  return `${d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', timeZone })}, ${d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone })}`;
}

export function longDate(event: EventSummary) {
  if (!event.startDate) return { day: 'Date to be announced', time: '' };
  const start = new Date(event.startDate);
  const end = event.endDate ? new Date(event.endDate) : null;
  const timeZone = zone(event.timezone);
  const t = (d: Date) => d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone });
  const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone });
  // Multi-day events show the span of days; one-day events show the hours.
  if (end && dayKey(start) !== dayKey(end)) {
    const short = (d: Date) => d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', timeZone });
    return { day: `${short(start)} to ${short(end)}`, time: `Starts ${t(start)}` };
  }
  return {
    day: start.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', timeZone }),
    time: end ? `${t(start)} to ${t(end)}` : t(start),
  };
}

export function placeLabel(event: EventSummary) {
  return event.mode === 'VIRTUAL' ? 'Online' : [event.venue || 'Venue to be announced', event.state].filter(Boolean).join(', ');
}

/** What's happening now first, then the soonest, with the viewer's school ahead at each step. */
export function sortEvents(events: EventSummary[], myUniversity: string, now = Date.now()) {
  const rank: Record<Bucket, number> = { LIVE: 0, UPCOMING: 1, ENDED: 2, CANCELLED: 3 };
  const uni = myUniversity.trim().toLowerCase();
  const mine = (e: EventSummary) => (uni && (e.communityUniversity ?? '').trim().toLowerCase() === uni ? 0 : 1);
  return [...events].sort((a, b) => {
    const ba = bucketOf(a, now);
    const bb = bucketOf(b, now);
    if (rank[ba] !== rank[bb]) return rank[ba] - rank[bb];
    if ((ba === 'LIVE' || ba === 'UPCOMING') && mine(a) !== mine(b)) return mine(a) - mine(b);
    const ta = a.startDate ? new Date(a.startDate).getTime() : Infinity;
    const tb = b.startDate ? new Date(b.startDate).getTime() : Infinity;
    return ba === 'ENDED' || ba === 'CANCELLED' ? tb - ta : ta - tb;
  });
}

export function isMySchool(event: EventSummary, myUniversity: string) {
  return Boolean(myUniversity) && (event.communityUniversity ?? '').trim().toLowerCase() === myUniversity.trim().toLowerCase();
}

/** The latest finished events, newest first, for when nothing is coming up. */
export function recentlyEnded(events: EventSummary[], limit = 6, now = Date.now()) {
  return sortEvents(events.filter((e) => bucketOf(e, now) === 'ENDED'), '', now).slice(0, limit);
}
