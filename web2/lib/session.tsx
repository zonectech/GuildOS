'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from './api/client';
import { currentUser } from './api/session';
import type { User } from './api/types';
import { ErrorState } from '@/components/ui/error-state';

type Session = {
  user: User | null;
  loading: boolean;
  /** The last check could not reach the server (offline, or the API is down). Not the same as signed out. */
  unreachable: unknown | null;
  setUser: (u: User | null) => void;
  reload: () => Promise<void>;
};
const Ctx = createContext<Session>({ user: null, loading: true, unreachable: null, setUser: () => undefined, reload: async () => undefined });

/**
 * Who is signed in. Uses the same login cookies as the current site.
 *
 * Only the server saying "not signed in" (401) signs you out here. If it can't be reached, you stay
 * as you were (still signed in, if you were), and pages say they can't reach OnTheRoll instead of
 * sending you to the sign-in page.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState<unknown | null>(null);
  const known = useRef<User | null>(null);
  const set = useCallback((u: User | null) => { known.current = u; setUser(u); }, []);
  const reload = useCallback(async () => {
    try { set(await currentUser()); setUnreachable(null); }
    catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) { set(null); setUnreachable(null); }
      else { setUnreachable(e); setUser(known.current); }
    } finally { setLoading(false); }
  }, [set]);
  useEffect(() => { void reload(); }, [reload]);
  // When the connection comes back, check again.
  useEffect(() => { const again = () => void reload(); window.addEventListener('online', again); return () => window.removeEventListener('online', again); }, [reload]);
  return <Ctx.Provider value={{ user, loading, unreachable, setUser: set, reload }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

/**
 * For pages that need a signed-in person. Sends you to sign in only when the server says you are
 * signed out. Returns what to show while there is no user: nothing while checking, or "can't reach
 * OnTheRoll · Try again" when the server could not be reached.
 */
export function useLoginGate(next: string): React.ReactNode {
  const { user, loading, unreachable, reload } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user && !unreachable) router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [loading, user, unreachable, router, next]);
  if (user || loading || !unreachable) return null;
  return <ErrorState error={unreachable} title="We can’t reach OnTheRoll" onRetry={() => void reload()} />;
}
