import type { Event, GuestList, GuestListEntry, User } from './types';
import { api, enc, mediaUrl } from './client';

export const GUEST_PAGE = 30;

type RawGuest = { id: string; name: string; username: string; avatar: string; school: string; department: string; level: string; checkedIn: boolean; attended: boolean; isYou: boolean; hidden?: boolean };
type RawGuests = { count: number; checkedIn: number; finalized: boolean; listVisible: boolean; guests: RawGuest[]; more: number };
export type LoadedGuestList = GuestList & { listVisible: boolean; more: number };

const norm = (s?: string) => (s ?? '').trim().toLowerCase();

/** Before the real list arrives: the event's own counts, nobody named yet. */
export function emptyGuestList(event: Event): LoadedGuestList {
  // Until the organizer finalizes, the only honest number is how many registered.
  return { finalized: event.finalized, count: event.finalized ? event.attendedCount : event.goingCount, checkedIn: event.checkedInCount, entries: [], highlights: { department: 0, level: 0, attendedWithBefore: 0 }, preview: false, listVisible: true, more: 0 };
}

/**
 * Who's going (or attended). REAL: the backend applies every rule: the organizer's switch, each
 * student's choice (everyone / department only / hidden), private profiles. Hidden people are
 * counted, never named. Hosts get everyone, with the people other students cannot see marked hidden.
 */
export async function fetchGuestList(event: Event, viewer: User | null): Promise<LoadedGuestList> {
  const r = await api<RawGuests>(`/api/events/${enc(event.id)}/guests`);
  const entries: GuestListEntry[] = r.guests.map((g) => ({
    id: g.id, name: g.isYou ? `${g.name} (you)` : g.name, avatar: mediaUrl(g.avatar), school: g.school, department: g.department, level: g.level,
    stampCount: 0, visibility: g.hidden ? 'HIDDEN' : 'VISIBLE', checkedIn: g.checkedIn, attended: g.attended, isHost: false, joinedAt: '', topCommunities: [], eventsInCommon: 0,
  }));
  const others = entries.filter((g) => !g.name.endsWith('(you)'));
  return {
    // The API counts registrations until attendance is finalized, and finalized attendees after.
    count: r.count, finalized: r.finalized,
    checkedIn: r.checkedIn, entries, preview: false, listVisible: r.listVisible, more: r.more,
    highlights: {
      department: viewer?.department ? others.filter((g) => norm(g.department) === norm(viewer.department) && norm(g.school) === norm(viewer.school)).length : 0,
      level: viewer?.level ? others.filter((g) => norm(g.level) === norm(viewer.level) && norm(g.school) === norm(viewer.school)).length : 0,
      attendedWithBefore: 0,
    },
  };
}

