/**
 * Hosting: create and edit events (drafts autosave), publish, and run them (registrations, live
 * attendance, scanning, corrections, finalizing, certificates, ratings, external reports).
 * Real endpoints throughout. Field names here are the backend's, so drafts round-trip unchanged.
 */
import { api, ApiError, enc, mediaUrl } from './client';

export const EVENT_TYPES = ['WORKSHOP', 'SEMINAR', 'MEETUP', 'HACKATHON', 'BOOTCAMP', 'TRAINING', 'CONFERENCE', 'COMPETITION', 'WEBINAR', 'VOLUNTEER', 'FIELD_TRIP', 'OTHER'] as const;
export type HostEventType = (typeof EVENT_TYPES)[number];

/** Everything the create/edit form owns. */
export interface EventDraft {
  title: string;
  type: HostEventType;
  /** When the type is OTHER: what it is, in the organizer's words. */
  typeLabel: string;
  shortDescription: string;
  description: string;
  bannerImage: string;
  startDate: string; // ISO
  endDate: string; // ISO
  timezone: string;
  mode: 'PHYSICAL' | 'VIRTUAL' | 'HYBRID';
  venue: string;
  meetingLink: string;
  /** RegistrationSettings */
  attendanceSource: 'GUILDOS' | 'EXTERNAL';
  partnerRegistrationUrl: string;
  partnerRegistrationLabel: string;
  capacity: number;
  registrationDeadline: string | null;
  audience: 'EVERYONE' | 'SCHOOL';
  guestListVisible: boolean;
  qrEnabled: boolean;
  checkOutRequired: boolean;
  /** Certificate: the platform's standard participation certificate, or none. */
  certificateEnabled: boolean;
}

export const emptyDraft = (): EventDraft => {
  const start = new Date(); start.setDate(start.getDate() + 7); start.setHours(16, 0, 0, 0);
  const end = new Date(start); end.setHours(18, 0, 0, 0);
  return {
    title: '', type: 'WORKSHOP', typeLabel: '', shortDescription: '', description: '', bannerImage: '', startDate: start.toISOString(), endDate: end.toISOString(), timezone: 'Africa/Lagos',
    mode: 'PHYSICAL', venue: '', meetingLink: '', attendanceSource: 'GUILDOS', partnerRegistrationUrl: '', partnerRegistrationLabel: '', capacity: 0, registrationDeadline: null,
    audience: 'EVERYONE', guestListVisible: true, qrEnabled: true, checkOutRequired: true, certificateEnabled: false,
  };
};

type RawHostEvent = Partial<EventDraft> & {
  _id: string; slug: string; status: string; communityId: string; title: string; startDate: string | null; endDate: string | null;
  registrationCount?: number; checkedInCount?: number; completedCount?: number; attendanceFinalizedAt?: string | null; cancellationReason?: string;
};
export interface HostEvent { id: string; slug: string; status: string; communityId: string; draft: EventDraft; registrationCount: number; checkedInCount: number; completedCount: number; finalizedAt: string | null; finalizesAt: string | null; cancellationReason: string }
const toHostEvent = (e: RawHostEvent): HostEvent => {
  const d = emptyDraft();
  const pick = <K extends keyof EventDraft>(k: K) => (e[k] ?? d[k]) as EventDraft[K];
  return {
    id: e._id, slug: e.slug, status: e.status, communityId: String(e.communityId),
    draft: {
      title: e.title ?? '', type: (EVENT_TYPES as readonly string[]).includes(String(e.type)) ? (e.type as HostEventType) : 'OTHER', typeLabel: e.typeLabel ?? '', shortDescription: pick('shortDescription'), description: pick('description'),
      bannerImage: e.bannerImage ?? '', startDate: e.startDate ?? d.startDate, endDate: e.endDate ?? d.endDate, timezone: pick('timezone'), mode: pick('mode'), venue: pick('venue'), meetingLink: pick('meetingLink'),
      attendanceSource: pick('attendanceSource'), partnerRegistrationUrl: pick('partnerRegistrationUrl'), partnerRegistrationLabel: pick('partnerRegistrationLabel'), capacity: pick('capacity'),
      registrationDeadline: e.registrationDeadline ?? null, audience: pick('audience'), guestListVisible: pick('guestListVisible'), qrEnabled: pick('qrEnabled'), checkOutRequired: pick('checkOutRequired'), certificateEnabled: pick('certificateEnabled'),
    },
    registrationCount: e.registrationCount ?? 0, checkedInCount: e.checkedInCount ?? 0, completedCount: e.completedCount ?? 0, finalizedAt: e.attendanceFinalizedAt ?? null, finalizesAt: null, cancellationReason: e.cancellationReason ?? '',
  };
};
/** What the API is sent: the form, plus the standard certificate when one is chosen. */
const toBody = (d: Partial<EventDraft>) => ({
  ...d,
  ...(d.certificateEnabled !== undefined ? { certificateMode: 'STANDARD', certificateType: 'ATTENDANCE' } : {}),
  ...(d.capacity !== undefined ? { capacity: Math.max(0, Math.round(d.capacity || 0)) } : {}),
});

