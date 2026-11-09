import { api, enc, mediaUrl } from './client';
import type { Stamp, User } from './types';

type RawUser = { id: string; fullName: string; email: string; role?: string; profile?: { username?: string; avatar?: string; university?: string; department?: string; level?: string } };
const toUser = (u: RawUser): User => ({
  id: u.id, fullName: u.fullName, email: u.email, username: u.profile?.username, avatar: mediaUrl(u.profile?.avatar), school: u.profile?.university, department: u.profile?.department || undefined, level: u.profile?.level || undefined,
  // The guest list choice lives on its own setting (Profile → Privacy); the default is to be listed.
  guestListVisibility: 'VISIBLE',
  role: u.role ?? 'STUDENT',
});

export async function currentUser(): Promise<User> {
  try { return toUser((await api<{ user: RawUser }>('/api/profile')).user); }
  catch { return toUser((await api<{ user: RawUser }>('/api/auth/refresh', { method: 'POST' })).user); }
}
export const signOut = () => api('/api/auth/logout', { method: 'POST' });
export const unreadCount = () => api<{ count: number }>('/api/notifications/unread-count');

type RawStamp = { role: Stamp['role']; eventId: string; eventTitle: string; eventSlug: string; startDate: string | null; attendedCount: number; certificateSerial: string | null; communityName?: string; communitySlug?: string };
export async function stampsOf(username: string): Promise<Stamp[]> {
  const r = await api<{ stamps: RawStamp[] }>(`/api/profile/${enc(username)}/attendance`);
  return r.stamps.map((s) => ({
    eventId: s.eventId, eventTitle: s.eventTitle, eventSlug: s.eventSlug, date: s.startDate, role: s.role, attendedWith: Math.max(0, (s.attendedCount ?? 1) - 1),
    certificateSerial: s.certificateSerial, communityName: s.communityName ?? '', communitySlug: s.communitySlug ?? '',
  }));
}
