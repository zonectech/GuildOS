import { EventModel } from '../../models/event.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { EventPartnershipModel } from '../../models/event-partnership.model';
import { CertificateModel } from '../../models/certificate.model';
import { CommunityModel } from '../../models/community.model';
import { ReputationActivityModel } from '../../models/reputation-activity.model';

export type StampRole = 'ATTENDED' | 'HOSTED' | 'CO_HOSTED';

export type AttendanceStamp = {
  role: StampRole;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  eventType: string;
  startDate: Date | null;
  timezone: string;
  /** The community the person was there with: the host for ATTENDED and HOSTED, their own for CO_HOSTED. */
  communityName: string;
  communitySlug: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  daysAttended: number;
  /** SCANNED at the door, or REPORTED by the organizer from another site's attendance report. */
  evidence: 'SCANNED' | 'REPORTED';
  /** How many people attended, for HOSTED and CO_HOSTED stamps. */
  attendedCount: number;
  certificateSerial: string | null;
};

/**
 * One stamp per event a person fully attended (scanned in and out), certificate or not, plus one
 * for each event they hosted or co-hosted. Hosting stamps follow the points ledger, so they go to
 * the people who earned the points: the event's creator and the partner leader who accepted.
 */
export async function listAttendanceStamps(userId: string, limit = 100): Promise<AttendanceStamp[]> {
  const [registrations, awards] = await Promise.all([
    EventRegistrationModel.find({ userId, status: 'COMPLETED' }).sort({ checkOutAt: -1 }).limit(limit)
      .select('eventId checkInAt checkOutAt attendanceDays attendanceEvidence').lean(),
    ReputationActivityModel.find({ userId, type: { $in: ['EVENT_ORGANIZED', 'PARTNERSHIP_HOSTED'] } }).sort({ createdAt: -1 }).limit(limit)
      .select('type referenceId communityId').lean(),
  ]);

  const partnershipIds = awards.filter((a) => a.type === 'PARTNERSHIP_HOSTED' && a.referenceId).map((a) => a.referenceId);
  const partnerships = partnershipIds.length
    ? await EventPartnershipModel.find({ _id: { $in: partnershipIds }, status: 'ACCEPTED' }).select('eventId communityId').lean()
    : [];
  const partnershipById = new Map(partnerships.map((p) => [String(p._id), p]));

  type Hosting = { role: StampRole; eventId: string; communityId: string };
  const hosting: Hosting[] = awards.flatMap((a): Hosting[] => {
    if (a.type === 'EVENT_ORGANIZED' && a.referenceId) return [{ role: 'HOSTED', eventId: String(a.referenceId), communityId: '' }];
    const p = a.referenceId ? partnershipById.get(String(a.referenceId)) : undefined;
    return p ? [{ role: 'CO_HOSTED', eventId: String(p.eventId), communityId: String(p.communityId) }] : [];
  });

  const eventIds = [...new Set([...registrations.map((r) => String(r.eventId)), ...hosting.map((h) => h.eventId)])];
  if (!eventIds.length) return [];
  const [events, certificates] = await Promise.all([
    EventModel.find({ _id: { $in: eventIds }, deletedAt: null }).select('title slug type startDate timezone communityId completedCount attendanceFinalizedAt').lean(),
    CertificateModel.find({ userId, eventId: { $in: eventIds }, status: 'VERIFIED' }).select('eventId serial').lean(),
  ]);
  const communityIds = [...new Set([...events.map((e) => String(e.communityId)), ...hosting.map((h) => h.communityId).filter(Boolean)])];
  const communities = await CommunityModel.find({ _id: { $in: communityIds } }).select('name slug').lean();
  const eventById = new Map(events.map((e) => [String(e._id), e]));
  const communityById = new Map(communities.map((c) => [String(c._id), c]));
  const serialByEvent = new Map(certificates.map((c) => [String(c.eventId), c.serial]));

  const base = (event: (typeof events)[number], role: StampRole, communityId: string) => {
    const community = communityById.get(communityId);
    return {
      role,
      eventId: String(event._id),
      eventTitle: event.title,
      eventSlug: event.slug,
      eventType: event.type,
      startDate: event.startDate ?? null,
      timezone: event.timezone || 'Africa/Lagos',
      communityName: community?.name ?? '',
      communitySlug: community?.slug ?? '',
      attendedCount: event.completedCount ?? 0,
    };
  };

  const attended: AttendanceStamp[] = registrations.flatMap((r) => {
    const event = eventById.get(String(r.eventId));
    // A stamp exists only once the organizer has finalized attendance for that event.
    if (!event || !event.attendanceFinalizedAt) return [];
    const days = new Set((r.attendanceDays ?? []).filter((d) => d.checkInAt && d.checkOutAt).map((d) => d.day));
    return [{
      ...base(event, 'ATTENDED', String(event.communityId)),
      evidence: r.attendanceEvidence === 'ORGANIZER_IMPORT' ? 'REPORTED' : 'SCANNED',
      checkInAt: r.checkInAt ?? null,
      checkOutAt: r.checkOutAt ?? null,
      daysAttended: Math.max(1, days.size),
      certificateSerial: serialByEvent.get(String(event._id)) ?? null,
    }];
  });
  const seen = new Set<string>();
  const hosted: AttendanceStamp[] = hosting.flatMap((h) => {
    const event = eventById.get(h.eventId);
    const key = `${h.role}:${h.eventId}`;
    if (!event || seen.has(key)) return [];
    seen.add(key);
    return [{ ...base(event, h.role, h.role === 'CO_HOSTED' ? h.communityId : String(event.communityId)), evidence: 'SCANNED', checkInAt: null, checkOutAt: null, daysAttended: 0, certificateSerial: null }];
  });

  // Newest event first, whatever the role.
  const time = (s: AttendanceStamp) => (s.startDate ? new Date(s.startDate).getTime() : 0);
  return [...attended, ...hosted].sort((a, b) => time(b) - time(a)).slice(0, limit);
}