export const loadHostEvent = (slug: string) => api<{ event: RawHostEvent; attendance?: { finalizesAt?: string | null }; canManage: boolean; canScan?: boolean; viewerIsHelper?: boolean; community: { id: string; name: string; slug: string; logo: string } | null }>(`/api/events/${enc(slug)}`)
  .then((r) => ({ ...toHostEvent(r.event), finalizesAt: r.attendance?.finalizesAt ?? null, canManage: r.canManage, canScan: Boolean(r.canScan), viewerIsHelper: Boolean(r.viewerIsHelper), community: r.community ? { ...r.community, logo: mediaUrl(r.community.logo) } : null }));
export const createDraft = (communityId: string, d: Partial<EventDraft>) =>
  api<{ event: RawHostEvent }>('/api/events', { method: 'POST', body: JSON.stringify({ communityId, ...toBody(d) }) }).then((r) => toHostEvent(r.event));
export const saveDraft = (id: string, d: Partial<EventDraft>) =>
  api<{ event: RawHostEvent }>(`/api/events/${enc(id)}`, { method: 'PATCH', body: JSON.stringify(toBody(d)) }).then((r) => toHostEvent(r.event));
export const publishEvent = (id: string) => api<{ event: RawHostEvent }>(`/api/events/${enc(id)}/publish`, { method: 'POST', body: '{}' }).then((r) => toHostEvent(r.event));
export const deleteDraft = (id: string) => api(`/api/events/${enc(id)}`, { method: 'DELETE' });
export function uploadCover(file: File) {
  const form = new FormData(); form.append('banner', file);
  return api<{ banner: string }>('/api/events/upload', { method: 'POST', body: form }).then((r) => r.banner);
}
/** "Import from a Luma / Eventbrite link": reads the public page and fills the basics. */
export const importLink = (communityId: string, url: string) =>
  api<{ draft: Partial<EventDraft>; warnings: string[] }>('/api/events/import-link', { method: 'POST', body: JSON.stringify({ communityId, url }) });

/* ── Workspace ── */
export const cancelEvent = (id: string, reason: string) => api(`/api/events/${enc(id)}/archive`, { method: 'POST', body: JSON.stringify({ reason }) });
export const sendUpdate = (id: string, subject: string, message: string) =>
  api<{ recipients: number; notified: number }>(`/api/events/${enc(id)}/message`, { method: 'POST', body: JSON.stringify({ subject, message }) });
export const openAttendance = (id: string, status: 'CHECK_IN' | 'CHECK_OUT') => api(`/api/events/${enc(id)}/status`, { method: 'POST', body: JSON.stringify({ status }) });

