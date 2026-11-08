'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { currentUser } from './api/session';
import type { User } from './api/types';

type Session = { user: User | null; loading: boolean; setUser: (u: User | null) => void; reload: () => Promise<void> };
const Ctx = createContext<Session>({ user: null, loading: true, setUser: () => undefined, reload: async () => undefined });

/** Who is signed in. Uses the same login cookies as the current site. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try { setUser(await currentUser()); } catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return <Ctx.Provider value={{ user, loading, setUser, reload }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
