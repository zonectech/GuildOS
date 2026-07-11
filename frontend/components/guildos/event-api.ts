const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function resolveEventImageUrl(path?: string) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/uploads/${path}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
    ...init,
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload && payload.error ? payload.error : 'Request failed';
    throw new Error(message);
  }
  return payload;
}

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CHECK_IN' | 'CHECK_OUT' | 'COMPLETED' | 'ARCHIVED';
export type EventMode = 'PHYSICAL' | 'HYBRID' | 'VIRTUAL';
export type EventVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
export type EventRegistrationPolicy = 'OPEN' | 'APPROVAL' | 'INVITE';

export type CertificateMode = 'STANDARD' | 'CUSTOM';
export type CertificateType = 'ATTENDANCE' | 'COMPLETION' | 'LEADERSHIP' | 'VOLUNTEER';
export type CertificateStatus = 'VERIFIED' | 'REVOKED';

export type CertificateNamePlacement = {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
};

export type CertificateBackground = 'IVORY' | 'WHITE' | 'CREAM' | 'SLATE' | 'BLUSH' | 'NAVY' | 'CHARCOAL' | 'FOREST' | 'BURGUNDY';
export type CertificateFont = 'SERIF' | 'ELEGANT' | 'SANS' | 'PLAYFAIR' | 'CORMORANT' | 'MERRIWEATHER' | 'MONTSERRAT' | 'SCRIPT';

export type CertificateTheme = {
  accent: string;
  background: CertificateBackground;
  font: CertificateFont;
};

export const DEFAULT_CERTIFICATE_THEME: CertificateTheme = { accent: '#b8933a', background: 'IVORY', font: 'SERIF' };

export type CertificateStyle =
  | 'CLASSIC'
  | 'MODERN'
  | 'MINIMAL'
  | 'CORPORATE'
  | 'DECO'
  | 'GEOMETRIC'
  | 'RIBBON'
  | 'DOUBLE'
  | 'ROUNDED'
  | 'LAUREL'
  | 'TECH'
  | 'WAVE';
export const PREMIUM_CERTIFICATE_STYLES: CertificateStyle[] = [];

export type CertificateSignatory = { name: string; title: string; image: string };

export type CertificateLogoPlacement = 'NONE' | 'EMBLEM' | 'TOP_LEFT' | 'TOP_RIGHT' | 'WATERMARK';

export type CertificateContent = {
  title: string;
  presentation: string;
  message: string;
  signatories: CertificateSignatory[];
  logo: string;
  logoPlacement: CertificateLogoPlacement;
};

export const DEFAULT_CERTIFICATE_CONTENT: CertificateContent = { title: '', presentation: '', message: '', signatories: [], logo: '', logoPlacement: 'NONE' };

export type EventRegistrationStatus =
  | 'PENDING_APPROVAL' | 'CONFIRMED' | 'WAITLISTED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'COMPLETED' | 'PARTIAL_ATTENDANCE' | 'CANCELLED' | 'REJECTED' | 'NO_SHOW';

export type EventRegistrationType = 'OPEN' | 'APPROVAL' | 'INVITE' | 'WALK_IN';

export type EventAttendanceMode = 'PHYSICAL' | 'ONLINE';

export type EventRegistration = {
  _id: string;
  eventId: string;
  communityId: string | null;
  userId: string;
  registrationType: EventRegistrationType;
  attendanceMode?: EventAttendanceMode | null;
  status: EventRegistrationStatus;
  qrToken: string;
  registeredAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  attendanceMinutes: number;
  certificateEligible: boolean;
  certificateIssued: boolean;
};

export const EVENT_TYPES = [
  'WORKSHOP', 'SEMINAR', 'WEBINAR', 'HACKATHON', 'BOOTCAMP', 'COMPETITION',
  'CONFERENCE', 'MEETUP', 'TRAINING', 'VOLUNTEER', 'FIELD_TRIP', 'OTHER',
] as const;

export type EventType = typeof EVENT_TYPES[number];