export type AttendeeStatus = 'PENDING_APPROVAL' | 'CONFIRMED' | 'WAITLISTED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'COMPLETED' | 'PARTIAL_ATTENDANCE' | 'CANCELLED' | 'REJECTED' | 'NO_SHOW';
/** AttendanceRecord: one person's registration and door scans. */
export interface AttendanceRecord {
  id: string; userId: string; name: string; email: string; department: string; school: string; code: string; status: AttendeeStatus;
  registeredAt: string; checkInAt: string | null; checkOutAt: string | null; minutes: number; certificateEligible: boolean; certificateIssued: boolean;
}
type RawReg = { registration: { _id: string; userId: string; status: AttendeeStatus; passCode?: string; registeredAt?: string; createdAt?: string; checkInAt: string | null; checkOutAt: string | null; attendanceMinutes?: number; certificateEligible?: boolean; certificateIssued?: boolean }; user: { id: string; fullName: string; email: string; department: string; university: string } | null };
export const registrations = (id: string) => api<{ registrations: RawReg[] }>(`/api/events/${enc(id)}/registrations`).then((r): AttendanceRecord[] => r.registrations.map(({ registration: g, user }) => ({
  id: g._id, userId: String(g.userId), name: user?.fullName ?? 'Student', email: user?.email ?? '', department: user?.department ?? '', school: user?.university ?? '', code: g.passCode ?? '',
  status: g.status, registeredAt: g.registeredAt ?? g.createdAt ?? '', checkInAt: g.checkInAt, checkOutAt: g.checkOutAt, minutes: g.attendanceMinutes ?? 0,
  certificateEligible: Boolean(g.certificateEligible), certificateIssued: Boolean(g.certificateIssued),
})));

export interface LiveCounts { status: string; registrations: number; checkedIn: number; checkedOut: number; pendingArrivals: number; pendingCheckOuts: number; completed: number; earlyDepartures: number; certificateEligible: number; attendanceRate: number }
export const liveCounts = (id: string) => api<{ live: LiveCounts }>(`/api/events/${enc(id)}/attendance/live`).then((r) => r.live);

/** What a scanned QR or a typed code becomes: passes encode the bare token; older ones may hold a link ending in it. */
export const scanValue = (value: string) => (/^https?:\/\//i.test(value.trim()) ? (value.trim().split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '') : value.trim());

/**
 * Scan a pass (QR token) or a typed pass code. `offline` means the request never got an answer
 * (no connection, or the server is down): the pass may be perfectly good, so the scanner checks it
 * against the saved list and queues it instead of calling it invalid.
 */
export type ScanResult = { kind: 'ok'; name: string } | { kind: 'already'; message: string } | { kind: 'invalid'; message: string } | { kind: 'offline' };
export async function scan(eventId: string, mode: 'in' | 'out', value: string): Promise<ScanResult> {
  const v = scanValue(value);
  const body = /^[0-9a-f]{24}$/i.test(v) ? { registrationId: v, eventId } : { token: v, eventId };
  try {
    const r = await api<{ student?: string }>(`/api/attendance/${mode === 'in' ? 'checkin' : 'checkout'}`, { method: 'POST', body: JSON.stringify(body) });
    return { kind: 'ok', name: r.student || 'Student' };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) return { kind: 'offline' };
    const message = e instanceof Error ? e.message : 'Unable to scan';
    return /already/i.test(message) ? { kind: 'already', message } : { kind: 'invalid', message };
  }
}

/** The door list for working offline: names, in/out, and each pass as a salted hash (see lib/door.ts). */
export interface DoorRoster {
  event: { id: string; title: string; slug: string; status: string; timezone: string; startDate: string | null; endDate: string | null; multiDay: boolean; doorsOpen: boolean; finalized: boolean };
  role: 'HOST' | 'HELPER'; generatedAt: string; salt: string;
  entries: { id: string; name: string; t: string; c: string; in: boolean; out: boolean }[];
}
export const doorRoster = (eventId: string) => api<DoorRoster>(`/api/events/${enc(eventId)}/door`);
export type DoorScanResult = { id: string; kind: 'ok' | 'already' | 'invalid'; name: string; message: string };
export const syncScans = (eventId: string, scans: { id: string; value: string; mode: 'in' | 'out'; scannedAt: string }[]) =>
  api<{ results: DoorScanResult[] }>('/api/attendance/sync', { method: 'POST', body: JSON.stringify({ eventId, scans }) });

/** AttendanceCorrection: fixing a missing check-out (reason required, audited). */
export const correctCheckOut = (eventId: string, registrationId: string, checkOutAt: string, reason: string) =>
  api<{ completed: boolean }>(`/api/events/${enc(eventId)}/registrations/${enc(registrationId)}/correct-checkout`, { method: 'POST', body: JSON.stringify({ checkOutAt, reason }) });
