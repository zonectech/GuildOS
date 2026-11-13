import type { Event, GuestList, GuestListEntry, User } from './types';
import { api, enc, mediaUrl } from './client';
import { phaseOf } from '@/lib/events';

export const GUEST_PAGE = 30;

type RawGuest = { id: string; name: string; username: string; avatar: string; school: string; department: string; level: string; checkedIn: boolean; attended: boolean; isYou: boolean };
type RawGuests = { count: number; checkedIn: number; finalized: boolean; listVisible: boolean; guests: RawGuest[]; more: number };
export type LoadedGuestList = GuestList & { listVisible: boolean; more: number };

const norm = (s?: string) => (s ?? '').trim().toLowerCase();

/** Before the real list arrives: the event's own counts, nobody named yet. */
export function emptyGuestList(event: Event): LoadedGuestList {
  const after = phaseOf(event) === 'AFTER';
  return { count: after ? event.attendedCount : event.goingCount, checkedIn: event.checkedInCount, entries: [], highlights: { department: 0, level: 0, attendedWithBefore: 0 }, preview: false, listVisible: true, more: 0 };
}

/**
 * Who's going (or attended). REAL: the backend applies every rule: the organizer's switch, each
 * student's choice (everyone / department only / hidden), private profiles. Hidden people are
 * counted, never named.
 */
export async function fetchGuestList(event: Event, viewer: User | null): Promise<LoadedGuestList> {
  const r = await api<RawGuests>(`/api/events/${enc(event.id)}/guests`);
  const entries: GuestListEntry[] = r.guests.map((g) => ({
    id: g.id, name: g.isYou ? `${g.name} (you)` : g.name, avatar: mediaUrl(g.avatar), school: g.school, department: g.department, level: g.level,
    stampCount: 0, visibility: 'VISIBLE', checkedIn: g.checkedIn, attended: g.attended, isHost: false, joinedAt: '', topCommunities: [], eventsInCommon: 0,
  }));
  const others = entries.filter((g) => !g.name.endsWith('(you)'));
  return {
    // Event summaries drive the capacity figures across the app. Keep the
    // attendee total aligned when the guest endpoint returns fewer rows/counts.
    count: Math.max(r.count, phaseOf(event) === 'AFTER' ? event.attendedCount : event.goingCount),
    checkedIn: r.checkedIn, entries, preview: false, listVisible: r.listVisible, more: r.more,
    highlights: {
      department: viewer?.department ? others.filter((g) => norm(g.department) === norm(viewer.department) && norm(g.school) === norm(viewer.school)).length : 0,
      level: viewer?.level ? others.filter((g) => norm(g.level) === norm(viewer.level) && norm(g.school) === norm(viewer.school)).length : 0,
      attendedWithBefore: 0,
    },
  };
}

/** Hosts are shown on the event page itself (community and co-hosts), not in the guest list. */
export const hostsOf = (_event: Event): GuestListEntry[] => [];

/** One page of the full list, for scrolling in pages of 30. */
export function guestPage(entries: GuestListEntry[], page: number) {
  return entries.slice(0, (page + 1) * GUEST_PAGE);
}

/** How a guest is named in public. */
export const publicName = (g: GuestListEntry) => g.name;
