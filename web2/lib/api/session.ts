import { api, enc, mediaUrl } from './client';
import type { Stamp, User } from './types';

type RawUser = { id: string; fullName: string; email: string; role?: string; profileComplete?: boolean; profile?: { username?: string; avatar?: string; university?: string; department?: string; level?: string } };
const toUser = (u: RawUser): User => ({
  id: u.id, fullName: u.fullName, email: u.email, username: u.profile?.username, avatar: mediaUrl(u.profile?.avatar), school: u.profile?.university, department: u.profile?.department || undefined, level: u.profile?.level || undefined,
  // The guest list choice lives on its own setting (Profile → Privacy); the default is to be listed.
  guestListVisibility: 'VISIBLE',
  role: u.role ?? 'STUDENT',
  onboarded: u.profileComplete !== false,
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

/* ── Notifications ── */
export type NoticeCategory = 'EVENT_UPDATE' | 'REMINDER' | 'REGISTRATION' | 'STAMP' | 'CERTIFICATE' | 'COMMUNITY' | 'ORGANIZER' | 'MESSAGE' | 'OTHER';
export interface Notice { id: string; type: string; category: NoticeCategory; eventSlug: string; eventStart: string | null; eventTimezone: string | null; title: string; body: string; link: string; read: boolean; createdAt: string; actor: { fullName: string; avatar: string } | null }
type RawNotice = Omit<Notice, 'actor'> & { actor: { fullName: string; avatar: string } | null };
export const notifications = (before?: string) => api<{ notifications: RawNotice[]; nextCursor: string | null }>(`/api/notifications?limit=30${before ? `&before=${enc(before)}` : ''}`)
  .then((r) => ({ items: r.notifications.map((n): Notice => ({ ...n, actor: n.actor ? { ...n.actor, avatar: mediaUrl(n.actor.avatar) } : null })), next: r.nextCursor }));
export const markRead = (id: string) => api(`/api/notifications/${enc(id)}/read`, { method: 'POST' });
export const markAllRead = () => api('/api/notifications/read-all', { method: 'POST' });
export const emailPrefs = () => api<{ newEventEmailEnabled: boolean }>('/api/notifications/preferences');
export const setEmailPrefs = (on: boolean) => api<{ newEventEmailEnabled: boolean }>('/api/notifications/preferences', { method: 'PATCH', body: JSON.stringify({ newEventEmailEnabled: on }) });

/** Pages web2 has. Notification links to anything else open on the current site for now. */
const WEB2 = [/^\/events(\/|$|\?)/, /^\/communities(\/|$|\?)/, /^\/(me|u|certificates|notifications|review|login|signup|inbox|onboarding|feedback)(\/|$|\?)/];
export const isWeb2Path = (p: string) => WEB2.some((r) => r.test(p));

/**
 * Old-site links (mostly in older notifications) mapped to the same page here.
 * Returns null when web2 has no equivalent yet (wallet, admin tools), so the caller opens the old site.
 */
export function web2LinkFor(link: string): string | null {
  if (isWeb2Path(link)) return link;
  const [path, query = ''] = link.split('?');
  const q = new URLSearchParams(query);
  if (path === '/dashboard/events/create' && q.get('slug')) return `/events/${q.get('slug')}/edit`;
  if (path === '/dashboard/events/create') return '/events/new';
  if (/^\/dashboard\/events(\/(attendees|scanner))?$/.test(path)) return '/events/hosting';
  if (path === '/dashboard/admin/verification') return '/review';
  if (path === '/dashboard/communities/create') return '/communities/request';
  if (path === '/dashboard/members' || path === '/dashboard/settings') return '/communities';
  if (path === '/dashboard/certificates') return '/me';
  if (path === '/dashboard' || path === '/home' || path === '/my-events') return '/events';
  if (path === '/profile-setup') return '/onboarding';
  return null;
}