export interface AttendanceCorrection { id: string; registrationId: string; kind: 'REPORT' | 'MANUAL'; reason: string; before: string | null; after: string | null; previousStatus: string; status: string; at: string }
export const corrections = (eventId: string) => api<{ corrections: { _id: string; registrationId: string; kind?: 'REPORT' | 'MANUAL'; reason?: string; beforeTimes?: { checkOutAt: string | null } | null; afterTimes?: { checkOutAt: string | null } | null; previousStatus: string; status: string; createdAt: string }[] }>(`/api/events/${enc(eventId)}/attendance-corrections`)
  .then((r): AttendanceCorrection[] => r.corrections.map((c) => ({ id: c._id, registrationId: String(c.registrationId), kind: c.kind ?? 'REPORT', reason: c.reason ?? '', before: c.beforeTimes?.checkOutAt ?? null, after: c.afterTimes?.checkOutAt ?? null, previousStatus: c.previousStatus, status: c.status, at: c.createdAt })));

export const finalize = (eventId: string) => api<{ noShows: number; partials: number }>(`/api/events/${enc(eventId)}/finalize`, { method: 'POST', body: '{}' });
export const eligibleList = (eventId: string) => api<{ eligible: { id: string; user: { fullName: string } | null }[] }>(`/api/events/${enc(eventId)}/certificate-eligible`).then((r) => r.eligible);
export const issueCertificates = (eventId: string) => api<{ issued: number; totalCertificates: number }>(`/api/events/${enc(eventId)}/issue-certificates`, { method: 'POST', body: '{}' });
export interface Ratings { average: number; count: number; distribution: Record<string, number> | number[]; comments: { rating: number; comment: string; name: string; at: string }[] }
export const eventRatings = (eventId: string) => api<{ feedback: Ratings }>(`/api/events/${enc(eventId)}/feedback`).then((r) => r.feedback);

/** AttendanceReport (external events): only verified emails match; everything else stays unresolved. */
export interface ReportRow { email: string; name?: string; minutes: number | null; day?: string; matched: boolean; reason: string }
export interface AttendanceReport { reportId: string; filename: string; appliedAt: string | null; matched: number; needsReview: number; rows: ReportRow[] }
export const previewReport = (eventId: string, filename: string, text: string) =>
  api<AttendanceReport>(`/api/events/${enc(eventId)}/external-reports/preview`, { method: 'POST', body: JSON.stringify({ kind: 'ATTENDANCE', filename, text }) });
export const applyReport = (eventId: string, reportId: string) =>
  api<{ applied: number }>(`/api/events/${enc(eventId)}/external-reports/${enc(reportId)}/apply`, { method: 'POST', body: '{}' });

/** HelperAccess: Event Helpers for one event (they can scan; nothing else). */
export interface Helper { id: string; name: string; userId: string }
export const helpers = (eventId: string) => api<{ volunteers: { _id: string; userId: string; fullName: string }[] }>(`/api/events/${enc(eventId)}/volunteers`)
  .then((r): Helper[] => r.volunteers.map((v) => ({ id: v._id, userId: v.userId, name: v.fullName || 'Helper' })));
export const addHelper = (eventId: string, userId: string) => api(`/api/events/${enc(eventId)}/volunteers`, { method: 'POST', body: JSON.stringify({ userId, role: 'Event Helper' }) });
export const removeHelper = (eventId: string, helperId: string) => api(`/api/events/${enc(eventId)}/volunteers/${enc(helperId)}`, { method: 'DELETE' });

/** A CSV the organizer can open in a spreadsheet (formula-safe). */
export function downloadCsv(filename: string, rows: string[][]) {
  const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const url = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Students' attendance reports for this event ("Report an attendance issue"): SENT → REVIEWED. */
export interface IssueReport { id: string; studentName: string; message: string; status: 'SENT' | 'REVIEWED'; response: string; createdAt: string }
export const issueReports = (eventId: string) => api<{ issues: { _id: string; studentName: string; message: string; status: IssueReport['status']; response: string; createdAt: string }[] }>(`/api/events/${enc(eventId)}/attendance-issues`)
  .then((r): IssueReport[] => r.issues.map((i) => ({ id: i._id, studentName: i.studentName, message: i.message, status: i.status, response: i.response, createdAt: i.createdAt })));
export const reviewIssue = (eventId: string, issueId: string, response: string) =>
  api(`/api/events/${enc(eventId)}/attendance-issues/${enc(issueId)}`, { method: 'PATCH', body: JSON.stringify({ response }) });
