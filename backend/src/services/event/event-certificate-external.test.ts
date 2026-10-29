vi.mock('./event-capacity.service',()=>({withEventMutation:vi.fn(async(_id:string,work:()=>Promise<unknown>)=>work())}));
vi.mock('./event-ticket.service',()=>({ticketCoveredDays:vi.fn(async()=>null)}));
vi.mock('../../models/user.model',()=>({UserModel:{findOne:vi.fn(async()=>({fullName:'Attendee',email:'',profile:{}}))}}));
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ event: {} as any, registrations: [] as any[] }));
vi.mock('./event-shared', () => ({ requireEventManager: async () => state.event, isMultiDayEvent: () => false, distinctDaysAttended: () => 0, eventTotalDays: () => 1,requiredAttendanceDays:()=>1,cancelledEventDays:()=>[],dayKeyOf:(date:Date)=>date.toISOString().slice(0,10) }));
vi.mock('./event-registration.service', () => ({ sendEventAppreciation: vi.fn() }));
vi.mock('../../models/community.model', () => ({ CommunityModel: { findById: () => ({ lean: async () => ({ name: 'Test community', slug: 'test', verificationStatus: 'VERIFIED' }) }) } }));
vi.mock('../../models/event-registration.model', () => ({ EventRegistrationModel: { findOne:vi.fn(async(q:any)=>state.registrations.find(r=>r._id===q._id)), find: vi.fn(async (q: any) => state.registrations.filter(r => r.status === q.status && !r.certificateIssued && (!q.certificateEligible || r.certificateEligible) && (!q.attendanceEvidence || r.attendanceEvidence === q.attendanceEvidence) && (!q['externalAttendance.0'] || r.externalAttendance?.length))) } }));
vi.mock('../../models/certificate.model', () => ({ CertificateModel: { findOne: vi.fn(async () => null), exists: vi.fn(async () => false), create: vi.fn(async (v: any) => ({ ...v, _id: 'cert' })), countDocuments: vi.fn(async () => 1) } }));
vi.mock('../../store/auth-store', () => ({ authStore: { getPublicUserById: async () => ({ fullName: 'Attendee', email: '', profile: {} }) } }));
vi.mock('../domain-activity.service', () => ({ buildDomainActivityRecord: vi.fn(async () => {}) }));
vi.mock('../feed.service', () => ({ createMilestonePost: vi.fn(async () => {}) }));
vi.mock('../notification.service', () => ({ createNotification: vi.fn(async () => {}) }));
vi.mock('../reputation.service', () => ({ recalculateReputation: vi.fn() }));
vi.mock('../../utils/email', () => ({ sendEmail: vi.fn(), certificateEarnedEmail: vi.fn() }));
import { EventModel } from '../../models/event.model';
import { CertificateModel } from '../../models/certificate.model';
import { issueEventCertificates } from './event-certificate.service';
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(EventModel, 'updateOne').mockResolvedValue({} as any);
  state.event = { attendanceSource: 'EXTERNAL', startDate:new Date('2026-10-27T00:00:00Z'),endDate: new Date('2026-10-27T23:00:00Z'), certificateEnabled: true, communityId: 'community', title: 'Event' };
  state.registrations = [];
});
describe('certificates from external attendance', () => {
  it('issues only for a completed, eligible attendee with matched report evidence', async () => {
    const base = { userId: 'member', status: 'COMPLETED', certificateIssued: false, certificateEligible: true, attendanceEvidence: 'ORGANIZER_IMPORT', externalAttendance: [{ day:'2026-10-27', minutes:45 }], save: vi.fn(async () => {}) };
    state.registrations = [
      { ...base, _id:'valid' },
      { ...base, _id:'unmatched', status:'CONFIRMED', certificateEligible:false, externalAttendance:[] },
      { ...base, _id:'self-report-only', partnerFormCompletedAt:new Date(), externalAttendance:[] },
      { ...base, _id:'ineligible', certificateEligible:false },
      { ...base, _id:'wrong-source', attendanceEvidence:'GUILDOS' },
      { ...base, _id:'partial', status:'PARTIAL_ATTENDANCE' },
    ];
    expect((await issueEventCertificates('event','organizer')).issued).toBe(1);
    expect(CertificateModel.create).toHaveBeenCalledTimes(1);
    expect(CertificateModel.create).toHaveBeenCalledWith(expect.objectContaining({ registrationId:'valid', attendanceEvidence:'ORGANIZER_IMPORT' }));
  });
  it('cannot issue external attendance certificates before the event ends', async () => {
    state.event.endDate = new Date(Date.now()+60000);
    await expect(issueEventCertificates('event','organizer')).rejects.toThrow(/event ends/);
    expect(CertificateModel.create).not.toHaveBeenCalled();
  });
});
