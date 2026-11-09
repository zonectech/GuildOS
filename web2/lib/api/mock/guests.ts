/**
 * MOCK: sample guest-list people.
 *
 * The backend does not expose who is going to an event (only organizers can see registrations), and it
 * does not store department or level yet. Until it does, the guest list shows these clearly-labelled
 * placeholders, sized to the REAL counts (going, checked in, attended). Replace getGuestPeople() in
 * lib/api/guests.ts with a real endpoint; nothing in components needs to change.
 */
import type { GuestListEntry, GuestVisibility } from '../types';

const FIRST = ['Ada', 'Tobi', 'Kemi', 'Musa', 'Zainab', 'Chidi', 'Ife', 'Bola', 'Amaka', 'Sani', 'Funmi', 'Emeka', 'Hauwa', 'Dayo', 'Ngozi', 'Yusuf', 'Tunde', 'Halima', 'Obi', 'Lara'];
const LAST = 'ABCDEFGHIJKLMNOPRSTUWY'.split('');

export const SAMPLE_DEPARTMENTS = ['Department A', 'Department B', 'Department C', 'Department D', 'Department E'];
export const SAMPLE_LEVELS = ['100L', '200L', '300L', '400L', '500L'];
/** The signed-in student's own (sample) department and level, for the "from your department" highlights. */
export const VIEWER_SAMPLE = { department: 'Department A', level: '300L' };

// Small, seeded random numbers so the same event always shows the same sample people.
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

export function sampleGuest(eventId: string, index: number, school: string): GuestListEntry {
  const rnd = seeded(`${eventId}:${index}`);
  const roll = rnd();
  const visibility: GuestVisibility = roll < 0.08 ? 'HIDDEN' : roll < 0.2 ? 'DEPARTMENT_ONLY' : 'VISIBLE';
  const department = SAMPLE_DEPARTMENTS[Math.floor(rnd() * SAMPLE_DEPARTMENTS.length)];
  return {
    id: `${eventId}-g${index}`,
    // A first name and last initial, so avatars show initials (never an ID). Labelled "Sample guests" on screen.
    name: `${FIRST[(index * 7 + Math.floor(rnd() * FIRST.length)) % FIRST.length]} ${LAST[Math.floor(rnd() * LAST.length)]}.`,
    avatar: '',
    school: school || 'School (placeholder)',
    department,
    level: SAMPLE_LEVELS[Math.floor(rnd() * SAMPLE_LEVELS.length)],
    stampCount: Math.floor(rnd() * rnd() * 40),
    visibility,
    checkedIn: false,
    attended: false,
    isHost: false,
    joinedAt: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(),
    topCommunities: ['Community (placeholder)'],
    eventsInCommon: Math.floor(rnd() * 4),
  };
}

export function sampleHosts(eventId: string, communityName: string): GuestListEntry[] {
  return [0, 1].map((i) => ({
    ...sampleGuest(`${eventId}-host`, i, ''),
    id: `${eventId}-h${i}`, name: ['Lead organizer', 'Co-organizer'][i], visibility: 'VISIBLE' as const, isHost: true,
    topCommunities: [communityName],
  }));
}