export type EventSummary = {
  _id: string;
  communityId: string;
  title: string;
  slug: string;
  type: string;
  shortDescription: string;
  description: string;
  bannerImage: string;
  mode: EventMode;
  venue: string;
  address: string;
  meetingLink: string;
  tags?: string[];
  /** "Item 7" 🍛 — refreshments provided at physical/hybrid events. */
  refreshments?: boolean;
  /** Promotional images (flyers, speaker cards) shown in a slider on the event page. */
  gallery?: string[];
  /** AUTO = system thank-you sent with certificates; CUSTOM = organizer designs it; OFF = none. */
  appreciationMode?: 'AUTO' | 'CUSTOM' | 'OFF';
  startDate: string | null;
  endDate: string | null;
  timezone: string;
  registrationPolicy: EventRegistrationPolicy;
  registrationDeadline: string | null;
  capacity: number;
  waitlistEnabled: boolean;
  allowWalkIns: boolean;
  qrEnabled: boolean;
  certificateEnabled: boolean;
  certificateMode: CertificateMode;
  certificateType: CertificateType;
  certificateTemplate: string;
  certificateNamePlacement: CertificateNamePlacement;
  certificateTheme: CertificateTheme;
  certificateStyle: CertificateStyle;
  certificateContent: CertificateContent;
  premiumUnlocked?: boolean;
  minimumAttendanceDuration: number;
  checkOutRequired: boolean;
  visibility: EventVisibility;
  status: EventStatus;
  sponsorshipOpen: boolean;
  sponsorshipPitch: string;
  sponsorshipPackages: SponsorshipPackage[];
  registrationCount: number;
  checkedInCount: number;
  completedCount: number;
  certificatesIssued: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Included in list responses (e.g. community profile) */
  sponsors?: EventSponsor[];
  speakers?: EventSpeaker[];
};

export type SpeakerType = 'WORKSHOP' | 'PANEL' | 'GUEST';

export type EventSpeaker = {
  _id: string;
  eventId: string;
  userId: string | null;
  speakerType: SpeakerType;
  fullName: string;
  title: string;
  organization: string;
  bio: string;
  photo: string;
  linkedinUrl: string;
};

export type EventSponsor = {
  _id: string;
  eventId: string;
  name: string;
  logo: string;
  website: string;
};

export type SponsorshipPackage = {
  name: string;
  price: string;
  perks: string[];
  benefits: string;
};

/** System-defined sponsor deliverables — organizers pick perks, the platform defines the menu. */
export const SPONSOR_PERKS: { key: string; label: string; platformDelivered: boolean }[] = [
  { key: 'LOGO_EVENT_PAGE', label: 'Logo on the event page', platformDelivered: true },
  { key: 'LOGO_CERTIFICATES', label: 'Logo on attendee certificates', platformDelivered: true },
  { key: 'SOCIAL_ANNOUNCEMENT', label: 'Thank-you announcement from the community', platformDelivered: true },
  { key: 'ATTENDANCE_REPORT', label: 'Verified attendance report after the event', platformDelivered: true },
  { key: 'STAGE_MENTION', label: 'Stage mention during the event', platformDelivered: false },
  { key: 'BOOTH', label: 'Booth / stand at the venue', platformDelivered: false },
  { key: 'VENUE_BANNER', label: 'Banner placement at the venue', platformDelivered: false },
];

export const SPONSOR_PERK_LABEL: Record<string, string> = Object.fromEntries(SPONSOR_PERKS.map((p) => [p.key, p.label]));

export type SponsorshipInquiryStatus = 'NEW' | 'CONTACTED' | 'WON' | 'CLOSED';
export type SponsorshipFeeStatus = 'NONE' | 'PENDING' | 'PAID';

export type SponsorshipInquiry = {
  _id: string;
  eventId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  packageName: string;
  message: string;
  dealNote: string;
  packageWon: string;
  dealAmount: number;
  feeStatus: SponsorshipFeeStatus;
  status: SponsorshipInquiryStatus;
  createdAt: string;
};

export type SponsorshipFeeSettings = {
  sponsorshipFeePercent: number;
  feeBankName: string;
  feeAccountNumber: string;
  feeAccountName: string;
  packageTemplates: SponsorshipPackage[];
};

