import { createHash } from 'node:crypto';
import { ExternalReportModel } from '../../models/external-report.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { UserModel } from '../../models/user.model';
import { MemberEmailModel } from '../../models/member-email.model';
import { parseExternalReport, normalizeReportEmail } from '../../utils/external-report';
import { requireEventManager, recalcEventCounters, isMultiDayEvent, requiredAttendanceDays, cancelledEventDays, dayKeyOf } from './event-shared';
import { ticketCoveredDays } from './event-ticket.service';
import type { MultiDayEventLike } from './event-shared';
export function reportDayNumber(event: MultiDayEventLike, day: string) {
  const agenda = (event.days || []).findIndex(d => d.date && dayKeyOf(new Date(d.date), event.timezone) === day);
  if (agenda >= 0) return agenda + 1;
  if (!event.startDate) return 0;
  const n = Math.round((Date.parse(day) - Date.parse(dayKeyOf(event.startDate, event.timezone))) / 86400000) + 1;
  const end = event.endDate ? dayKeyOf(event.endDate, event.timezone) : dayKeyOf(event.startDate, event.timezone);
  return n > 0 && day <= end ? n : 0;
}

export async function previewExternalReport(eventId: string, actorId: string, input: { text?: unknown; kind?: unknown; filename?: unknown }) {
  const event = await requireEventManager(eventId, actorId);
  if (event.status === 'ARCHIVED') throw new Error('Event is archived');
  if (!['REGISTRATION', 'ATTENDANCE'].includes(String(input.kind))) throw new Error('Choose registration or attendance report');
  if (typeof input.text !== 'string') throw new Error('Upload a CSV or TSV report');
  const rows = parseExternalReport(input.text);
  const kind = input.kind as 'REGISTRATION' | 'ATTENDANCE';
  if (kind === 'ATTENDANCE') {
    if (event.attendanceSource !== 'EXTERNAL') throw new Error('Select external attendance in the event settings before importing attendance');
    if (!event.endDate || event.endDate.getTime() > Date.now()) throw new Error('Set the event end time and wait until it ends before importing attendance');
    for (const row of rows) {
      if (isMultiDayEvent(event) && !row.day) throw new Error('Multi-day attendance needs a day column (YYYY-MM-DD) for every row');
      if (row.day) {
        const n = reportDayNumber(event, row.day);
        if (!n || cancelledEventDays(event).includes(n)) throw new Error('Row ' + row.row + ' is outside the active event schedule');
      }
    }
  }
  const hash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  const report = await ExternalReportModel.findOneAndUpdate({ eventId, kind, hash }, { $setOnInsert: { eventId, actorId, kind, hash, rows, filename: String(input.filename || 'report.csv').slice(0, 200) } }, { upsert: true, new: true });
  return inspectExternalReport(eventId, actorId, String(report._id));
}

export async function inspectExternalReport(eventId: string, actorId: string, reportId: string) {
  const event = await requireEventManager(eventId, actorId);
  const report = await ExternalReportModel.findOne({ _id: reportId, eventId }).lean();
  if (!report) throw new Error('Report not found');
  const regs = await EventRegistrationModel.find({ eventId }).lean();
  const ids = regs.map(r => r.userId);
  const [users, aliases] = await Promise.all([
    UserModel.find({ _id: { $in: ids }, deletedAt: null, status: 'ACTIVE' }).select('email emailVerified').lean(),
    MemberEmailModel.find({ userId: { $in: ids }, verifiedAt: { $ne: null } }).lean(),
  ]);
  const activeIds = new Set(users.map(u => String(u._id)));
  const matches = new Map<string, Set<string>>();
  const add = (email: string, id: string) => { const key = normalizeReportEmail(email); const set = matches.get(key) || new Set<string>(); set.add(id); matches.set(key, set); };
  for (const u of users) if (u.emailVerified) add(u.email, String(u._id));
  for (const a of aliases) if (activeIds.has(String(a.userId))) add(a.email, String(a.userId));
  const regsByUser = new Map(regs.map(r => [String(r.userId), r]));
  const results = report.rows.map(row => {
    const owners = matches.get(row.email);
    const userId = owners?.size === 1 ? [...owners][0] : '';
    const reg = regsByUser.get(userId);
    let reason = owners && owners.size > 1 ? 'Ambiguous email; needs verification' : !reg ? 'No matching verified member email; needs verification' : ['CANCELLED', 'REJECTED', 'WAITLISTED', 'PENDING_APPROVAL'].includes(reg.status) ? 'Registration is not confirmed' : '';
    if (report.kind === 'ATTENDANCE' && ((isMultiDayEvent(event) && !row.day) || (row.day && (!reportDayNumber(event, row.day) || cancelledEventDays(event).includes(reportDayNumber(event, row.day)))))) reason = 'Attendance day is outside the active event schedule';
    if (report.kind === 'ATTENDANCE' && reg?.certificateIssued) reason = 'Certificate already issued; record kept unchanged';
    if (report.kind === 'ATTENDANCE' && reg?.checkInAt && reg.attendanceEvidence !== 'ORGANIZER_IMPORT') reason = 'GuildOS attendance already exists; record kept unchanged';
    if (report.kind === 'ATTENDANCE' && row.minutes === 0) reason = 'Zero attendance duration';
    if (report.kind === 'ATTENDANCE' && row.minutes === null && event.minimumAttendanceDuration > 0) reason = 'Duration is required by this event';
    return { ...row, registrationId: reg ? String(reg._id) : '', matched: !reason, reason };
  });
  return { reportId: String(report._id), filename: report.filename, kind: report.kind, appliedAt: report.appliedAt, evidence: 'Organizer reported', matched: results.filter(r => r.matched).length, needsReview: results.filter(r => !r.matched).length, rows: results };
}

