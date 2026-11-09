import { api, enc, mediaUrl } from './client';
import type { Stamp, User } from './types';

type RawUser = { id: string; fullName: string; email: string; role?: string; profile?: { username?: string; avatar?: string; university?: string } };
const toUser = (u: RawUser): User => ({
  id: u.id, fullName: u.fullName, email: u.email, username: u.profile?.username, avatar: mediaUrl(u.profile?.avatar), school: u.profile?.university,
  // The backend has no guest-list setting yet; the default is to show name and photo.
  guestListVisibility: 'VISIBLE',
  role: u.role ?? 'STUDENT',
});

export async function currentUser(): Promise<User> {
  try { return toUser((await api<{ user: RawUser }>('/api/profile')).user); }
  catch { return toUser((await api<{ user: RawUser }>('/api/auth/refresh', { method: 'POST' })).user); }
}
export const signOut = () => api('/api/auth/logout', { method: 'POST' });
export const unreadCount = () => api<{ count: number }>('/api/notifications/unread-count');

type RawStamp = { role: Stamp['role']; eventId: string; eventTitle: string; eventSlug: string; startDate: string | null; attendedCount: number; certificateSerial: string | null };
export async function stampsOf(username: string): Promise<Stamp[]> {
  const r = await api<{ stamps: RawStamp[] }>(`/api/profile/${enc(username)}/attendance`);
  return r.stamps.map((s) => ({ eventId: s.eventId, eventTitle: s.eventTitle, eventSlug: s.eventSlug, date: s.startDate, role: s.role, attendedWith: Math.max(0, (s.attendedCount ?? 1) - 1), certificateSerial: s.certificateSerial }));
}
