// The new website calls the same backend as the current site. Login rides on the httpOnly cookies it sets.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiError(payload.error || 'Something went wrong. Try again.', response.status);
  return payload;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function imageUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return path.startsWith('/') ? `${API_BASE_URL}${path}` : `${API_BASE_URL}/uploads/${path}`;
}

export type User = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  emailVerified: boolean;
  profileComplete: boolean;
  profile?: { username?: string; avatar?: string; university?: string; interests?: string[]; skills?: string[] };
};

export type CertificateOffer = 'INSTANT' | 'AFTER_EVENT' | 'NONE';
export type EventStatus = 'DRAFT' | 'ANNOUNCED' | 'PUBLISHED' | 'POSTPONED' | 'CHECK_IN' | 'CHECK_OUT' | 'COMPLETED' | 'ARCHIVED';

export type EventSummary = {
  _id: string;
  slug: string;
  title: string;
  type: string;
  status: EventStatus;
  mode: 'PHYSICAL' | 'HYBRID' | 'VIRTUAL';
  shortDescription?: string;
  description?: string;
  bannerImage?: string;
  startDate: string | null;
  endDate: string | null;
  timezone?: string;
  venue?: string;
  state?: string;
  communityId: string;
  communityName?: string;
  communitySlug?: string;
  communityUniversity?: string;
  registrationCount: number;
  capacity: number;
  certificateOffer?: CertificateOffer;
  cancellationReason?: string;
  attendanceFinalizedAt?: string | null;
  attendanceSource?: 'GUILDOS' | 'EXTERNAL';
  partnerRegistrationUrl?: string;
  partnerRegistrationLabel?: string;
  registrationPolicy?: 'OPEN' | 'APPROVAL' | 'INVITE';
  registrationClosed?: boolean;
  registrationDeadline?: string | null;
  tags?: string[];
  days?: { date?: string | null; theme?: string; venue?: string; startTime?: string; endTime?: string; cancelled?: boolean }[];
  sections?: { key: string; name: string; description?: string; capacity?: number; venue?: string }[];
  partners?: { name: string; logo: string; website: string }[];
  contacts?: { name: string; phone: string; email: string }[];
  checkedInCount?: number;
  completedCount?: number;
  qrEnabled?: boolean;
};

export type Registration = {
  _id: string;
  status: 'PENDING_APPROVAL' | 'CONFIRMED' | 'WAITLISTED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'COMPLETED' | 'PARTIAL_ATTENDANCE' | 'CANCELLED' | 'REJECTED' | 'NO_SHOW';
  qrToken: string;
  passCode?: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  certificateIssued: boolean;
};

export type EventDetail = {
  event: EventSummary;
  community: { id: string; name: string; slug: string; logo: string; verificationStatus: string } | null;
  viewerRegistration: Registration | null;
  viewerCertificateSerial?: string | null;
  viewerPointsAwarded?: number;
  /** Set once attendance is closed, for the people who ran the event. */
  viewerHostRole?: 'HOSTED' | 'CO_HOSTED' | null;
  /** A co-host invitation waiting for this person's community to answer. */
  viewerPartnershipInvite?: { partnershipId: string; communityName: string } | null;
  viewerHostPoints?: number;
  participation?: { going?: number };
  canManage: boolean;
  certificateOffer: CertificateOffer;
  viewerBookmarked?: boolean;
  speakers?: { _id: string; fullName: string; title: string; organization: string; photo: string; speakerType: string }[];
  coHosts?: { partnershipId: string; name: string; slug: string; logo: string }[];
};

export const listEvents = () => api<{ events: EventSummary[] }>('/api/events');
export const getEvent = (slug: string) => api<EventDetail>(`/api/events/${encodeURIComponent(slug)}`);
export const registerForEvent = (id: string) => api<{ registration: Registration }>(`/api/events/${encodeURIComponent(id)}/register`, { method: 'POST', body: '{}' });
export const cancelRegistration = (id: string) => api<{ registration: Registration }>(`/api/events/${encodeURIComponent(id)}/register`, { method: 'DELETE' });
export const getProfile = () => api<{ user: User }>('/api/profile');
export const refreshSession = () => api<{ user: User }>('/api/auth/refresh', { method: 'POST' });
export const login = (email: string, password: string) => api<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const signup = (fullName: string, email: string, password: string) => api<{ user: User }>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ fullName, email, password }) });
export const logout = () => api<{ message: string }>('/api/auth/logout', { method: 'POST' });

