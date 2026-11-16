import { api, enc, mediaUrl } from './client';
import type { Community, Event, EventDetail, Registration } from './types';

/* ── What the backend sends (only the fields we use) ── */
type RawEvent = {
  registrationQuestions?: EventDetail['registrationQuestions'];
  _id: string; slug: string; title: string; type: string; typeLabel?: string; status: Event['status']; mode: Event['mode'];
  shortDescription?: string; description?: string; bannerImage?: string; startDate: string | null; endDate: string | null; timezone?: string;
  venue?: string; state?: string; communityId: string; communityName?: string; communitySlug?: string; communityUniversity?: string; communityLogo?: string;
  registrationCount?: number; checkedInCount?: number; completedCount?: number; capacity?: number; certificateOffer?: Event['certificate'];
  cancellationReason?: string; registrationPolicy?: Event['registrationPolicy']; registrationClosed?: boolean; registrationDeadline?: string | null;
  attendanceSource?: 'GUILDOS' | 'EXTERNAL'; attendanceFinalizedAt?: string | null; finalizesAt?: string | null; partnerRegistrationUrl?: string; partnerRegistrationLabel?: string; days?: unknown[];
};
type RawRegistration = { _id: string; status: Registration['status']; qrToken: string; passCode?: string; checkInAt: string | null; checkOutAt: string | null; answers?: Registration['answers'] };
type RawDetail = {
  event: RawEvent;
  community: { id: string; name: string; slug: string; logo: string; verificationStatus: string } | null;
  viewerRegistration: RawRegistration | null;
  viewerCertificateSerial?: string | null;
  attendance?: { finalized: boolean; viewerAttended: boolean; finalizesAt?: string | null };
  viewerFeedback?: { rating: number; comment: string } | null;
  canManage: boolean;
  canScan?: boolean;
  viewerIsHelper?: boolean;
  certificateOffer: Event['certificate'];
  viewerBookmarked?: boolean;
  speakers?: { _id: string; fullName: string; title: string; organization: string; photo: string }[];
  coHosts?: { partnershipId: string; name: string; slug: string; logo: string }[];
};

function toEvent(e: RawEvent, community?: RawDetail['community']): Event {
  const host: Community = {
    id: community?.id ?? e.communityId,
    name: community?.name ?? e.communityName ?? 'Community',
    slug: community?.slug ?? e.communitySlug ?? '',
    logo: mediaUrl(community?.logo ?? e.communityLogo),
    school: e.communityUniversity,
    verified: (community?.verificationStatus ?? 'VERIFIED') === 'VERIFIED',
  };
  const external = e.attendanceSource === 'EXTERNAL' && e.partnerRegistrationUrl;
  return {
    // "Other" events show the organizer's own word for them.
    id: e._id, slug: e.slug, title: e.title, type: e.type === 'OTHER' && e.typeLabel ? e.typeLabel : e.type, status: e.status, mode: e.mode,
    summary: e.shortDescription ?? '', description: e.description ?? '', cover: mediaUrl(e.bannerImage),
    startDate: e.startDate, endDate: e.endDate, timezone: e.timezone || 'Africa/Lagos', venue: e.venue ?? '', state: e.state ?? '',
    community: host,
    goingCount: e.registrationCount ?? 0, checkedInCount: e.checkedInCount ?? 0, attendedCount: e.completedCount ?? 0, capacity: e.capacity ?? 0,
    certificate: e.certificateOffer ?? 'NONE', cancellationReason: e.cancellationReason ?? '',
    registrationPolicy: e.registrationPolicy ?? 'OPEN', registrationClosed: Boolean(e.registrationClosed), registrationDeadline: e.registrationDeadline ?? null,
    externalRegistration: external ? { url: e.partnerRegistrationUrl as string, label: e.partnerRegistrationLabel || 'the partner site' } : null,
    external: e.attendanceSource === 'EXTERNAL', finalized: Boolean(e.attendanceFinalizedAt), finalizesAt: e.finalizesAt ?? null,
    multiDay: (e.days ?? []).length > 1,
  };
}

const toRegistration = (r: RawRegistration | null): Registration | null =>
  r ? { id: r._id, status: r.status, qrToken: r.qrToken, passCode: r.passCode, checkInAt: r.checkInAt, checkOutAt: r.checkOutAt, answers: r.answers ?? [] } : null;

/* ── Real endpoints ── */
/** All public events, or one community's (including events it co-hosted). */
export async function listEvents(communityId?: string): Promise<Event[]> {
  const r = await api<{ events: RawEvent[] }>(communityId ? `/api/events?communityId=${enc(communityId)}&includeCoHosted=true` : '/api/events');
  return r.events.map((e) => toEvent(e));
}

