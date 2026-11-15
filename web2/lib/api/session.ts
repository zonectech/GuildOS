import { api, ApiError, enc, mediaUrl } from './client';
import type { Stamp, User } from './types';

type RawUser = { id: string; fullName: string; email: string; role?: string; emailVerified?: boolean; profileComplete?: boolean; profile?: { username?: string; avatar?: string; university?: string; department?: string; level?: string } };
const toUser = (u: RawUser): User => ({
  id: u.id, fullName: u.fullName, email: u.email, username: u.profile?.username, avatar: mediaUrl(u.profile?.avatar), school: u.profile?.university, department: u.profile?.department || undefined, level: u.profile?.level || undefined,
  // The guest list choice lives on its own setting (Profile → Privacy); the default is to be listed.
  guestListVisibility: 'VISIBLE',
  role: u.role ?? 'STUDENT',
  onboarded: u.profileComplete !== false,
  emailVerified: u.emailVerified !== false,
});

/**
 * The signed-in person, or null for a visitor. One request: the API answers "nobody" with 200 and
 * renews an expired session itself, so a visitor's console shows no errors. Network and server
 * failures are passed on (the session keeps whoever was signed in).
 */
export async function currentUser(): Promise<User | null> {
  try {
    const r = await api<{ user: RawUser | null }>('/api/auth/session');
    return r.user ? toUser(r.user) : null;
  } catch (e) {
    // An API from before /api/auth/session: ask the old way (a 401 means signed out).
    if (!(e instanceof ApiError && e.status === 404)) throw e;
    try { return toUser((await api<{ user: RawUser }>('/api/profile')).user); }
    catch (old) {
      if (!(old instanceof ApiError && old.status === 401)) throw old;
      return toUser((await api<{ user: RawUser }>('/api/auth/refresh', { method: 'POST' })).user);
    }
  }
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
type EmailPreferences = { newEventEmailEnabled: boolean; recommendationEmailEnabled: boolean };
export const emailPrefs = () => api<EmailPreferences>('/api/notifications/preferences');
export const setRecommendationEmailPrefs = (on: boolean) => api<EmailPreferences>('/api/notifications/preferences', { method:'PATCH', body:JSON.stringify({recommendationEmailEnabled:on}) });
export const setEmailPrefs = (on: boolean) => api<{ newEventEmailEnabled: boolean }>('/api/notifications/preferences', { method: 'PATCH', body: JSON.stringify({ newEventEmailEnabled: on }) });

/** Pages web2 has. */
const WEB2 = [/^\/events(\/|$|\?)/, /^\/communities(\/|$|\?)/, /^\/(me|u|certificates|notifications|review|login|signup|inbox|onboarding|feedback|scan)(\/|$|\?)/, /^\/cv\/verify\/[^/?#]+/];
export const isWeb2Path = (p: string) => WEB2.some((r) => r.test(p));

/**
 * Old-site links (mostly in older notifications) mapped to the same page here.
 * Returns null when web2 has no such page (wallet, admin tools other than review, recruiters,
 * opportunities, building a CV): those notifications show without a link. Nothing opens the old site.
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
  if (path === '/profile' || path.startsWith('/profile/')) return '/me';
  return null;
}

/** Where a notification's link goes here: a full address as it is, an old-site path to its web2 page, or '' (no link). */
export const linkHere = (link: string) => (!link ? '' : /^https?:\/\//.test(link) ? link : web2LinkFor(link) ?? '');
