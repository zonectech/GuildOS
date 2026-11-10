/**
 * Communities: listing, the community page, joining, and management. Real endpoints throughout
 * (the platform's existing community API). Role names map to the brief's roles:
 * Owner = FOUNDER, Admin = PRESIDENT / VICE_PRESIDENT, Helper = VOLUNTEER, everyone else is a Member.
 */
import { api, enc, mediaUrl } from './client';

export type CommunityRole = 'OWNER' | 'ADMIN' | 'HELPER' | 'MEMBER';
export const ROLE_LABEL: Record<CommunityRole, string> = { OWNER: 'Owner', ADMIN: 'Admin', HELPER: 'Helper', MEMBER: 'Member' };

/** Backend role → the brief's role. Officers below Vice President still count as Admins for display. */
export function roleOf(raw?: string | null): CommunityRole {
  if (raw === 'FOUNDER') return 'OWNER';
  if (raw && ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'TREASURER', 'ORGANIZER', 'COORDINATOR'].includes(raw)) return 'ADMIN';
  if (raw === 'VOLUNTEER') return 'HELPER';
  return 'MEMBER';
}
/** The backend role used when someone is given a role here. */
export const RAW_ROLE: Record<Exclude<CommunityRole, 'OWNER'>, string> = { ADMIN: 'VICE_PRESIDENT', HELPER: 'VOLUNTEER', MEMBER: 'MEMBER' };
const MANAGE = ['FOUNDER', 'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'TREASURER', 'ORGANIZER', 'COORDINATOR'];
export const canManage = (raw?: string | null) => Boolean(raw && MANAGE.includes(raw));
/** Changing roles and removing members needs Vice President or above (the backend's rule). */
export const canChangeRoles = (raw?: string | null) => raw === 'FOUNDER' || raw === 'PRESIDENT' || raw === 'VICE_PRESIDENT';

/** Preset accent colours (same in light and dark; white text reads on all of them). */
export const ACCENTS = { green: '#0A7A50', coral: '#D9502C', gold: '#B07800', blue: '#2563C9', purple: '#7A4CD9', ink: '#25302A' } as const;
export type Accent = keyof typeof ACCENTS;

export interface CommunityCard {
  id: string; slug: string; name: string; summary: string; description: string; logo: string; cover: string;
  category: string; school: string; verified: boolean; memberCount: number; eventCount: number;
  visibility: 'PUBLIC' | 'PRIVATE'; autoApprove: boolean; chatLinks: { platform: string; url: string; label?: string }[]; createdAt: string; rules: string[];
  accent: Accent; socials: { instagram: string; x: string };
  /** How team replies are signed for students. */
  replyIdentity: 'NAME_AND_TITLE' | 'TITLE_ONLY';
}

type RawCommunity = {
  _id: string; slug: string; name: string; shortDescription?: string; description?: string; logo?: string; coverImage?: string; category?: string;
  university?: string; verificationStatus?: string; memberCount?: number; eventCount?: number; visibility?: 'PUBLIC' | 'PRIVATE'; autoApprove?: boolean;
  chatLinks?: { platform: string; url: string; label?: string }[]; whatsappLink?: string; createdAt?: string; rules?: string[];
  accentColor?: string; socialLinks?: { instagram?: string; x?: string }; replyIdentity?: 'NAME_AND_TITLE' | 'TITLE_ONLY';
};
export const toCommunity = (c: RawCommunity): CommunityCard => ({
  id: c._id, slug: c.slug, name: c.name, summary: c.shortDescription ?? '', description: c.description ?? '', logo: mediaUrl(c.logo), cover: mediaUrl(c.coverImage),
  category: c.category ?? '', school: c.university ?? '', verified: c.verificationStatus === 'VERIFIED', memberCount: c.memberCount ?? 0, eventCount: c.eventCount ?? 0,
  visibility: c.visibility ?? 'PUBLIC', autoApprove: c.autoApprove !== false,
  chatLinks: c.chatLinks?.length ? c.chatLinks : c.whatsappLink ? [{ platform: 'WHATSAPP', url: c.whatsappLink }] : [], createdAt: c.createdAt ?? '', rules: c.rules ?? [],
  accent: (c.accentColor && c.accentColor in ACCENTS ? c.accentColor : 'green') as Accent,
  socials: { instagram: c.socialLinks?.instagram ?? '', x: c.socialLinks?.x ?? '' },
  replyIdentity: c.replyIdentity ?? 'NAME_AND_TITLE',
});

export const listCommunities = () => api<{ communities: RawCommunity[] }>('/api/communities').then((r) => r.communities.map(toCommunity));
export const suggestedCommunities = () => api<{ communities: (RawCommunity & { reason?: string })[] }>('/api/communities/suggested')
  .then((r) => r.communities.map((c) => ({ ...toCommunity(c), reason: c.reason ?? '' })));

export interface MyMembership { membershipId: string; role: string; communityId: string; slug: string; name: string; logo: string }
/** Memberships, fetched once per visit per person (the shell, passport and pages all ask). */
const MEMBERSHIPS = new Map<string, { at: number; p: Promise<MyMembership[]> }>();
export function myMemberships(userId: string): Promise<MyMembership[]> {
  const hit = MEMBERSHIPS.get(userId);
  if (hit && Date.now() - hit.at < 60_000) return hit.p;
  const p = fetchMemberships(userId);
  MEMBERSHIPS.set(userId, { at: Date.now(), p });
  p.catch(() => MEMBERSHIPS.delete(userId));
  return p;
}
/** Forget cached memberships (after joining, leaving or a role change). */
export const forgetMemberships = () => MEMBERSHIPS.clear();
const fetchMemberships = (userId: string) => api<{ memberships: { membershipId: string; role: string; status: string; community: { id: string; slug: string; name?: string; logo?: string } | null }[] }>(`/api/users/${enc(userId)}/memberships`)
  .then((r): MyMembership[] => r.memberships.filter((m) => m.status === 'ACTIVE' && m.community).map((m) => ({ membershipId: m.membershipId, role: m.role, communityId: m.community!.id, slug: m.community!.slug, name: m.community!.name ?? 'Community', logo: mediaUrl(m.community!.logo) })));

export interface JoinRequest { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; requestedAt: string; user: { id: string; fullName: string; avatar: string } | null }
export interface CommunityPage {
  community: CommunityCard;
  viewerRole: string | null;
  viewerRequest: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  joinRequests: JoinRequest[];
}
type RawContext = { community: RawCommunity; viewerMembership?: { role: string } | null; viewerJoinRequest?: { status: CommunityPage['viewerRequest'] } | null; joinRequests?: { _id: string; status: JoinRequest['status']; requestedAt: string; user?: { id: string; fullName: string; profile?: { avatar?: string } } | null }[] };
export const getCommunity = (slug: string) => api<RawContext>(`/api/communities/${enc(slug)}`).then((r): CommunityPage => ({
  community: toCommunity(r.community), viewerRole: r.viewerMembership?.role ?? null, viewerRequest: r.viewerJoinRequest?.status ?? null,
  joinRequests: (r.joinRequests ?? []).map((j) => ({ id: j._id, status: j.status, requestedAt: j.requestedAt, user: j.user ? { id: j.user.id, fullName: j.user.fullName, avatar: mediaUrl(j.user.profile?.avatar) } : null })),
}));

export interface Person { id: string; membershipId: string; name: string; username: string; avatar: string; role: CommunityRole; rawRole: string; joinedAt: string | null; school: string; title: string }
type RawUser = { id: string; fullName: string; profile?: { username?: string; avatar?: string; university?: string } };
const toPerson = (membershipId: string, rawRole: string, joinedAt: string | null, u: RawUser, title = ''): Person => ({
  id: u.id, membershipId, name: u.fullName, username: u.profile?.username ?? '', avatar: mediaUrl(u.profile?.avatar), role: roleOf(rawRole), rawRole, joinedAt, school: u.profile?.university ?? '', title,
});

/** A few recent members, for the avatar stack. Public. */
export const memberPreview = (id: string) => api<{ members: { id: string; fullName: string; username: string; avatar: string }[] }>(`/api/communities/${enc(id)}/member-preview`)
  .then((r) => r.members.map((m) => ({ id: m.id, name: m.fullName, avatar: mediaUrl(m.avatar) })));
/** The public member list (hidden for private communities unless you're a member), 30 at a time. */
export const people = (id: string, opts: { q?: string; cursor?: string } = {}) =>
  api<{ items: { id: string; role: string; timestamp: string | null; user: RawUser }[]; nextCursor: string | null; total: number }>(`/api/communities/${enc(id)}/people?kind=members&limit=30${opts.q ? `&q=${enc(opts.q)}` : ''}${opts.cursor ? `&cursor=${enc(opts.cursor)}` : ''}`)
    .then((r) => ({ people: r.items.map((i) => toPerson(i.id, i.role, i.timestamp, i.user)), nextCursor: r.nextCursor, total: r.total }));

export const join = (id: string) => api<{ message: string }>(`/api/communities/${enc(id)}/join`, { method: 'POST' }).finally(forgetMemberships);
export const leave = (id: string) => api<{ message: string }>(`/api/communities/${enc(id)}/leave`, { method: 'POST' }).finally(forgetMemberships);

/* ── Management (Owner / Admin) ── */
export const members = (id: string, opts: { q?: string; role?: string; cursor?: string } = {}) =>
  api<{ members: { membership: { _id: string; role: string; joinedAt?: string; title?: string }; user: RawUser }[]; nextCursor: string | null; total: number }>(
    `/api/communities/${enc(id)}/members?limit=50${opts.q ? `&q=${enc(opts.q)}` : ''}${opts.role ? `&role=${enc(opts.role)}` : ''}${opts.cursor ? `&cursor=${enc(opts.cursor)}` : ''}`,
  ).then((r) => ({ people: r.members.map((m) => toPerson(m.membership._id, m.membership.role, m.membership.joinedAt ?? null, m.user, m.membership.title ?? '')), nextCursor: r.nextCursor, total: r.total }));
export const answerRequest = (id: string, requestId: string, approve: boolean) =>
  api(`/api/communities/${enc(id)}/join-requests/${enc(requestId)}/${approve ? 'approve' : 'reject'}`, { method: 'PATCH', body: '{}' });
export const setRole = (id: string, membershipId: string, role: Exclude<CommunityRole, 'OWNER'>) =>
  api(`/api/communities/${enc(id)}/members/${enc(membershipId)}/role`, { method: 'PATCH', body: JSON.stringify({ role: RAW_ROLE[role] }) });
export const removeMember = (membershipId: string) => api(`/api/memberships/${enc(membershipId)}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'REMOVED' }) });
export const transferOwnership = (id: string, membershipId: string) => { forgetMemberships(); return api(`/api/communities/${enc(id)}/ownership`, { method: 'PATCH', body: JSON.stringify({ memberId: membershipId }) }); };

export interface MemberAnalytics { totalMembers: number; newLast30Days: number; joinsByMonth: { month: string; count: number }[] }
export const analytics = (id: string) => api<{ analytics: MemberAnalytics }>(`/api/communities/${enc(id)}/member-analytics`).then((r) => r.analytics);
export const ratings = (id: string) => api<{ averageRating: number; totalRatings: number }>(`/api/communities/${enc(id)}/feedback-insights`).catch(() => null);

/** Preset team titles; the Owner can also type a custom one. */
export const TEAM_TITLES = ['President', 'Vice President', 'General Secretary', 'Publicity Secretary', 'Event Coordinator', 'Treasurer'];
/** Owner only: a team member's title ('' clears it). */
export const setTitle = (id: string, membershipId: string, title: string) => api(`/api/communities/${enc(id)}/members/${enc(membershipId)}/title`, { method: 'PATCH', body: JSON.stringify({ title }) });

export interface CommunityPatch { replyIdentity?: 'NAME_AND_TITLE' | 'TITLE_ONLY'; name?: string; shortDescription?: string; description?: string; logo?: string; coverImage?: string; autoApprove?: boolean; visibility?: 'PUBLIC' | 'PRIVATE'; chatLinks?: { platform: string; url: string }[]; rules?: string[]; accentColor?: Accent; socialLinks?: { instagram: string; x: string } }
export const updateCommunity = (id: string, patch: CommunityPatch) => api<{ community: RawCommunity }>(`/api/communities/${enc(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => toCommunity(r.community));