export type ChatPlatform = 'WHATSAPP' | 'DISCORD' | 'TELEGRAM' | 'SLACK' | 'OTHER';
export type ChatLink = { platform: ChatPlatform; url: string; label?: string };

export type Community = {
  _id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  logo: string;
  coverImage: string;
  category: string;
  university: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationMethod?: string | null;
  memberCount: number;
  eventCount: number;
  chatLinks?: ChatLink[];
  whatsappLink?: string;
  channelLink?: string;
  faculty?: string;
  department?: string;
  autoApprove?: boolean;
  createdAt?: string;
};

export type JoinRequest = { _id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; requestedAt: string; user?: { id: string; fullName: string } | null };
export type CommunityContext = {
  community: Community;
  viewerMembership?: { role: string } | null;
  viewerJoinRequest?: { status: string } | null;
  joinRequests?: JoinRequest[];
  membersTotal?: number;
};
export type SchoolProof = { email: string; verified: boolean; matchedSchool: string; selectedSchool: string; selectedMatches: boolean; profileSchool: string };
export type Institution = { _id: string; name: string; aliases: string[] };

export const MANAGER_ROLES = ['COORDINATOR', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'];
const id = encodeURIComponent;
export const listCommunities = () => api<{ communities: Community[] }>('/api/communities');
export const suggestedCommunities = () => api<{ communities: (Community & { reason: string })[] }>('/api/communities/suggested');
export const managedCommunities = () => api<{ communities: Community[] }>('/api/communities/managed');
export const getCommunity = (slug: string) => api<CommunityContext>(`/api/communities/${id(slug)}`);
// Includes events the community co-hosted with another community.
export const communityEvents = (communityId: string) => api<{ events: EventSummary[] }>(`/api/events?communityId=${id(communityId)}&includeCoHosted=true`);
export const joinCommunity = (communityId: string) => api<{ message: string }>(`/api/communities/${id(communityId)}/join`, { method: 'POST' });
export const leaveCommunity = (communityId: string) => api<{ message: string }>(`/api/communities/${id(communityId)}/leave`, { method: 'POST' });
export const answerJoinRequest = (communityId: string, requestId: string, approve: boolean) =>
  api(`/api/communities/${id(communityId)}/join-requests/${id(requestId)}/${approve ? 'approve' : 'reject'}`, { method: 'PATCH' });
export const joinByInvite = (token: string) => api<{ community?: Community }>(`/api/communities/join/${id(token)}`, { method: 'POST' });
/** Founder only. Returns a path like /communities/join/<token>, which this site serves too. */
export const createInviteLink = (communityId: string) => api<{ inviteLink: string }>(`/api/communities/${id(communityId)}/invite-link`, { method: 'POST' });
export const listInstitutions = () => api<{ institutions: Institution[] }>('/api/institutions');
export const schoolProof = (university = '') => api<SchoolProof>(`/api/community-access/school${university ? `?university=${id(university)}` : ''}`);
export const sendSchoolCode = (email: string) => api<{ retryAfterSeconds: number }>('/api/community-access/email/send', { method: 'POST', body: JSON.stringify({ email }) });
export const verifySchoolCode = (code: string) => api<{ verified: boolean }>('/api/community-access/email/verify', { method: 'POST', body: JSON.stringify({ code }) });
/** Uploads a new logo, a new cover, or both. Empty paths come back for anything not sent. */
export function uploadCommunityImages(logo: File | null, cover?: File | null) {
  const form = new FormData();
  if (logo) form.append('logo', logo);
  if (cover) form.append('coverImage', cover);
  return api<{ logo: string; coverImage: string }>('/api/communities/upload', { method: 'POST', body: form });
}
export function uploadEndorsementLetter(file: File) {
  const form = new FormData();
  form.append('letter', file);
  return api<{ letter: string }>('/api/communities/upload/endorsement-letter', { method: 'POST', body: form });
}
export type CommunityInput = {
  name: string; shortDescription: string; description: string; category: string; logo: string; coverImage: string;
  university: string; faculty: string; department: string; chatLinks: ChatLink[]; channelLink: string;
  visibility: 'PUBLIC' | 'PRIVATE'; autoApprove: boolean; verificationMethod: 'UNIVERSITY_EMAIL' | 'MANUAL'; endorsementLetter: string;
};
export const createCommunity = (input: CommunityInput) => api<{ community: Community }>('/api/communities', { method: 'POST', body: JSON.stringify(input) });
/** Founder only. Fields left out stay as they are; changing the school sends the community back for review. */
export type CommunityPatch = Partial<Omit<CommunityInput, 'verificationMethod' | 'endorsementLetter'>>;
/** Accept or decline an invitation for your community to co-host an event. */
export const respondPartnership = (partnershipId: string, accept: boolean) =>
  api<{ partnership: unknown }>(`/api/events/partnerships/${id(partnershipId)}`, { method: 'PATCH', body: JSON.stringify({ action: accept ? 'ACCEPT' : 'DECLINE' }) });
// Events registered on another site.
/** Notes that the student opened the partner's registration page (organizers see who has). */
export const partnerOpened = (eventId: string) => api(`/api/events/${id(eventId)}/partner-opened`, { method: 'POST', body: '{}' });
export type ReportRow = { row: number; email: string; minutes: number | null; day: string; matched: boolean; reason: string; action: 'ADD' | 'REPLACE' | 'REMOVE' };
export type ReportPreview = { reportId: string; filename: string; kind: 'REGISTRATION' | 'ATTENDANCE'; appliedAt: string | null; matched: number; needsReview: number; rows: ReportRow[] };
/** Reads the partner site's attendance export (CSV, or Zoom/Teams) and shows who it matches before anything changes. */
export const previewAttendanceReport = (eventId: string, text: string, filename: string) =>
  api<ReportPreview>(`/api/events/${id(eventId)}/external-reports/preview`, { method: 'POST', body: JSON.stringify({ kind: 'ATTENDANCE', text, filename }) });
export const applyAttendanceReport = (eventId: string, reportId: string) =>
  api<{ applied: number; needsReview: number; conflicts: number }>(`/api/events/${id(eventId)}/external-reports/${id(reportId)}/apply`, { method: 'POST', body: '{}' });
export const listAttendanceReports = (eventId: string) => api<{ reports: { _id: string; kind: string; filename: string; appliedAt: string | null; createdAt: string }[] }>(`/api/events/${id(eventId)}/external-reports`);
export const updateCommunity = (communityId: string, patch: CommunityPatch) => api<{ community: Community }>(`/api/communities/${id(communityId)}`, { method: 'PATCH', body: JSON.stringify(patch) });

// Organizer calls. The backend checks every one of these against the person's community role.
export const EVENT_TYPES = ['WORKSHOP', 'SEMINAR', 'WEBINAR', 'HACKATHON', 'BOOTCAMP', 'COMPETITION', 'CONFERENCE', 'MEETUP', 'TRAINING', 'VOLUNTEER', 'FIELD_TRIP', 'OTHER'] as const;
export type Attendee = Registration & { user?: { id: string; fullName: string; email: string; university?: string } | null; registeredAt?: string };
export type ScannerPass = { id: string; token: string; label: string; claimed: boolean };
export type EventCounts = { checkedInCount?: number; completedCount?: number };
export type EventInput = {
  communityId?: string; title: string; type: string; shortDescription: string; description: string; bannerImage: string;
  startDate: string; endDate: string; timezone: string; mode: 'PHYSICAL' | 'HYBRID' | 'VIRTUAL'; venue: string; state: string; meetingLink: string;
  registrationPolicy: 'OPEN' | 'APPROVAL' | 'INVITE'; partnerRegistrationUrl?: string; partnerRegistrationLabel?: string; capacity: number; waitlistEnabled: boolean;
  certificateEnabled: boolean; checkOutRequired: boolean; minimumAttendanceDuration: number; contacts: { name: string; phone: string; email: string }[];
  attendanceSource?: 'GUILDOS' | 'EXTERNAL';
  days?: { date: string | null; theme: string; venue: string; startTime: string; endTime: string }[];
  minimumAttendanceDays?: number;
  sections?: { key: string; name: string; description: string; capacity: number; venue: string }[];
  partners?: { name: string; logo: string; website: string }[];
  certificateType?: string;
  certificateMode?: 'STANDARD' | 'CUSTOM';
  certificateStyle?: string;
  certificateTemplate?: string;
  certificateContent?: import('./certificate/types').CertificateContent;
  certificateNamePlacement?: import('./certificate/types').CertificateNamePlacement;
  certificateQrBox?: import('./certificate/types').TicketQrBox | null;
};
const post = (path: string, body: unknown = {}) => api<{ event: EventSummary }>(path, { method: 'POST', body: JSON.stringify(body) });
export const publishEvent = (eventId: string) => post(`/api/events/${id(eventId)}/publish`);
export const setEventStatus = (eventId: string, status: 'CHECK_IN' | 'CHECK_OUT' | 'COMPLETED') => post(`/api/events/${id(eventId)}/status`, { status });
/** Cancels the event: places are cancelled and everyone registered, plus co-hosts and speakers, gets the standard cancellation email. */
export const cancelEvent = (eventId: string) => post(`/api/events/${id(eventId)}/archive`);
export const endEventNow = (eventId: string) => post(`/api/events/${id(eventId)}/end-now`);
export const extendEvent = (eventId: string, minutes: number) => post(`/api/events/${id(eventId)}/extend`, { minutes });
// The backend sends each row as { registration, user }; the page wants one flat row.
export const listAttendees = async (eventId: string) => {
  const r = await api<{ registrations: { registration: Registration & { _id: string }; user: Attendee['user'] }[] }>(`/api/events/${id(eventId)}/registrations`);
  return { registrations: r.registrations.map((row): Attendee => ({ ...row.registration, user: row.user })) };
};
export const answerRegistration = (eventId: string, registrationId: string, approve: boolean) =>
  api(`/api/events/${id(eventId)}/registrations/${id(registrationId)}/${approve ? 'approve' : 'reject'}`, { method: 'POST', body: '{}' });
export const listScannerPasses = (eventId: string) => api<{ passes: ScannerPass[] }>(`/api/events/${id(eventId)}/scanner-links`);
export const createScannerPass = (eventId: string) => api<{ passes: ScannerPass[] }>(`/api/events/${id(eventId)}/scanner-links`, { method: 'POST', body: JSON.stringify({ count: 1 }) });
export const scanPass = (eventId: string, token: string, action: 'in' | 'out') =>
  api<{ student?: string; status?: string }>(`/api/attendance/${action === 'in' ? 'checkin' : 'checkout'}`, { method: 'POST', body: JSON.stringify({ token, eventId }) });
export const doorInfo = (scannerToken: string, device: string) => api<{ title: string; status: string; label: string; scanningOpen: boolean }>(`/api/events/door/${id(scannerToken)}?device=${id(device)}`);
export const doorScan = (scannerToken: string, token: string, action: 'in' | 'out', deviceId: string) =>
  api<{ student: string; status: string }>(`/api/events/door/${id(scannerToken)}/scan`, { method: 'POST', body: JSON.stringify({ token, action, deviceId }) });
export function uploadBanner(file: File) {
  const form = new FormData();
  form.append('banner', file);
  return api<{ banner: string }>('/api/events/upload', { method: 'POST', body: form });
}
export const createEvent = (input: EventInput) => api<{ event: EventSummary }>('/api/events', { method: 'POST', body: JSON.stringify(input) });
export const updateEvent = (eventId: string, input: Partial<EventInput>) => api<{ event: EventSummary }>(`/api/events/${id(eventId)}`, { method: 'PATCH', body: JSON.stringify(input) });
export const hostedEvents = () => api<{ events: EventSummary[] }>('/api/events/hosting');