export async function applyExternalReport(eventId: string, actorId: string, reportId: string) {
  const event = await requireEventManager(eventId, actorId);
  if (event.status === 'ARCHIVED') throw new Error('Event is archived');
  const preview = await inspectExternalReport(eventId, actorId, reportId);
  if (preview.kind === 'ATTENDANCE' && (event.attendanceSource !== 'EXTERNAL' || !event.endDate || event.endDate.getTime() > Date.now())) throw new Error('External attendance can only be applied after the event ends');
  const grouped = new Map<string, typeof preview.rows>();
  for (const row of preview.rows.filter(r => r.matched)) grouped.set(row.registrationId, [...(grouped.get(row.registrationId) || []), row]);
  let applied = 0;
  let conflicts = 0;
  for (const [registrationId, rows] of grouped) {
    const registration = await EventRegistrationModel.findOne({ _id: registrationId, eventId, status: { $in: ['CONFIRMED', 'NO_SHOW', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'] } });
    if (!registration) { conflicts += rows.length; continue; }
    const previousStatus = registration.status;
    const previousUpdatedAt = registration.updatedAt;
    if (preview.kind === 'REGISTRATION') registration.externalRegistrationConfirmedAt ||= new Date();
    else {
      if (registration.certificateIssued || (registration.checkInAt && registration.attendanceEvidence !== 'ORGANIZER_IMPORT')) continue;
      const entries = new Map((registration.externalAttendance || []).map(r => [r.day, r.minutes]));
      for (const row of rows) {
        const day = row.day || (event.startDate ? dayKeyOf(event.startDate, event.timezone) : '');
        const old = entries.get(day);
        entries.set(day, row.minutes === null ? old ?? null : Math.max(old ?? 0, row.minutes));
      }
      registration.externalAttendance = [...entries].map(([day, minutes]) => ({ day, minutes }));
      registration.attendanceMinutes = [...entries.values()].reduce<number>((sum, n) => sum + (n || 0), 0);
      const covered = await ticketCoveredDays(event, String(registration.userId), String(registration._id));
      const cancelled = new Set(cancelledEventDays(event));
      const required = covered ? Math.max(1, Math.min(requiredAttendanceDays(event), covered.filter(d => !cancelled.has(d)).length)) : requiredAttendanceDays(event);
      const validDays = [...entries.keys()].filter(day => {
        const n = reportDayNumber(event, day);
        return n > 0 && !cancelled.has(n) && (!covered || covered.includes(n));
      });
      registration.attendanceMinutes = validDays.reduce((sum, day) => sum + (entries.get(day) || 0), 0);
      const complete = validDays.length > 0 && (!isMultiDayEvent(event) || validDays.length >= required) && registration.attendanceMinutes >= (event.minimumAttendanceDuration || 0);
      registration.status = complete ? 'COMPLETED' : 'PARTIAL_ATTENDANCE';
      registration.certificateEligible = complete;
      registration.attendanceEvidence = 'ORGANIZER_IMPORT';
      registration.attendanceVerified = false;
      registration.externalReportId = reportId as any;
    }
    // Do not overwrite a concurrent cancellation, issued certificate or another import.
    const fields = preview.kind === 'REGISTRATION'
      ? { externalRegistrationConfirmedAt: registration.externalRegistrationConfirmedAt }
      : { externalAttendance: registration.externalAttendance, attendanceMinutes: registration.attendanceMinutes, status: registration.status,
          certificateEligible: registration.certificateEligible, attendanceEvidence: registration.attendanceEvidence,
          attendanceVerified: false, externalReportId: registration.externalReportId };
    const saved = await EventRegistrationModel.updateOne({
      _id: registration._id, eventId, status: previousStatus,
      updatedAt: previousUpdatedAt ?? { $exists: false },
      ...(preview.kind === 'ATTENDANCE' ? { certificateIssued: false } : {}),
    }, { $set: fields });
    if (!saved.modifiedCount) { conflicts += rows.length; continue; }
    applied++;
  }
  await ExternalReportModel.updateOne({ _id: reportId, eventId }, { $set: { appliedAt: new Date() } });
  await recalcEventCounters(eventId);
  return { applied, needsReview: preview.needsReview + conflicts, conflicts, reportId };
}
export async function listExternalReports(eventId: string, actorId: string) {
  await requireEventManager(eventId, actorId);
  return ExternalReportModel.find({ eventId }).select('_id kind filename appliedAt createdAt').sort({ createdAt: -1 }).limit(30).lean();
}
