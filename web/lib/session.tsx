'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getProfile, refreshSession, type User } from './api';

type Session = { user: User | null; loading: boolean; setUser: (user: User | null) => void; reload: () => Promise<void> };
const SessionContext = createContext<Session>({ user: null, loading: true, setUser: () => undefined, reload: async () => undefined });

/** Who is signed in, checked once per page load. An expired access token is refreshed before giving up. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setUser((await getProfile()).user);
    } catch {
      try {
        setUser((await refreshSession()).user);
      } catch {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return <SessionContext.Provider value={{ user, loading, setUser, reload }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