export type SponsorshipOpenEvent = {
  _id: string;
  slug: string;
  title: string;
  type: EventType;
  shortDescription: string;
  bannerImage: string;
  mode: EventMode;
  venue: string;
  startDate: string | null;
  capacity: number;
  registrationCount: number;
  sponsorshipPitch: string;
  sponsorshipPackages: SponsorshipPackage[];
  community: { name: string; slug: string; logo: string; verificationStatus: string } | null;
};

export type EventInput = Partial<Omit<EventSummary,
  '_id' | 'communityId' | 'slug' | 'status' | 'registrationCount' | 'checkedInCount' | 'completedCount' | 'certificatesIssued' | 'createdBy' | 'createdAt' | 'updatedAt'>>;

export type EventAnalytics = {
  registrationCount: number;
  confirmedCount: number;
  pendingCount: number;
  waitlistCount: number;
  walkInCount: number;
  checkedInCount: number;
  completedCount: number;
  certificatesIssued: number;
  checkInRate: number;
  completionRate: number;
  attendanceRate: number;
  averageAttendanceDuration: number;
};

export async function listEvents(communityId?: string) {
  const qs = communityId ? `?communityId=${encodeURIComponent(communityId)}` : '';
  return requestJson<{ events: EventSummary[] }>(`/api/events${qs}`);
}

export async function listManagedEvents(communityId: string) {
  return requestJson<{ events: EventSummary[] }>(`/api/events/manage/${encodeURIComponent(communityId)}`);
}

export async function getCommunityPremium(communityId: string) {
  return requestJson<{ isPremium: boolean }>(`/api/communities/${encodeURIComponent(communityId)}/premium`);
}

export type PremiumStatus = {
  isPremium: boolean;
  premiumExpiresAt: string | null;
  monthlyPrice: number;
  monthlyFee?: number;
  monthlyTotal?: number;
  eventPrice?: number;
  eventFee?: number;
  eventTotal?: number;
  gateway?: 'PAYSTACK' | 'FLUTTERWAVE';
  paymentsEnabled: boolean;
};

export type EventPremiumQuote = {
  unlocked: boolean;
  communityPremium: boolean;
  price: number;
  fee: number;
  total: number;
  gateway?: 'PAYSTACK' | 'FLUTTERWAVE';
  paymentsEnabled: boolean;
};

export async function getEventPremiumQuote(eventId: string) {
  return requestJson<EventPremiumQuote>(`/api/events/${encodeURIComponent(eventId)}/premium/quote`);
}

export async function startEventPremiumCheckout(eventId: string) {
  return requestJson<{ authorizationUrl: string; reference: string }>(`/api/events/${encodeURIComponent(eventId)}/premium/checkout`, {
    method: 'POST',
  });
}

export async function verifyEventPremium(eventId: string, reference: string) {
  return requestJson<{ status: 'PAID' | 'FAILED'; scope?: 'EVENT'; eventId?: string; alreadyProcessed?: boolean }>(
    `/api/events/${encodeURIComponent(eventId)}/premium/verify?reference=${encodeURIComponent(reference)}`,
  );
}

export async function reconcileEventPayment(eventId: string) {
  return requestJson<{ recovered: number; pending: number; unlocked: boolean }>(
    `/api/events/${encodeURIComponent(eventId)}/premium/reconcile`,
    { method: 'POST' },
  );
}

export type PremiumPayment = {
  reference: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  createdAt: string;
};

export async function getPremiumStatus(communityId: string) {
  return requestJson<PremiumStatus>(`/api/communities/${encodeURIComponent(communityId)}/premium/status`);
}

export async function startPremiumCheckout(communityId: string) {
  return requestJson<{ authorizationUrl: string; reference: string }>(`/api/communities/${encodeURIComponent(communityId)}/premium/checkout`, {
    method: 'POST',
  });
}

export async function verifyPremiumPayment(communityId: string, reference: string) {
  return requestJson<{ status: 'PAID' | 'FAILED'; premiumExpiresAt?: string; alreadyProcessed?: boolean }>(
    `/api/communities/${encodeURIComponent(communityId)}/premium/verify?reference=${encodeURIComponent(reference)}`,
  );
}

