import type { Event, EventPhase, GuestList, GuestListEntry } from './types';
import { VIEWER_SAMPLE, sampleGuest, sampleHosts } from './mock/guests';
import { phaseOf } from '@/lib/events';

export const GUEST_PAGE = 30;

/**
 * The people on an event's guest list. REAL: the counts. MOCK: the people themselves (see mock/guests.ts).
 * Hidden guests count towards the number but never appear; after the event, only people who attended are listed.
 */
function people(event: Event, phase: EventPhase): GuestListEntry[] {
  const school = event.community.school ?? '';
  const total = phase === 'AFTER' ? event.attendedCount : event.goingCount;
  const list: GuestListEntry[] = [];
  for (let i = 0; i < total; i++) {
    const g = sampleGuest(event.id, i, school);
    g.checkedIn = phase === 'LIVE' && i < event.checkedInCount;
    g.attended = phase === 'AFTER';
    list.push(g);
  }
  return list;
}

export function guestList(event: Event): GuestList {
  const phase = phaseOf(event);
  const all = people(event, phase);
  const shown = all.filter((g) => g.visibility !== 'HIDDEN');
  return {
    count: phase === 'AFTER' ? event.attendedCount : event.goingCount,
    checkedIn: event.checkedInCount,
    entries: shown,
    highlights: {
      department: shown.filter((g) => g.department === VIEWER_SAMPLE.department).length,
      level: shown.filter((g) => g.level === VIEWER_SAMPLE.level).length,
      attendedWithBefore: shown.filter((g) => g.eventsInCommon > 0).length,
    },
    preview: true,
  };
}

export const hostsOf = (event: Event) => sampleHosts(event.id, event.community.name);

/** One page of the full list, for scrolling in pages of 30. */
export function guestPage(entries: GuestListEntry[], page: number) {
  return entries.slice(0, (page + 1) * GUEST_PAGE);
}

/** How a guest is named in public: hidden guests never, department-only guests anonymously. */
export function publicName(g: GuestListEntry) {
  return g.visibility === 'DEPARTMENT_ONLY' ? `A student from ${g.department}` : g.name;
}
