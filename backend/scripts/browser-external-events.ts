/** Local-only browser fixture: no database connection, email delivery or production API calls. */
import express from 'express';
import cors from 'cors';
import { EventModel } from '../src/models/event.model';
import { EventRegistrationModel } from '../src/models/event-registration.model';
import { ExternalReportModel } from '../src/models/external-report.model';
import { MemberEmailModel } from '../src/models/member-email.model';
import { UserModel } from '../src/models/user.model';
import { MembershipModel } from '../src/models/membership.model';
import { EventPartnershipModel } from '../src/models/event-partnership.model';
import { TicketPaymentModel } from '../src/models/ticket-payment.model';
import { previewExternalReport, inspectExternalReport, applyExternalReport, listExternalReports } from '../src/services/event/external-report.service';
import { getPublicEventParticipation } from '../src/services/event/event-public-participation';
import { getEventAnalytics } from '../src/services/event/event-analytics.service';
import { extractEventPage, publicEventUrl } from '../src/services/event/external-event-link';
if (process.env.NODE_ENV === 'production') throw new Error('The sample browser API cannot run in production');
const app = express(); app.use(cors({ origin: 'http://127.0.0.1:4300', credentials: true })); app.use(express.json({ limit: '3mb' }));
const eventId = '111111111111111111111111', actorId = '222222222222222222222222', communityId = '333333333333333333333333';
const users = [{ _id: actorId, id: actorId, fullName: 'Ada Browser Tester', email: 'ada@example.edu', emailVerified: true, status: 'ACTIVE', deletedAt: null, role: 'COMMUNITY_LEADER', profileComplete: true, communityAccessStatus: 'APPROVED', profile: { username: 'browser_tester', avatar: '', socialLinks: [], interests: [], skills: [], university: 'Test University', department: 'Computing' } }];
const event: any = { _id: eventId, communityId, title: 'Campus AI Workshop — Browser Test', slug: 'browser-test-event', type: 'WORKSHOP', mode: 'VIRTUAL', description: 'A local test event for external registration and attendance.', shortDescription: 'A local test event.', startDate: new Date('2026-01-10T09:00:00Z'), endDate: new Date('2026-01-10T12:00:00Z'), timezone: 'Africa/Lagos', status: 'PUBLISHED', attendanceSource: 'EXTERNAL', partnerRegistrationUrl: 'http://127.0.0.1:4301/partner-registration', partnerRegistrationLabel: 'Test platform', certificateEnabled: true, certificateMode: 'STANDARD', certificateType: 'ATTENDANCE', minimumAttendanceDuration: 30, minimumAttendanceDays: 0, registrationPolicy: 'OPEN', capacity: 100, registrationCount: 1, checkedInCount: 0, completedCount: 0, certificatesIssued: 0, days: [], sections: [], contacts: [], features: [], partners: [], tags: [], gallery: [], sponsorshipPackages: [], registrationQuestions: [], ticketTiers: [], ticketPrice: 0, venue: '', address: '', bannerImage: '', meetingLink: '', attendeeChatLink: '', qrEnabled: false, allowWalkIns: false, checkOutRequired: true, visibility: 'PUBLIC', createdBy: actorId };
const regs: any[] = []; const reports: any[] = [];
let scenario = 'external';
const query = (value: any): any => ({ lean: async () => value, select: () => query(value), sort: () => query(value), limit: () => query(value), then: (ok: any, fail: any) => Promise.resolve(value).then(ok, fail) });
(EventModel as any).findOne = () => query(event);
(EventModel as any).updateOne = async (_q: any, update: any) => { Object.assign(event, update.$set || update); return {}; };
(EventPartnershipModel as any).find = () => query([]);
(MembershipModel as any).find = () => query([{ role: 'COORDINATOR', communityId, status: 'ACTIVE' }]);
(UserModel as any).find = () => query(users);
(UserModel as any).findById = (id: string) => query(users.find(u => u.id === id) || null);
(MemberEmailModel as any).find = () => query([]);
(TicketPaymentModel as any).find = () => query([]);
(EventRegistrationModel as any).find = (q: any) => query(q?.$or ? regs.filter(r => r.checkOutAt || r.externalAttendance.length) : regs);
(EventRegistrationModel as any).updateOne = async (q: any, update: any) => { const r = regs.find(v => v._id === q._id); if (!r) return { modifiedCount: 0 }; Object.assign(r, update.$set); return { modifiedCount: 1 }; };
(EventRegistrationModel as any).findOne = (q: any) => query(regs.find(r => !q._id || r._id === q._id) || null);
(EventRegistrationModel as any).countDocuments = async (q: any) => regs.filter(r => (!q.status || (typeof q.status === 'string' ? r.status === q.status : q.status.$in.includes(r.status))) && (!q.registrationType || r.registrationType === q.registrationType) && (!q.attendanceEvidence || r.attendanceEvidence === q.attendanceEvidence) && (!q.$or || r.checkInAt || r.externalAttendance?.length)).length;
(ExternalReportModel as any).findOne = (q: any) => query(reports.find(r => r._id === q._id) || null);
(ExternalReportModel as any).find = () => query(reports.map(({ rows, ...r }) => r));
(ExternalReportModel as any).findOneAndUpdate = async (q: any, update: any) => { let report = reports.find(r => r.hash === q.hash && r.kind === q.kind); if (!report) { report = { _id: String(reports.length + 1).padStart(24, '0'), ...update.$setOnInsert, createdAt: new Date(), appliedAt: null }; reports.push(report); } return report; };
(ExternalReportModel as any).updateOne = async (q: any, update: any) => Object.assign(reports.find(r => r._id === q._id), update.$set);
app.get('/__test/scenario/:name', (req, res) => {
  scenario = req.params.name; regs.length = 0; reports.length = 0;
  event.title = 'Campus AI Workshop — Browser Test'; event.tags = ['AI', 'Careers'];
  event.partnerRegistrationUrl = scenario === 'external' ? 'http://127.0.0.1:4301/partner-registration' : '';
  event.attendanceSource = scenario === 'imported' || scenario === 'external' ? 'EXTERNAL' : 'GUILDOS';
  event.startDate = new Date(Date.now() + 86400000); event.endDate = new Date(Date.now() + 86400000 + 7200000);
  event.attendanceFinalizedAt = null; event.registrationCount = 0;
  if (scenario === 'finalized' || scenario === 'imported') {
    event.startDate = new Date(Date.now() - 10800000); event.endDate = new Date(Date.now() - 3600000); event.attendanceFinalizedAt = new Date();
    regs.push({ _id: '444444444444444444444444', eventId, userId: actorId, communityId, registrationType: 'OPEN', status: 'COMPLETED', registeredAt: new Date(), checkInAt: scenario === 'imported' ? null : new Date(), attendanceEvidence: scenario === 'imported' ? 'ORGANIZER_IMPORT' : 'GUILDOS', externalAttendance: scenario === 'imported' ? [{ day: '2026-01-10', minutes: 45 }] : [], attendanceDays: [], attendanceMinutes: 45, certificateEligible: true });
    regs.push({ _id: '555555555555555555555555', eventId, userId: '666666666666666666666666', status: 'NO_SHOW', externalAttendance: [] }); event.registrationCount = 2;
  }
  res.cookie('guildos_session', 'COMMUNITY_LEADER', { sameSite: 'lax' });
  res.type('html').send('<h1>Sample scenario: ' + scenario + '</h1><p>Isolated sample data only.</p><a href="http://127.0.0.1:4300/events/browser-test-event">Open test event</a>');
});
app.get('/__test/session', (_req, res) => { res.cookie('guildos_session', 'COMMUNITY_LEADER', { sameSite: 'lax' }); res.type('html').send('<h1>Isolated GuildOS browser test</h1><p>Sample data only. No production database or email delivery.</p><a href="http://127.0.0.1:4300/dashboard/events/create?communityId=' + communityId + '">Open event creation</a>'); });
app.get('/partner-registration', (_req, res) => res.type('html').send('<h1>External registration handoff reached</h1><p>This local fixture confirms the GuildOS redirect. It does not submit a third-party registration.</p><a href="http://127.0.0.1:4300/events/browser-test-event">Return to GuildOS</a>'));
app.use(async (req, res) => { try {
  const p = req.path;
  if (p === '/api/community-access/me') return res.json({ status: 'APPROVED', hasAccess: true, canCreate: true });
  if (p === '/api/auth/me' || p === '/api/profile') return res.json({ user: users[0] });
  if (p.includes('/communities') && p.endsWith('/premium/status')) return res.json({ isPremium: false, paymentsEnabled: false });
  if (p === '/api/communities/managed' || p === '/api/communities/manage') return res.json({ communities: [{ _id: communityId, name: 'Browser Test Community', slug: 'browser-test-community', verificationStatus: 'VERIFIED', role: 'COORDINATOR' }] });
  if (p.endsWith('/ticket-settings')) return res.json({ commissionPercent: 0 });
  if (p === '/api/events') return res.json({ events: [event, { ...event, _id: '777777777777777777777777', slug: 'related-ai-workshop', title: 'Practical AI on Campus', communityId: 'another', startDate: new Date(Date.now() + 172800000), endDate: new Date(Date.now() + 180000000), attendanceFinalizedAt: null }, { ...event, _id: '888888888888888888888888', slug: 'unrelated-sports-meetup', title: 'Campus Sports Meetup', type: 'MEETUP', tags: ['Sports'], communityId: 'sports', startDate: new Date(Date.now() + 86400000), endDate: new Date(Date.now() + 90000000), attendanceFinalizedAt: null }] });
  if (p === '/api/events/bookmarks/mine') return res.json({ events: [] });
  if (p === '/api/events/import-link') {
    publicEventUrl(req.body.url);
    return res.json(extractEventPage('<script type="application/ld+json">' + JSON.stringify({ '@type': 'Event', name: 'Imported Campus Workshop', description: 'Learn practical AI with your campus community.', startDate: '2026-01-10T10:00:00+01:00', endDate: '2026-01-10T13:00:00+01:00', location: { '@type': 'VirtualLocation' } }) + '</script>', req.body.url));
  }
  if (p === '/api/events/member-emails') return res.json({ emails: [] });
  if (p === '/api/events/member-emails/request') return res.status(400).json({ error: 'Email delivery is disabled in this isolated browser test.' });
  if (p.endsWith('/external-reports/preview')) return res.json(await previewExternalReport(eventId, actorId, req.body));
  if (/\/external-reports\/[^/]+\/apply$/.test(p)) return res.json(await applyExternalReport(eventId, actorId, p.split('/').at(-2)!));
  if (/\/external-reports\/[^/]+$/.test(p)) return res.json(await inspectExternalReport(eventId, actorId, p.split('/').at(-1)!));
  if (p.endsWith('/external-reports')) return res.json({ reports: await listExternalReports(eventId, actorId) });
  if (p.endsWith('/registrations')) return res.json({ registrations: regs.map(registration => ({ registration, user: users[0] })), sections: [], partnerForm: { url: event.partnerRegistrationUrl, label: event.partnerRegistrationLabel }, attendanceSource: 'EXTERNAL' });
  if (p.endsWith('/analytics')) return res.json({ analytics: await getEventAnalytics(eventId, actorId) });
  if (p.endsWith('/register')) {
    if (!regs.length) regs.push({ _id: '444444444444444444444444', eventId, userId: actorId, communityId, status: scenario === 'waitlist' ? 'WAITLISTED' : scenario === 'approval' ? 'PENDING_APPROVAL' : 'CONFIRMED', registrationType: 'OPEN', registeredAt: new Date(), qrToken: 'LOCAL-TEST-PASS', checkInAt: null, checkOutAt: null, attendanceDays: [], externalAttendance: [], attendanceMinutes: 0, attendanceEvidence: 'GUILDOS', certificateEligible: false, certificateIssued: false, save: async () => {} });
    event.registrationCount = regs.filter(r => r.status === 'CONFIRMED').length;
    return res.json({ registration: regs[0] });
  }
  if (p.endsWith('/partner-opened')) { if (regs[0]) regs[0].partnerRegistrationOpenedAt = new Date(); return res.json({ openedAt: new Date() }); }
  if (p.endsWith('/partner-form')) { if (regs[0]) regs[0].partnerFormCompletedAt = req.body.done ? new Date() : null; return res.json({ registration: regs[0] }); }
  if (p === '/api/events/browser-test-event') return res.json({ event, participation: await getPublicEventParticipation(event), speakers: [], sponsors: [], community: { id: communityId, name: 'Browser Test Community', slug: 'browser-test-community', verificationStatus: 'VERIFIED', logo: '' }, coHosts: [], viewerRegistration: regs[0] || null, canManage: scenario === 'external', feedback: { average: 0, count: 0 }, viewerCanRate: false, viewerFeedback: null });
  if (p.includes('notifications')) return res.json({ notifications: [], unreadCount: 0 });
  if (p.includes('unread')) return res.json({ unreadCount: 0, count: 0 });
  if (p.includes('communities')) return res.json({ communities: [{ _id: communityId, name: 'Browser Test Community', slug: 'browser-test-community', role: 'COORDINATOR', verificationStatus: 'VERIFIED' }] });
  return res.json({});
} catch (e) { return res.status(400).json({ error: e instanceof Error ? e.message : 'Test fixture request failed' }); } });
app.listen(4301, '127.0.0.1', () => console.log('Isolated browser fixture ready on http://127.0.0.1:4301/__test/session'));