export async function getPremiumHistory(communityId: string) {
  return requestJson<{ payments: PremiumPayment[] }>(`/api/communities/${encodeURIComponent(communityId)}/premium/history`);
}

export async function reconcileCommunityPayment(communityId: string) {
  return requestJson<{ recovered: number; pending: number; status: PremiumStatus }>(
    `/api/communities/${encodeURIComponent(communityId)}/premium/reconcile`,
    { method: 'POST' },
  );
}

export async function generateCertificateWording(communityId: string, eventTitle: string, type: string) {
  return requestJson<{ wording: { presentation: string; message: string; source: 'ai' | 'template' } }>('/api/events/certificate-wording', {
    method: 'POST',
    body: JSON.stringify({ communityId, eventTitle, type }),
  });
}

export async function getEvent(slug: string) {
  return requestJson<{
    event: EventSummary;
    speakers: EventSpeaker[];
    sponsors: EventSponsor[];
    community: { id: string; name: string; slug: string; logo: string; verificationStatus: string } | null;
    viewerRegistration: EventRegistration | null;
    canManage: boolean;
  }>(`/api/events/${encodeURIComponent(slug)}`);
}

export async function createEvent(communityId: string, input: EventInput) {
  return requestJson<{ event: EventSummary }>('/api/events', {
    method: 'POST',
    body: JSON.stringify({ communityId, ...input }),
  });
}