export async function getEvent(slug: string): Promise<EventDetail> {
  const r = await api<RawDetail>(`/api/events/${enc(slug)}`);
  return {
    event: { ...toEvent(r.event, r.community), finalized: Boolean(r.attendance?.finalized ?? r.event.attendanceFinalizedAt), finalizesAt: r.attendance?.finalizesAt ?? null, certificate: r.certificateOffer ?? r.event.certificateOffer ?? 'NONE' },
    registrationQuestions: r.event.registrationQuestions ?? [],
    viewerRegistration: toRegistration(r.viewerRegistration),
    viewerCertificateSerial: r.viewerCertificateSerial ?? null,
    viewerAttended: Boolean(r.attendance?.viewerAttended),
    viewerRating: r.viewerFeedback ?? null,
    canManage: r.canManage,
    canScan: Boolean(r.canScan),
    viewerIsHelper: Boolean(r.viewerIsHelper),
    saved: Boolean(r.viewerBookmarked),
    speakers: (r.speakers ?? []).map((s) => ({ id: s._id, name: s.fullName, title: s.title, organization: s.organization, photo: mediaUrl(s.photo) })),
    coHosts: (r.coHosts ?? []).map((c) => ({ id: c.partnershipId, name: c.name, slug: c.slug, logo: mediaUrl(c.logo), verified: true })),
    contacts: ((r.event as RawEvent & { contacts?: EventDetail['contacts'] }).contacts ?? []),
  };
}

/** Every event the signed-in person can run, drafts included (across their communities and co-hosts). */
export async function hostedEvents(): Promise<Event[]> {
  const r = await api<{ events: RawEvent[] }>('/api/events/hosting');
  return r.events.map((e) => toEvent(e));
}

export async function register(eventId: string, answers: Record<string, string> = {}): Promise<Registration> {
  const r = await api<{ registration: RawRegistration }>(`/api/events/${enc(eventId)}/register`, { method: 'POST', body: JSON.stringify({ answers }) });
  return toRegistration(r.registration) as Registration;
}
export const cancelPlace = (eventId: string) => api(`/api/events/${enc(eventId)}/register`, { method: 'DELETE' });
export async function updateRegistrationAnswers(eventId: string, answers: Record<string, string>): Promise<Registration> {
  const r = await api<{ registration: RawRegistration }>(`/api/events/${enc(eventId)}/register/answers`, { method: 'PATCH', body: JSON.stringify({ answers }) });
  return toRegistration(r.registration) as Registration;
}
export const partnerOpened = (eventId: string) => api(`/api/events/${enc(eventId)}/partner-opened`, { method: 'POST', body: '{}' });
export const toggleSaved = (eventId: string) => api<{ bookmarked: boolean }>(`/api/events/${enc(eventId)}/bookmark`, { method: 'POST' });
export const rateEvent = (eventId: string, rating: number, comment = '') =>
  api<{ feedback: { rating: number; comment: string } }>(`/api/events/${enc(eventId)}/feedback`, { method: 'POST', body: JSON.stringify({ rating, comment }) });

/* ── Your lists ── */
type RawGoing = { registration: { id: string; status: string; qrToken?: string; passCode?: string; checkInAt: string | null; checkOutAt: string | null; attended?: boolean }; event: Omit<RawEvent, '_id'> & { id: string } };
/** Events you registered for, with how it went (registered, checked in, attended, missed). */
/** One of your registrations: the event, where you stand, and your pass (for showing it offline). */
export type GoingRow = { event: Event; status: string; checkInAt: string | null; attended: boolean; pass: { qrToken: string; passCode: string } | null };
export async function goingEvents(): Promise<GoingRow[]> {
  const r = await api<{ registrations: RawGoing[] }>('/api/users/me/registrations');
  return r.registrations.filter((x) => !['CANCELLED', 'REJECTED'].includes(x.registration.status))
    .map((x) => ({ event: toEvent({ ...x.event, _id: x.event.id } as RawEvent), status: x.registration.status, checkInAt: x.registration.checkInAt, attended: Boolean(x.registration.attended), pass: x.registration.qrToken ? { qrToken: x.registration.qrToken, passCode: x.registration.passCode ?? '' } : null }));
}
/** Events you saved for later. */
export async function savedEvents(): Promise<Event[]> {
  const r = await api<{ events: RawEvent[] }>('/api/events/bookmarks/mine');
  return r.events.map((e) => toEvent(e));
}
