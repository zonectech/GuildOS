/**
 * Profile (passport): your details, privacy, stamps, certificates, streaks and badges, attendance
 * issue reports, and the public view of anyone's profile. Real endpoints throughout.
 */
import { api, enc, mediaUrl } from './client';
import type { GuestVisibility, Stamp } from './types';
import { stampsOf } from './session';

export interface Profile {
  id: string; fullName: string; email: string; username: string; avatar: string; cover: string; bio: string;
  school: string; faculty: string; department: string; level: string; interests: string[]; skills: string[];
  /** Privacy */
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED'; showSchool: boolean; showCertificates: boolean;
  /** "Public participation history": your stamps on your public profile. Off by default. */
  showHistory: boolean;
}
type RawProfileUser = { id: string; fullName: string; email?: string; profile?: Partial<{
  username: string; avatar: string; coverImage: string; bio: string; university: string; faculty: string; department: string; level: string; interests: string[]; skills: string[];
  profileVisibility: Profile['visibility']; showUniversity: boolean; showCertificates: boolean; showTimeline: boolean;
}> };
const toProfile = (u: RawProfileUser): Profile => {
  const p = u.profile ?? {};
  return {
    id: u.id, fullName: u.fullName, email: u.email ?? '', username: p.username ?? '', avatar: mediaUrl(p.avatar), cover: mediaUrl(p.coverImage), bio: p.bio ?? '',
    school: p.university ?? '', faculty: p.faculty ?? '', department: p.department ?? '', level: p.level ?? '', interests: p.interests ?? [], skills: p.skills ?? [],
    visibility: p.profileVisibility ?? 'PUBLIC', showSchool: p.showUniversity !== false, showCertificates: p.showCertificates !== false, showHistory: p.showTimeline === true,
  };
};

export const myProfile = () => api<{ user: RawProfileUser }>('/api/profile').then((r) => toProfile(r.user));
export const publicProfile = (username: string) => api<{ user: RawProfileUser }>(`/api/profile/${enc(username)}`).then((r) => toProfile(r.user));

export type ProfilePatch = Partial<{ fullName: string; username: string; bio: string; university: string; faculty: string; department: string; level: string; interests: string[]; skills: string[] }>;
export const updateProfile = (patch: ProfilePatch) => api<{ user: RawProfileUser }>('/api/profile', { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => toProfile(r.user));
export function uploadAvatar(file: File) {
  const form = new FormData(); form.append('avatar', file);
  return api<{ user: RawProfileUser }>('/api/profile/avatar', { method: 'PATCH', body: form }).then((r) => toProfile(r.user));
}
export const updatePrivacy = (p: Partial<{ profileVisibility: Profile['visibility']; showUniversity: boolean; showCertificates: boolean; showTimeline: boolean }>) =>
  api<{ user: RawProfileUser }>('/api/profile/privacy', { method: 'PATCH', body: JSON.stringify(p) }).then((r) => toProfile(r.user));
export const guestVisibility = () => api<{ guestVisibility: GuestVisibility }>('/api/profile/me/guest-list').then((r) => r.guestVisibility);
export const setGuestVisibility = (v: GuestVisibility) => api<{ guestVisibility: GuestVisibility }>('/api/profile/me/guest-list', { method: 'PATCH', body: JSON.stringify({ guestVisibility: v }) });

export interface MyCertificate { serial: string; eventTitle: string; communityName: string; issuedAt: string; status: string; verificationUrl: string }
export const myCertificates = () => api<{ certificates: MyCertificate[] }>('/api/certificates/mine').then((r) => r.certificates);
export const certificatesOf = (username: string) => api<{ certificates: MyCertificate[] }>(`/api/profile/${enc(username)}/certificates`).then((r) => r.certificates);
export { stampsOf };

/** Your registrations, for the check-in and check-out times on each stamp's record. */
export interface MyRegistration { id: string; status: string; checkInAt: string | null; checkOutAt: string | null; event: { id: string; title: string; slug: string; startDate: string | null; status: string } }
export const myRegistrations = () => api<{ registrations: { registration: Omit<MyRegistration, 'event'>; event: MyRegistration['event'] }[] }>('/api/users/me/registrations')
  .then((r): MyRegistration[] => r.registrations.map((x) => ({ ...x.registration, event: x.event })));

/* ── Progress: streaks and badges, worked out from your stamps ── */
export const BADGES = [
  { id: 'first', need: 1, label: 'First stamp', ink: 'green' as const },
  { id: 'five', need: 5, label: '5 stamps', ink: 'green' as const },
  { id: 'ten', need: 10, label: '10 stamps', ink: 'gold' as const },
  { id: 'twentyfive', need: 25, label: '25 stamps', ink: 'coral' as const },
];
/** Events attended this calendar month, and how many months in a row you've attended at least one. */
export function streak(stamps: Stamp[], now = new Date()) {
  const attended = stamps.filter((s) => s.role === 'ATTENDED' && s.date);
  const key = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const months = new Set(attended.map((s) => key(new Date(s.date!))));
  const thisMonth = attended.filter((s) => key(new Date(s.date!)) === key(now)).length;
  // The run counts back from this month (or last month, if nothing yet this month).
  let k = months.has(key(now)) ? key(now) : key(now) - 1;
  let run = 0;
  while (months.has(k)) { run++; k--; }
  return { thisMonth, monthsInARow: run };
}
/** "Regular" badges: 5 or more stamps from the same community. */
export function regulars(stamps: Stamp[]) {
  const by = new Map<string, { name: string; slug: string; count: number }>();
  for (const s of stamps) if (s.role === 'ATTENDED' && s.communitySlug) {
    const cur = by.get(s.communitySlug) ?? { name: s.communityName, slug: s.communitySlug, count: 0 };
    cur.count++; by.set(s.communitySlug, cur);
  }
  return [...by.values()].filter((c) => c.count >= 5);
}

/* ── Attendance issue reports ── */
export interface AttendanceIssue { id: string; status: 'SENT' | 'REVIEWED'; message: string; response: string; createdAt: string; reviewedAt: string | null; event: { title: string; slug: string } | null }
export const myIssues = () => api<{ issues: { _id: string; status: AttendanceIssue['status']; message: string; response: string; createdAt: string; reviewedAt: string | null; event: { title: string; slug: string } | null }[] }>('/api/events/attendance-issues/mine')
  .then((r): AttendanceIssue[] => r.issues.map((i) => ({ id: i._id, status: i.status, message: i.message, response: i.response, createdAt: i.createdAt, reviewedAt: i.reviewedAt, event: i.event })));
export const reportIssue = (eventId: string, message: string) => api(`/api/events/${enc(eventId)}/attendance-issues`, { method: 'POST', body: JSON.stringify({ message }) });
