// What a signed-in student needs with no connection: who they are, their passes and their Going list.
// Kept in this browser's storage, one entry per account, written only while signed in and wiped on
// log-out (and when the server says the session has ended). Nothing here is ever kept for a visitor.
// The door's attendee lists live in lib/door.ts and follow the same rules.
import type { User } from './api/types';
import type { GoingRow } from './api/events';

const USER_KEY = 'otr-user';
const PREFIX = 'otr-offline:';

type Saved = { going: GoingRow[] | null; savedAt: string | null };

const read = <T,>(key: string, fallback: T): T => { try { return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback; } catch { return fallback; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: offline copies are a convenience */ } };

/** The signed-in person, so pages still know who you are when the server can't be reached. */
export const rememberUser = (u: User) => write(USER_KEY, u);
export const rememberedUser = (): User | null => read<User | null>(USER_KEY, null);

/** Your Going list (with the passes it carries), as last loaded. */
export function saveGoing(userId: string, going: GoingRow[]) {
  write(PREFIX + userId, { going, savedAt: new Date().toISOString() } satisfies Saved);
}
export function savedGoing(userId: string): Saved {
  return read<Saved>(PREFIX + userId, { going: null, savedAt: null });
}
/** Your saved pass for one event, if you hold a place. */
export function savedPass(userId: string, slug: string): GoingRow | null {
  const row = savedGoing(userId).going?.find((r) => r.event.slug === slug);
  return row?.pass ? row : null;
}

/** Removes everything above from this device (log-out, or the session ended). */
export function clearOffline() {
  try {
    for (const k of Object.keys(localStorage)) if (k === USER_KEY || k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch { /* storage blocked: nothing was saved */ }
  // Saved pages are public, but a shared phone shouldn't keep a trail of what you opened either.
  try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PAGES' }); } catch { /* no service worker */ }
}

/** True when the request never reached the server (as opposed to the server saying no). */
export const isOffline = (e: unknown) => typeof e === 'object' && e !== null && (e as { status?: number }).status === 0;
