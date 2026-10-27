import type { EventSummary } from '../../../components/guildos/event-api';

export const MODE_LABEL: Record<string, string> = { PHYSICAL: 'In person', HYBRID: 'Hybrid', VIRTUAL: 'Online' };

/** Hands-on learning events grouped under one filter. */
export const LEARNING_TYPES = ['WORKSHOP', 'TRAINING', 'BOOTCAMP'];

/** Lowest price a buyer can pay to get in (0 = free event). */
export function entryPriceOf(event: EventSummary): number {
  const tiers = (event.ticketTiers ?? []).map((t) => t.price);
  if (tiers.length) return Math.min(...tiers);
  return event.ticketPrice ?? 0;
}

export function priceLabel(event: EventSummary) {
  const price = entryPriceOf(event);
  return price === 0 ? 'FREE' : `₦${price.toLocaleString('en-NG')}${(event.ticketTiers ?? []).length > 1 ? '+' : ''}`;
}

/**
 * Student-facing lifecycle bucket:
 *  - LIVE       doors open right now (CHECK_IN / CHECK_OUT)
 *  - UPCOMING   published and still ahead — the ones you can register for
 *  - ENDED      finished (COMPLETED, archived-after-completion, or date passed)
 *  - CANCELLED  organizer cancelled it (reason shown on the event page)
 */
export type EventBucket = 'LIVE' | 'UPCOMING' | 'ENDED' | 'CANCELLED';

export function bucketOf(event: EventSummary): EventBucket {
  if (event.status === 'ARCHIVED' && event.cancellationReason) return 'CANCELLED';
  if (event.status === 'CHECK_IN' || event.status === 'CHECK_OUT') return 'LIVE';
  if (event.status === 'COMPLETED' || event.status === 'ARCHIVED') return 'ENDED';
  // Postponed events are waiting on a NEW date — the old date passing doesn't end them.
  if (event.status === 'POSTPONED') return 'UPCOMING';
  // PUBLISHED but the end date already passed = effectively over (finalizer will catch up).
  if (event.endDate && new Date(event.endDate).getTime() < Date.now()) return 'ENDED';
  return 'UPCOMING';
}

export function typeLabel(t: string) {
  return t === 'All' ? 'All' : t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function dateBadge(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return { day: d.getDate(), month: d.toLocaleString('en-NG', { month: 'short' }) };
}

function relativeHint(d: Date) {
  const today = new Date();
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000,
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff <= 30) return `In ${diff} days`;
  return '';
}

export function whenLabel(value: string | null) {
  if (!value) return 'Date TBA';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date TBA';
  const base = `${d.toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const hint = relativeHint(d);
  return hint ? `${base} · ${hint}` : base;
}

export function placeLabel(event: EventSummary) {
  return event.mode === 'VIRTUAL' ? 'Online event' : [event.venue || 'Venue TBA', event.state].filter(Boolean).join(' · ');
}

/**
 * Featured: live events first, then the most-registered upcoming events in the next 30 days,
 * with the viewer's university breaking ties. Only events with a banner — it's a showcase row.
 */
export function pickFeatured(events: EventSummary[], myUniversity: string, limit = 3) {
  const uni = myUniversity.toLowerCase();
  const horizon = Date.now() + 30 * 86400000;
  return events
    .filter((e) => e.bannerImage)
    .filter((e) => {
      const bucket = bucketOf(e);
      if (bucket === 'LIVE') return true;
      return bucket === 'UPCOMING' && e.status !== 'ANNOUNCED' && Boolean(e.startDate) && new Date(e.startDate!).getTime() <= horizon;
    })
    .sort((a, b) => {
      const live = Number(bucketOf(b) === 'LIVE') - Number(bucketOf(a) === 'LIVE');
      if (live) return live;
      if (b.registrationCount !== a.registrationCount) return b.registrationCount - a.registrationCount;
      const mine = (e: EventSummary) => Number(Boolean(uni) && (e.communityUniversity ?? '').trim().toLowerCase() === uni);
      return mine(b) - mine(a);
    })
    .slice(0, limit);
}

/** Prefer shared topics and format without excluding the rest of discovery. */
export function similarEventScore(event: EventSummary, source: EventSummary): number {
  const normalize = (s: string) => s.trim().toLowerCase();
  const topics = new Set((source.tags ?? []).map(normalize).filter(Boolean));
  const shared = new Set((event.tags ?? []).map(normalize).filter(t => topics.has(t))).size;
  return Math.min(shared, 5) * 4
    + (event.type === source.type ? 8 : 0)
    + (event.communityId === source.communityId ? 4 : 0)
    + (source.communityUniversity && normalize(event.communityUniversity ?? '') === normalize(source.communityUniversity) ? 3 : 0)
    + (event.mode === source.mode ? 1 : 0);
}