export async function updateEvent(id: string, input: EventInput) {
  return requestJson<{ event: EventSummary }>(`/api/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteEvent(id: string) {
  return requestJson<{ message: string }>(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function publishEvent(id: string) {
  return requestJson<{ event: EventSummary }>(`/api/events/${encodeURIComponent(id)}/publish`, { method: 'POST' });
}

export async function archiveEvent(id: string) {
  return requestJson<{ event: EventSummary }>(`/api/events/${encodeURIComponent(id)}/archive`, { method: 'POST' });
}

export async function setEventStatus(id: string, status: EventStatus) {
  return requestJson<{ event: EventSummary }>(`/api/events/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function getEventAnalytics(id: string) {
  return requestJson<{ analytics: EventAnalytics }>(`/api/events/${encodeURIComponent(id)}/analytics`);
}

/** Organizer-designed appreciation email. */
export type AppreciationDesign = {
  category?: 'CONGRATS' | 'CONFIRMATION' | 'INFO';
  subject?: string;
  heading?: string;
  message?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  note?: string;
};

/** Thank everyone who attended (branded email + in-app note). One blast per event. */
export async function sendEventAppreciation(id: string, design: AppreciationDesign = {}) {
  return requestJson<{ attendees: number; notified: number; emailed: number }>(`/api/events/${encodeURIComponent(id)}/appreciation`, {
    method: 'POST',
    body: JSON.stringify(design),
  });
}

export async function addEventSpeaker(id: string, input: Partial<Omit<EventSpeaker, '_id' | 'eventId'>>) {
  return requestJson<{ speaker: EventSpeaker }>(`/api/events/${encodeURIComponent(id)}/speakers`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function addEventSponsor(id: string, input: Partial<Omit<EventSponsor, '_id' | 'eventId'>>) {
  return requestJson<{ sponsor: EventSponsor }>(`/api/events/${encodeURIComponent(id)}/sponsors`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listSponsorshipOpenEvents() {
  return requestJson<{ events: SponsorshipOpenEvent[] }>('/api/events/sponsorship/open');
}

export async function submitSponsorshipInquiry(
  eventId: string,
  input: { companyName: string; contactName: string; email: string; phone?: string; website?: string; packageName?: string; message?: string; hp?: string },
) {
  return requestJson<{ inquiry: SponsorshipInquiry | null }>(`/api/events/${encodeURIComponent(eventId)}/sponsorship/inquiries`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listSponsorshipInquiries(eventId: string) {
  return requestJson<{ inquiries: SponsorshipInquiry[] }>(`/api/events/${encodeURIComponent(eventId)}/sponsorship/inquiries`);
}

export async function setSponsorshipInquiryStatus(eventId: string, inquiryId: string, status: SponsorshipInquiryStatus) {
  return requestJson<{ inquiry: SponsorshipInquiry }>(
    `/api/events/${encodeURIComponent(eventId)}/sponsorship/inquiries/${encodeURIComponent(inquiryId)}`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  );
}

export async function convertSponsorshipInquiry(
  eventId: string,
  inquiryId: string,
  input: { packageWon?: string; dealAmount?: number; dealNote?: string; logo?: string } = {},
) {
  return requestJson<{ inquiry: SponsorshipInquiry; sponsor: EventSponsor; feeSettings: SponsorshipFeeSettings }>(
    `/api/events/${encodeURIComponent(eventId)}/sponsorship/inquiries/${encodeURIComponent(inquiryId)}/convert`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function getSponsorshipFeeSettings() {
  return requestJson<{ settings: SponsorshipFeeSettings }>('/api/events/sponsorship/fee-settings');
}

export type SponsorReport = {
  event: {
    title: string;
    slug: string;
    type: EventType;
    mode: EventMode;
    venue: string;
    startDate: string | null;
    endDate: string | null;
    bannerImage: string;
    status: EventStatus;
    certificatesIssued: number;
  };
  community: { name: string; slug: string; logo: string; verificationStatus: string } | null;
  sponsors: { name: string; logo: string; website: string }[];
  stats: {
    registered: number;
    checkedIn: number;
    completed: number;
    checkInRate: number;
    completionRate: number;
    averageAttendanceMinutes: number;
  };
  final: boolean;
  generatedAt: string;
};

export async function getSponsorReport(slug: string) {
  return requestJson<{ report: SponsorReport }>(`/api/events/${encodeURIComponent(slug)}/sponsor-report`);
}

export async function deleteEventSpeaker(id: string, speakerId: string) {
  return requestJson<{ message: string }>(`/api/events/${encodeURIComponent(id)}/speakers/${encodeURIComponent(speakerId)}`, { method: 'DELETE' });
}

export async function updateEventSpeaker(id: string, speakerId: string, input: Partial<Omit<EventSpeaker, '_id' | 'eventId'>>) {
  return requestJson<{ speaker: EventSpeaker }>(`/api/events/${encodeURIComponent(id)}/speakers/${encodeURIComponent(speakerId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function searchSpeakerUsers(id: string, q: string) {
  return requestJson<{ users: WalkInUser[] }>(`/api/events/${encodeURIComponent(id)}/speaker-search?q=${encodeURIComponent(q)}`);
}

export type EventVolunteer = {
  _id: string;
  eventId: string;
  userId: string;
  fullName: string;
  role: string;
  createdAt: string;
};

export async function getEventVolunteers(id: string) {
  return requestJson<{ volunteers: EventVolunteer[] }>(`/api/events/${encodeURIComponent(id)}/volunteers`);
}

export async function addEventVolunteer(id: string, input: { userId: string; role?: string }) {
  return requestJson<{ volunteer: EventVolunteer }>(`/api/events/${encodeURIComponent(id)}/volunteers`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteEventVolunteer(id: string, volunteerId: string) {
  return requestJson<{ message: string }>(`/api/events/${encodeURIComponent(id)}/volunteers/${encodeURIComponent(volunteerId)}`, { method: 'DELETE' });
}

export async function searchVolunteerUsers(id: string, q: string) {
  return requestJson<{ users: WalkInUser[] }>(`/api/events/${encodeURIComponent(id)}/volunteer-search?q=${encodeURIComponent(q)}`);
}

export async function deleteEventSponsor(id: string, sponsorId: string) {
  return requestJson<{ message: string }>(`/api/events/${encodeURIComponent(id)}/sponsors/${encodeURIComponent(sponsorId)}`, { method: 'DELETE' });
}

export async function uploadEventMedia(payload: FormData) {
  const uploaded = await requestJson<{ banner: string; speakerPhoto: string; sponsorLogo: string; certificateTemplate: string; signature: string; certificateLogo: string; gallery?: string[] }>('/api/events/upload', {
    method: 'POST',
    body: payload,
  });
  return {
    banner: resolveEventImageUrl(uploaded.banner),
    speakerPhoto: resolveEventImageUrl(uploaded.speakerPhoto),
    sponsorLogo: resolveEventImageUrl(uploaded.sponsorLogo),
    certificateTemplate: resolveEventImageUrl(uploaded.certificateTemplate),
    signature: uploaded.signature,
    signatureUrl: resolveEventImageUrl(uploaded.signature),
    certificateLogo: uploaded.certificateLogo,
    certificateLogoUrl: resolveEventImageUrl(uploaded.certificateLogo),
    /** Raw /uploads/<key> paths — store these on the event. */
    gallery: uploaded.gallery ?? [],
  };
}

export async function registerForEvent(id: string, attendanceMode?: EventAttendanceMode) {
  return requestJson<{ registration: EventRegistration }>(`/api/events/${encodeURIComponent(id)}/register`, {
    method: 'POST',
    body: JSON.stringify(attendanceMode ? { attendanceMode } : {}),
  });
}

/** Online attendees (virtual / hybrid-online) mark their own attendance while the event is live. */
export async function selfCheckIn(id: string) {
  return requestJson<{ registration: EventRegistration }>(`/api/events/${encodeURIComponent(id)}/attendance/self-check-in`, { method: 'POST' });
}

export async function selfCheckOut(id: string) {
  return requestJson<{ registration: EventRegistration }>(`/api/events/${encodeURIComponent(id)}/attendance/self-check-out`, { method: 'POST' });
}

export async function cancelRegistration(id: string) {
  return requestJson<{ message: string }>(`/api/events/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}

export async function getMyRegistration(id: string) {
  return requestJson<{ registration: EventRegistration | null }>(`/api/events/${encodeURIComponent(id)}/my-registration`);
}

export type EventRegistrationEntry = {
  registration: EventRegistration;
  user: { id: string; fullName: string; email: string; department: string; faculty: string; university: string } | null;
};

export async function listEventRegistrations(id: string) {
  return requestJson<{ registrations: EventRegistrationEntry[] }>(`/api/events/${encodeURIComponent(id)}/registrations`);
}

export async function checkInRegistration(id: string, registrationId: string) {
  return requestJson<{ registration: EventRegistration }>(`/api/events/${encodeURIComponent(id)}/registrations/${encodeURIComponent(registrationId)}/check-in`, { method: 'POST' });
}

export async function checkOutRegistration(id: string, registrationId: string) {
  return requestJson<{ registration: EventRegistration }>(`/api/events/${encodeURIComponent(id)}/registrations/${encodeURIComponent(registrationId)}/check-out`, { method: 'POST' });
}

export async function checkInByToken(token: string) {
  return requestJson<{ registration: EventRegistration }>(`/api/events/check-in/${encodeURIComponent(token)}`, { method: 'POST' });
}

export async function attendanceCheckIn(input: { registrationId?: string; token?: string }) {
  return requestJson<{ success: boolean; student: string; event: string; checkedInAt: string }>('/api/attendance/checkin', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function attendanceCheckOut(input: { registrationId?: string; token?: string }) {
  return requestJson<{ success: boolean; student: string; status: EventRegistrationStatus; attendanceDuration: number; certificateEligible: boolean; guildScoreAwarded: number; checkedOutAt: string }>('/api/attendance/checkout', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function finalizeEventAttendance(id: string) {
  return requestJson<{ noShows: number; partials: number }>(`/api/events/${encodeURIComponent(id)}/finalize`, { method: 'POST' });
}

export type LiveAttendance = {
  title: string;
  status: EventStatus;
  registrations: number;
  checkedIn: number;
  checkedOut: number;
  walkIns: number;
  pendingArrivals: number;
  pendingCheckOuts: number;
  completed: number;
  earlyDepartures: number;
  certificateEligible: number;
  averageDuration: number;
  attendanceRate: number;
};

export async function getEventLiveAttendance(id: string) {
  return requestJson<{ live: LiveAttendance }>(`/api/events/${encodeURIComponent(id)}/attendance/live`);
}

export async function getEventWalkIns(id: string) {
  return requestJson<{ walkins: Array<{ id: string; status: EventRegistrationStatus; checkInAt: string | null; user: { id: string; fullName: string } | null }> }>(
    `/api/events/${encodeURIComponent(id)}/walkins`,
  );
}

export type WalkInUser = { id: string; fullName: string; email: string; username: string };

export async function searchWalkInUsers(id: string, q: string) {
  return requestJson<{ users: WalkInUser[] }>(`/api/events/${encodeURIComponent(id)}/walk-in-search?q=${encodeURIComponent(q)}`);
}

export async function organizerRegisterWalkIn(id: string, userId: string) {
  return requestJson<{ success: boolean; student: string; checkedInAt: string }>(`/api/events/${encodeURIComponent(id)}/walk-in-register`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function walkInCheckIn(id: string) {
  return requestJson<{ registration: EventRegistration }>(`/api/events/${encodeURIComponent(id)}/walk-in`, { method: 'POST' });
}

export type MyRegistrationEntry = {
  registration: {
    id: string;
    status: EventRegistrationStatus;
    registrationType: EventRegistrationType;
    qrToken: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    certificateEligible: boolean;
  };
  event: { id: string; title: string; slug: string; startDate: string | null; venue: string; mode: EventMode; status: EventStatus };
};

export type UpcomingEventEntry = {
  id: string;
  title: string;
  slug: string;
  startDate: string | null;
  venue: string;
  mode: EventMode;
  status: EventStatus;
  registrationStatus: EventRegistrationStatus;
};

export async function getMyEventRegistrations() {
  return requestJson<{ registrations: MyRegistrationEntry[] }>('/api/users/me/registrations');
}

export async function getMyUpcomingEvents() {
  return requestJson<{ events: UpcomingEventEntry[] }>('/api/users/me/upcoming-events');
}

export async function approveRegistration(id: string, registrationId: string) {
  return requestJson<{ registration: EventRegistration }>(`/api/events/${encodeURIComponent(id)}/registrations/${encodeURIComponent(registrationId)}/approve`, { method: 'POST' });
}

export async function rejectRegistration(id: string, registrationId: string) {
  return requestJson<{ registration: EventRegistration }>(`/api/events/${encodeURIComponent(id)}/registrations/${encodeURIComponent(registrationId)}/reject`, { method: 'POST' });
}

export type EventDraft = {
  title: string;
  description: string;
  agenda: string[];
  audience: string;
  outcomes: string[];
  source: 'ai' | 'template';
};

export async function generateEventDraft(prompt: string) {
  return requestJson<{ draft: EventDraft }>('/api/events/ai-draft', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export async function issueEventCertificates(id: string) {
  return requestJson<{ issued: number; totalCertificates: number; appreciationSent?: boolean }>(`/api/events/${encodeURIComponent(id)}/issue-certificates`, { method: 'POST' });
}

export type CertificateSummary = {
  serial: string;
  eventTitle: string;
  communityName: string;
  type: CertificateType;
  status: CertificateStatus;
  verificationUrl: string;
  issuedAt: string;
};

export type CertificateDetail = {
  verified: boolean;
  status: CertificateStatus;
  serial: string;
  attendeeName: string;
  studentName: string;
  eventTitle: string;
  eventName: string;
  communityName: string;
  university: string;
  type: CertificateType;
  mode: CertificateMode;
  templateImage: string;
  namePlacement: CertificateNamePlacement;
  theme: CertificateTheme;
  content: CertificateContent;
  style: CertificateStyle;
  eventDate: string | null;
  attendanceDuration: number;
  attendanceMinutes: number;
  verificationUrl: string;
  verificationCount: number;
  revokeReason: string;
  issueDate: string;
  issuedAt: string;
  sponsors: { name: string; logo: string }[];
};

export async function getMyCertificates() {
  return requestJson<{ certificates: CertificateSummary[] }>('/api/certificates/mine');
}

export async function verifyCertificate(serial: string) {
  return requestJson<{ certificate: CertificateDetail }>(`/api/certificates/verify/${encodeURIComponent(serial)}`);
}

export async function revokeCertificate(serial: string, reason: string) {
  return requestJson<{ certificate: { serial: string; status: CertificateStatus; revokedAt: string; revokeReason: string } }>('/api/certificates/revoke', {
    method: 'POST',
    body: JSON.stringify({ serial, reason }),
  });
}
