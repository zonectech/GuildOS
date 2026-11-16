import type { Event } from './api/types';

export type DiscoveryCollection = 'all' | 'school' | 'beginners' | 'online';
export const COLLECTION_LABELS: Record<DiscoveryCollection, string> = {
  all: 'All events', school: 'From your school, next 7 days', beginners: 'Free for beginners', online: 'Join online',
};
export const schoolKey = (value: string) => value.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();

export function beginnerFriendly(event: Event) {
  const text = `${event.title} ${event.summary} ${event.description}`;
  if (/\b(?:not (?:suitable )?for beginners|not beginner[- ]friendly|advanced only|(?<!no )prior (?:coding )?experience (?:is )?required)\b/i.test(text)) return false;
  return (event.tags ?? []).some((tag) => /^(?:beginner|beginners|beginner[- ]friendly|introductory)$/i.test(tag.trim()))
    || /\b(?:for beginners|beginner[- ]friendly|no (?:prior )?(?:coding )?(?:experience|knowledge) (?:is )?(?:needed|required)|introduction to|intro to)\b/i.test(text);
}

/** Collections use public catalog records and explicit metadata; no invented picks or availability. */
export function discoveryCollections(events: Event[], school: string, now = Date.now()) {
  const upcoming = events.filter((event) => {
    const start = event.startDate ? new Date(event.startDate).getTime() : NaN;
    const end = event.endDate ? new Date(event.endDate).getTime() : NaN;
    return ['PUBLISHED', 'ANNOUNCED', 'CHECK_IN', 'CHECK_OUT'].includes(event.status) && Number.isFinite(start) && Number.isFinite(end) && end > now;
  }).sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());
  const key = schoolKey(school);
  return {
    all: events,
    school: upcoming.filter((event) => key && schoolKey(event.community.school ?? '') === key && new Date(event.startDate!).getTime() < now + 7 * 86400000),
    beginners: upcoming.filter((event) => event.free === true && !event.external && beginnerFriendly(event)),
    online: upcoming.filter((event) => event.mode === 'VIRTUAL' || event.mode === 'HYBRID'),
  } satisfies Record<DiscoveryCollection, Event[]>;
}
