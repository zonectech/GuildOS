/**
 * Asking to create a community, and reviewing those requests. All real endpoints: this follows the
 * platform's existing review process (a community is created PENDING, an admin verifies or rejects it,
 * and verifying it also approves the founder to run events). "More info needed" keeps it PENDING.
 */
import { api, enc, mediaUrl } from './client';

export type RequestStatus = 'IN_REVIEW' | 'MORE_INFO' | 'UPDATED' | 'APPROVED' | 'DECLINED';

export interface InfoRequest { message: string; requestedAt: string | null; response: string; respondedAt: string | null }

/** A community someone asked to create, as the applicant and the reviewer see it. */
export interface CommunityVerificationRequest {
  id: string;
  name: string;
  slug: string;
  logo: string;
  cover: string;
  school: string;
  category: string;
  summary: string;
  description: string;
  chatLinks: { platform: string; url: string }[];
  method: 'SCHOOL_EMAIL' | 'LETTER';
  letter: string;
  note: string;
  status: RequestStatus;
  submittedAt: string;
  decidedAt: string | null;
  /** The reviewer's reason (declined) or note (approved). */
  decisionNote: string;
  infoRequest: InfoRequest | null;
  founderId: string;
  applicant: { id: string; fullName: string; email: string; username: string; university: string; schoolEmail: string; schoolEmailVerified: boolean } | null;
}

export type ReviewDecision = { kind: 'APPROVE'; note?: string } | { kind: 'MORE_INFO'; message: string } | { kind: 'DECLINE'; reason: string };

type RawCommunity = {
  _id: string; name: string; slug: string; logo?: string; coverImage?: string; university?: string; category?: string;
  shortDescription?: string; description?: string; chatLinks?: { platform: string; url: string }[];
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED'; verificationMethod?: string | null; endorsementLetter?: string;
  verificationNotes?: string; verifiedAt?: string | null; createdAt: string; founder: string; requestNote?: string;
  infoRequest?: InfoRequest; applicant?: CommunityVerificationRequest['applicant'];
};

function toRequest(c: RawCommunity): CommunityVerificationRequest {
  const info = c.infoRequest?.message ? c.infoRequest : null;
  const status: RequestStatus = c.verificationStatus === 'VERIFIED' ? 'APPROVED' : c.verificationStatus === 'REJECTED' ? 'DECLINED'
    : info && info.respondedAt && (!info.requestedAt || info.respondedAt >= info.requestedAt) ? 'UPDATED' : info ? 'MORE_INFO' : 'IN_REVIEW';
  return {
    id: c._id, name: c.name, slug: c.slug, logo: mediaUrl(c.logo), cover: mediaUrl(c.coverImage), school: c.university ?? '', category: c.category ?? '',
    summary: c.shortDescription ?? '', description: c.description ?? '', chatLinks: c.chatLinks ?? [],
    method: c.verificationMethod === 'UNIVERSITY_EMAIL' ? 'SCHOOL_EMAIL' : 'LETTER', letter: mediaUrl(c.endorsementLetter), note: c.requestNote ?? '',
    status, submittedAt: c.createdAt, decidedAt: c.verificationStatus === 'VERIFIED' || c.verificationStatus === 'REJECTED' ? c.verifiedAt ?? null : null,
    decisionNote: c.verificationNotes ?? '', infoRequest: info, founderId: String(c.founder), applicant: c.applicant ?? null,
  };
}

/* ── Applicant ── */
export async function myRequests(userId: string): Promise<CommunityVerificationRequest[]> {
  const [active, history] = await Promise.all([
    api<{ communities: RawCommunity[] }>('/api/communities/managed').catch(() => ({ communities: [] })),
    api<{ communities: RawCommunity[] }>('/api/communities/managed/history').catch(() => ({ communities: [] })),
  ]);
  const seen = new Set<string>();
  return [...active.communities, ...history.communities]
    .filter((c) => String(c.founder) === userId && !seen.has(c._id) && seen.add(c._id))
    .map(toRequest)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export type SchoolProof = { email: string; verified: boolean; matchedSchool: string; selectedSchool: string; selectedMatches: boolean; profileSchool: string };
export const schoolProof = (school: string) => api<SchoolProof>(`/api/community-access/school${school ? `?university=${enc(school)}` : ''}`);
export const sendSchoolCode = (email: string) => api<{ retryAfterSeconds?: number }>('/api/community-access/email/send', { method: 'POST', body: JSON.stringify({ email }) });
export const verifySchoolCode = (code: string) => api<{ verified: boolean }>('/api/community-access/email/verify', { method: 'POST', body: JSON.stringify({ code }) });

export function uploadImages(logo: File | null, cover: File | null) {
  const form = new FormData();
  if (logo) form.append('logo', logo);
  if (cover) form.append('coverImage', cover);
  return api<{ logo: string; coverImage: string }>('/api/communities/upload', { method: 'POST', body: form });
}
export function uploadLetter(file: File) {
  const form = new FormData();
  form.append('letter', file);
  return api<{ letter: string; fileName?: string }>('/api/communities/upload/endorsement-letter', { method: 'POST', body: form });
}

export interface NewCommunity {
  name: string; school: string; category: string; summary: string; description: string; chatLink: string;
  logo: string; cover: string; method: 'SCHOOL_EMAIL' | 'LETTER'; letter: string; note: string;
}
const platformOf = (url: string) => (/whatsapp/i.test(url) ? 'WHATSAPP' : /discord/i.test(url) ? 'DISCORD' : /t\.me|telegram/i.test(url) ? 'TELEGRAM' : /slack/i.test(url) ? 'SLACK' : 'OTHER');

export async function submitCommunity(c: NewCommunity) {
  const r = await api<{ community: RawCommunity }>('/api/communities', {
    method: 'POST',
    body: JSON.stringify({
      name: c.name, shortDescription: c.summary, description: c.description, category: c.category, university: c.school,
      logo: c.logo, coverImage: c.cover, chatLinks: [{ platform: platformOf(c.chatLink), url: c.chatLink }],
      visibility: 'PUBLIC', autoApprove: true,
      verificationMethod: c.method === 'SCHOOL_EMAIL' ? 'UNIVERSITY_EMAIL' : 'MANUAL', endorsementLetter: c.letter, requestNote: c.note,
    }),
  });
  return toRequest(r.community);
}

export const answerReviewer = (id: string, input: { note: string; summary?: string; letter?: string }) =>
  api<{ community: RawCommunity }>(`/api/communities/${enc(id)}/review-response`, {
    method: 'PATCH', body: JSON.stringify({ note: input.note, shortDescription: input.summary, endorsementLetter: input.letter }),
  }).then((r) => toRequest(r.community));

/* ── Platform reviewer (admin accounts) ── */
export async function reviewQueue(): Promise<CommunityVerificationRequest[]> {
  const r = await api<{ communities: RawCommunity[] }>('/api/admin/communities/pending');
  return r.communities.map(toRequest);
}

export async function decide(id: string, d: ReviewDecision) {
  if (d.kind === 'APPROVE') return api(`/api/admin/communities/${enc(id)}/verify`, { method: 'PATCH', body: JSON.stringify({ notes: d.note ?? '' }) });
  if (d.kind === 'MORE_INFO') return api(`/api/admin/communities/${enc(id)}/request-info`, { method: 'PATCH', body: JSON.stringify({ message: d.message }) });
  return api(`/api/admin/communities/${enc(id)}/reject`, { method: 'PATCH', body: JSON.stringify({ notes: d.reason }) });
}
