import type { Event, EventPhase } from './api/types';
import { fmtDate, fmtTime, fmtWhen } from '@/lib/format';

const t = (v?: string | null) => (v ? new Date(v).getTime() : NaN);

/** Before, during or after: drives the guest-list tabs, labels and the register card. */
export function phaseOf(e: Event, now = Date.now()): EventPhase {
  if (e.status === 'ARCHIVED' && e.cancellationReason) return 'CANCELLED';
  if (e.status === 'COMPLETED' || e.status === 'ARCHIVED') return 'AFTER';
  if (['POSTPONED', 'ANNOUNCED', 'DRAFT'].includes(e.status)) return 'BEFORE';
  if (Number.isFinite(t(e.endDate)) && now >= t(e.endDate)) return 'AFTER';
  if (Number.isFinite(t(e.startDate)) && now >= t(e.startDate)) return 'LIVE';
  return e.status === 'CHECK_IN' || e.status === 'CHECK_OUT' ? 'LIVE' : 'BEFORE';
}

export function registrationOpen(e: Event, now = Date.now()) {
  return ['PUBLISHED', 'CHECK_IN'].includes(e.status) && !e.registrationClosed && (!Number.isFinite(t(e.registrationDeadline)) || now <= t(e.registrationDeadline));
}

export const DEFAULT_TZ = 'Africa/Lagos';
const zone = (tz?: string | null) => { try { new Intl.DateTimeFormat('en-NG', { timeZone: tz || DEFAULT_TZ }); return tz || DEFAULT_TZ; } catch { return DEFAULT_TZ; } };

export function dateTile(value: string | null, tz?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const timeZone = zone(tz);
  return { day: d.toLocaleString('en-NG', { day: 'numeric', timeZone }), month: d.toLocaleString('en-NG', { month: 'short', timeZone }).slice(0, 3) };
}

/** `past`: for events that are over, multi-day spans say "Started" rather than "Starts". */
export function whenLabel(e: Pick<Event, 'startDate' | 'endDate' | 'timezone'>, past = false) {
  if (!e.startDate) return { day: 'Date to be announced', time: '' };
  const timeZone = zone(e.timezone);
  const s = new Date(e.startDate);
  const end = e.endDate ? new Date(e.endDate) : null;
  const hm = (d: Date) => fmtTime(d, timeZone);
  const key = (d: Date) => d.toLocaleDateString('en-CA', { timeZone });
  if (end && key(s) !== key(end)) {
    const short = (d: Date) => fmtDate(d, timeZone);
    return { day: `${short(s)} – ${short(end)}`, time: `${past ? 'Started' : 'Starts'} ${hm(s)}` };
  }
  return { day: fmtDate(s, timeZone), time: end ? `${hm(s)} – ${hm(end)}` : hm(s) };
}

export const shortWhen = (e: Pick<Event, 'startDate' | 'timezone'>) =>
  e.startDate ? fmtWhen(e.startDate, e.timezone) : 'Date to be announced';

export const placeLabel = (e: Event) => (e.mode === 'VIRTUAL' ? 'Online' : [e.venue || 'Venue to be announced', e.state].filter(Boolean).join(', '));

/** Live first, then the soonest, with the viewer's school ahead; ended events last, newest first. */
export function sortEvents(events: Event[], school = '', now = Date.now()) {
  const rank: Record<EventPhase, number> = { LIVE: 0, BEFORE: 1, AFTER: 2, CANCELLED: 3 };
  const mine = (e: Event) => (school && (e.community.school ?? '').trim().toLowerCase() === school.trim().toLowerCase() ? 0 : 1);
  return [...events].sort((a, b) => {
    const pa = phaseOf(a, now); const pb = phaseOf(b, now);
    if (rank[pa] !== rank[pb]) return rank[pa] - rank[pb];
    if (pa !== 'AFTER' && mine(a) !== mine(b)) return mine(a) - mine(b);
    const ta = t(a.startDate) || Infinity; const tb = t(b.startDate) || Infinity;
    return pa === 'AFTER' ? tb - ta : ta - tb;
  });
}

/** Every local calendar day an event touches (capped), for calendar dots and day filtering. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function daysOf(e: Event) {
  if (!e.startDate) return [];
  const s = new Date(e.startDate); const end = e.endDate ? new Date(e.endDate) : s;
  const out: string[] = [];
  for (let d = new Date(s.getFullYear(), s.getMonth(), s.getDate()); d <= end && out.length < 31; d.setDate(d.getDate() + 1)) out.push(dayKey(d));
  return out.length ? out : [dayKey(s)];
}

/** Each event type has its own colour and cover pattern. */
export const TYPE_STYLE: Record<string, { label: string; bg: string; fg: string; accent: string; pattern: 'rings' | 'dots' | 'stripes' | 'grid' | 'waves' | 'burst' }> = {
  WORKSHOP: { label: 'Workshop', bg: '#FFC233', fg: '#111714', accent: '#F2603A', pattern: 'rings' },
  SEMINAR: { label: 'Seminar', bg: '#163A2D', fg: '#FAFAF7', accent: '#2FBF7F', pattern: 'grid' },
  MEETUP: { label: 'Meetup', bg: '#F2603A', fg: '#111714', accent: '#FFC233', pattern: 'dots' },
  SOCIAL: { label: 'Social', bg: '#C9A2FF', fg: '#111714', accent: '#F2603A', pattern: 'waves' },
  CONFERENCE: { label: 'Conference', bg: '#0A7A50', fg: '#FAFAF7', accent: '#FFC233', pattern: 'burst' },
  CAREER_FAIR: { label: 'Career fair', bg: '#1D3B8B', fg: '#FAFAF7', accent: '#FFC233', pattern: 'stripes' },
  HACKATHON: { label: 'Hackathon', bg: '#111714', fg: '#FAFAF7', accent: '#2FBF7F', pattern: 'grid' },
  TRAINING: { label: 'Training', bg: '#E3F4EA', fg: '#0A7A50', accent: '#0A7A50', pattern: 'stripes' },
  BOOTCAMP: { label: 'Bootcamp', bg: '#FFD9CC', fg: '#111714', accent: '#F2603A', pattern: 'burst' },
};
export const typeStyle = (type: string) => TYPE_STYLE[type] ?? { label: type ? type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ') : 'Event', bg: '#E3F4EA', fg: '#0A7A50', accent: '#0A7A50', pattern: 'dots' as const };
