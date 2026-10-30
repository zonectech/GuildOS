'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { getCurrentUser, readCachedCurrentUser, subscribeCurrentUser } from './api/auth-api';
/** Shared session snapshot: immediate reuse, deduplicated background refresh. */
export function useCurrentUser() {
 const user = useSyncExternalStore(subscribeCurrentUser, readCachedCurrentUser, () => null);
 useEffect(() => {
  const refresh = () => { void getCurrentUser(); };
  refresh();
  window.addEventListener('focus', refresh);
  return () => window.removeEventListener('focus', refresh);
 }, []);
 return user;
}
