/**
 * The one date/time format for the whole site: "Tue, 10 Nov · 5:15 PM".
 * Events use their own timezone (default Africa/Lagos); everything else uses Lagos time.
 * Years only appear when the date isn't in the current year ("Tue, 10 Nov 2025").
 */
export const LAGOS = 'Africa/Lagos';
const safeZone = (tz?: string | null) => { try { new Intl.DateTimeFormat('en-GB', { timeZone: tz || LAGOS }); return tz || LAGOS; } catch { return LAGOS; } };
const valid = (v?: string | Date | null) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const part = (d: Date, tz: string, opts: Intl.DateTimeFormatOptions, type: Intl.DateTimeFormatPartTypes) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).formatToParts(d).find((p) => p.type === type)?.value ?? '';

/** "Tue, 10 Nov" (plus the year when it isn't this year). */
export function fmtDate(v?: string | Date | null, tz?: string | null, opts: { weekday?: boolean; year?: boolean } = {}) {
  const d = valid(v); if (!d) return '';
  const z = safeZone(tz);
  const wd = opts.weekday === false ? '' : `${part(d, z, { weekday: 'short' }, 'weekday')}, `;
  const day = part(d, z, { day: 'numeric' }, 'day');
  const month = part(d, z, { month: 'short' }, 'month').slice(0, 3);
  const year = part(d, z, { year: 'numeric' }, 'year');
  const showYear = opts.year ?? year !== part(new Date(), z, { year: 'numeric' }, 'year');
  return `${wd}${day} ${month}${showYear ? ` ${year}` : ''}`;
}

/** "5:15 PM". */
export function fmtTime(v?: string | Date | null, tz?: string | null) {
  const d = valid(v); if (!d) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: safeZone(tz), hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
}

/** "Tue, 10 Nov · 5:15 PM". */
export function fmtWhen(v?: string | Date | null, tz?: string | null) {
  const d = valid(v); if (!d) return '';
  return `${fmtDate(d, tz)} · ${fmtTime(d, tz)}`;
}

/** "5:15 PM – 7:00 PM" (one day), for event times. */
export const fmtTimeRange = (start?: string | null, end?: string | null, tz?: string | null) => (end ? `${fmtTime(start, tz)} – ${fmtTime(end, tz)}` : fmtTime(start, tz));

/** Short relative time for lists: "just now", "5 min ago", "3 h ago", then the date. */
export function fmtAgo(v?: string | Date | null) {
  const d = valid(v); if (!d) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDate(d, null, { weekday: false });
}

/** The calendar day key in a timezone ("2026-11-10"), for grouping. */
export const dayKeyIn = (v: string | Date, tz?: string | null) => new Date(v).toLocaleDateString('en-CA', { timeZone: safeZone(tz) });
