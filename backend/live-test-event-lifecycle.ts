/**
 * Live E2E test — the FULL event lifecycle, beginning to end.
 *
 * Walks the entire journey against the live backend API (http://localhost:3001):
 *
 *   1. DRAFT      create with theme/features/contacts/partners/certificates/sponsorship
 *   2. PUBLISH    draft hidden → published visible with all new fields
 *   3. COLLAB     co-host invite→accept · speaker · volunteer · sponsorship inquiry→WON sponsor
 *   4. REGISTER   open registration, duplicate-safe, QR pass issued
 *   5. LIVE       open check-in · QR check-in by token · walk-in · live attendance stats
 *   6. CHECK-OUT  attendee completes (stayed to end) → +10 Guild Score
 *   7. FINALIZE   no-show/partial sweep · organizer/partner/sponsor/speaker/volunteer awards
 *   8. CERTIFY    issue certificates · AUTO appreciation · public verify incl. partners/co-hosts
 *   9. SCORES     Guild Score ledger adds up for every role
 *
 * Throwaway users/communities are seeded directly in the DB and removed afterwards.
 * Run:  npx tsx --env-file=.env live-test-event-lifecycle.ts
 */
import './src/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { createToken } from './src/utils/token';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { EventModel } from './src/models/event.model';
import { EventPartnershipModel } from './src/models/event-partnership.model';
import { EventSponsorModel } from './src/models/event-sponsor.model';
import { EventSpeakerModel } from './src/models/event-speaker.model';
import { EventVolunteerModel } from './src/models/event-volunteer.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { CertificateModel } from './src/models/certificate.model';
import { EventFeedbackModel } from './src/models/event-feedback.model';
import { NotificationModel } from './src/models/notification.model';
import { ReputationActivityModel } from './src/models/reputation-activity.model';
import { ReputationScoreModel } from './src/models/reputation-score.model';
import { SponsorshipInquiryModel } from './src/models/sponsorship-inquiry.model';
import { PostModel } from './src/models/post.model';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3001';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail !== undefined ? `  ->  ${JSON.stringify(detail)}` : ''}`);
  }
}

function stage(title: string) {
  console.log(`\n\x1b[36m── ${title} ──\x1b[0m`);
}

type ApiResult = { status: number; json: any };
async function api(method: string, path: string, token?: string, body?: unknown): Promise<ApiResult> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

async function makeUser(fullName: string): Promise<string> {
  const rnd = crypto.randomBytes(6).toString('hex');
  const user = await UserModel.create({
    fullName,
    email: `e2e-${rnd}@e2etest.local`,
    passwordHash: crypto.randomBytes(16).toString('hex'),
    passwordSalt: crypto.randomBytes(16).toString('hex'),
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
    profile: { username: `e2e_${rnd}`, university: 'E2E Test University' },
  } as any);
  return user._id.toString();
}

async function makeCommunity(name: string, slug: string, founderId: string) {
  const community = await CommunityModel.create({
    name,
    slug,
    shortDescription: 'Throwaway community for the E2E lifecycle test.',
    logo: '/uploads/demo-org-logo.svg',
    coverImage: '/uploads/smoke-cover.png',
    category: 'TECH',
    university: 'E2E Test University',
    visibility: 'PUBLIC',
    verificationStatus: 'VERIFIED',
    verificationMethod: 'MANUAL',
    verifiedBy: founderId,
    verifiedAt: new Date(),
    founder: founderId,
    memberCount: 1,
  });
  await MembershipModel.create({ userId: founderId, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: founderId });
  return community;
}

async function main() {
  console.log(`\n=== GuildOS FULL event lifecycle test :: ${BASE} ===`);
  await connectDatabase();

  const health = await api('GET', '/api/communities');
  if (health.status !== 200) {
    console.error(`Backend not reachable at ${BASE}. Is the dev server running?`);
    process.exit(1);
  }

  const stamp = Date.now();
  const organizerId = await makeUser('E2E Organizer');
  const partnerLeadId = await makeUser('E2E Partner Lead');
  const speakerId = await makeUser('E2E Speaker');
  const volunteerId = await makeUser('E2E Volunteer');
  const attendeeId = await makeUser('E2E Attendee');       // completes everything
  const noShowId = await makeUser('E2E NoShow');           // registers, never arrives
  const walkInId = await makeUser('E2E WalkIn');           // arrives unregistered, no checkout
  const tok = (id: string, tag: string) => createToken({ sub: id, purpose: 'access', jti: `e2e-${tag}-${stamp}` } as any, 3600_000);
  const orgTok = tok(organizerId, 'org');
  const partnerTok = tok(partnerLeadId, 'partner');
  const attendeeTok = tok(attendeeId, 'att');
  const noShowTok = tok(noShowId, 'noshow');
  const walkInTok = tok(walkInId, 'walkin');

  const host = await makeCommunity(`E2E Host Guild ${stamp}`, `e2e-host-${stamp}`, organizerId);
  const partner = await makeCommunity(`E2E Partner Guild ${stamp}`, `e2e-partner-${stamp}`, partnerLeadId);
  // Attendee is also a host-community member so announcements have a recipient.
  await MembershipModel.create({ userId: attendeeId, communityId: host._id, role: 'MEMBER', status: 'ACTIVE', assignedBy: organizerId });

  const userIds = [organizerId, partnerLeadId, speakerId, volunteerId, attendeeId, noShowId, walkInId].map(
    (id) => new mongoose.Types.ObjectId(id),
  );
  let eventId = '';
  let eventSlug = '';
  let clonedEventId = '';

  try {
    // ════ 1. DRAFT ════════════════════════════════════════════════
    stage('1. DRAFT — organizer creates the event with everything');
    const past = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
    const create = await api('POST', '/api/events', orgTok, {
      communityId: host._id.toString(),
      title: `E2E Grand Summit ${stamp}`,
      type: 'CONFERENCE',
      shortDescription: 'Full lifecycle test event',
      description: 'Every feature of the event pipeline exercised end to end.',
      theme: 'Everything, Everywhere, All at Once',
      features: ['Hands-on labs', 'Free Wi-Fi', 'Certificates', 'Networking'],
      contacts: [{ name: 'E2E Organizer', phone: '0801 234 5678', email: 'organizer@e2e.local' }],
      partners: [{ name: 'E2E TechCorp', logo: '/uploads/demo-org-logo.svg', website: 'https://techcorp.e2e' }],
      bannerImage: '/uploads/smoke-banner.png',
      mode: 'PHYSICAL',
      venue: 'E2E Hall',
      address: 'Test Campus',
      startDate: past(3),
      endDate: past(1), // already ended → checkout counts as "stayed to end"
      registrationPolicy: 'OPEN',
      capacity: 0,
      allowWalkIns: true,
      qrEnabled: true,
      certificateEnabled: true,
      certificateMode: 'STANDARD',
      certificateType: 'ATTENDANCE',
      appreciationMode: 'AUTO',
      minimumAttendanceDuration: 0,
      visibility: 'PUBLIC',
      sponsorshipOpen: true,
      sponsorshipPitch: 'Sponsor the E2E revolution',
      sponsorshipPackages: [{ name: 'Gold', price: '₦100,000', perks: ['LOGO_EVENT_PAGE'], benefits: 'Everything' }],
    });
    check('event created as DRAFT', create.status === 201 && create.json?.event?.status === 'DRAFT', create.status);
    eventId = create.json?.event?._id ?? '';
    eventSlug = create.json?.event?.slug ?? '';
    check('theme + features + contacts + partners all saved', 
      create.json?.event?.theme === 'Everything, Everywhere, All at Once' &&
      create.json?.event?.features?.length === 4 &&
      create.json?.event?.contacts?.length === 1 &&
      create.json?.event?.partners?.length === 1,
      { theme: create.json?.event?.theme, f: create.json?.event?.features?.length, c: create.json?.event?.contacts?.length, p: create.json?.event?.partners?.length });

    const anonDraft = await api('GET', `/api/events/${eventSlug}`);
    check('draft is HIDDEN from the public', anonDraft.status === 404, anonDraft.status);
    const orgDraft = await api('GET', `/api/events/${eventSlug}`, orgTok);
    check('draft IS visible to the organizer', orgDraft.status === 200 && orgDraft.json?.canManage === true, orgDraft.status);

    const publicList0 = await api('GET', `/api/events?communityId=${host._id}`);
    check('draft absent from public listings', !(publicList0.json?.events ?? []).some((e: any) => e._id === eventId));

    // ════ 2. PUBLISH ══════════════════════════════════════════════
    stage('2. PUBLISH');
    const publish = await api('POST', `/api/events/${eventId}/publish`, orgTok);
    check('publish -> PUBLISHED', publish.status === 200 && publish.json?.event?.status === 'PUBLISHED', publish.status);
    const publicView = await api('GET', `/api/events/${eventSlug}`);
    check('public page now shows the event with theme/features/contacts', 
      publicView.status === 200 && publicView.json?.event?.theme && publicView.json?.event?.features?.length === 4 && publicView.json?.event?.contacts?.length === 1,
      publicView.status);
    const publicList1 = await api('GET', `/api/events?communityId=${host._id}`);
    check('event appears in public listings', (publicList1.json?.events ?? []).some((e: any) => e._id === eventId));

    // ════ 3. COLLABORATION ════════════════════════════════════════
    stage('3. COLLABORATION — co-host, speaker, volunteer, sponsor');
    const invite = await api('POST', `/api/events/${eventId}/partnerships`, orgTok, { communitySlug: partner.slug });
    check('co-host invite sent', invite.status === 201, invite.status);
    const accept = await api('PATCH', `/api/events/partnerships/${invite.json?.partnership?._id}`, partnerTok, { action: 'ACCEPT' });
    check('partner founder accepts co-hosting', accept.status === 200 && accept.json?.partnership?.status === 'ACCEPTED', accept.status);

    const addSpeaker = await api('POST', `/api/events/${eventId}/speakers`, orgTok, {
      fullName: 'E2E Speaker', title: 'Keynote', speakerType: 'WORKSHOP', userId: speakerId,
    });
    check('linked speaker added', addSpeaker.status === 201 || addSpeaker.status === 200, addSpeaker.status);

    const addVolunteer = await api('POST', `/api/events/${eventId}/volunteers`, orgTok, { userId: volunteerId, role: 'Logistics' });
    check('volunteer credited', addVolunteer.status === 201 || addVolunteer.status === 200, addVolunteer.status);

    const inquiry = await api('POST', `/api/events/${eventId}/sponsorship/inquiries`, undefined, {
      companyName: 'E2E MegaBank', contactName: 'Bank Rep', email: 'rep@megabank.e2e', packageName: 'Gold', message: 'We want in!',
    });
    check('public sponsorship inquiry submitted', inquiry.status === 201, inquiry.status);
    const inquiryId = inquiry.json?.inquiry?._id ?? '';
    const convert = await api('POST', `/api/events/${eventId}/sponsorship/inquiries/${inquiryId}/convert`, orgTok, {
      packageWon: 'Gold', dealAmount: 100000,
    });
    check('inquiry converted -> WON sponsor', convert.status === 200, convert);
    const sponsorDoc = await EventSponsorModel.findOne({ eventId, name: 'E2E MegaBank' }).lean();
    check('EventSponsor listing created from the deal', !!sponsorDoc, sponsorDoc?.name);

    // ════ 4. REGISTRATION ═════════════════════════════════════════
    stage('4. REGISTRATION');
    const regA = await api('POST', `/api/events/${eventId}/register`, attendeeTok);
    check('attendee registers -> CONFIRMED + QR pass', regA.status === 201 && regA.json?.registration?.status === 'CONFIRMED' && !!regA.json?.registration?.qrToken, regA.status);
    const qrToken = regA.json?.registration?.qrToken ?? '';
    const registrationIdA = regA.json?.registration?._id ?? '';

    const regB = await api('POST', `/api/events/${eventId}/register`, noShowTok);
    check('second attendee registers (will no-show)', regB.status === 201, regB.status);

    const regDup = await api('POST', `/api/events/${eventId}/register`, attendeeTok);
    check('duplicate registration is idempotent', regDup.status === 201 && regDup.json?.registration?._id === registrationIdA, regDup.json?.registration?._id);

    // ════ 5. LIVE — check-in ══════════════════════════════════════
    stage('5. LIVE — doors open');
    const preCheckIn = await api('POST', `/api/events/check-in/${qrToken}`, orgTok);
    check('QR check-in blocked before doors open', preCheckIn.status >= 400, preCheckIn.status);

    const openDoors = await api('POST', `/api/events/${eventId}/status`, orgTok, { status: 'CHECK_IN' });
    check('organizer opens check-in', openDoors.status === 200 && openDoors.json?.event?.status === 'CHECK_IN', openDoors.status);

    const qrCheckIn = await api('POST', `/api/events/check-in/${qrToken}`, orgTok);
    check('attendee checked in by QR token', qrCheckIn.status === 200 && qrCheckIn.json?.registration?.status === 'CHECKED_IN', qrCheckIn);

    const walkIn = await api('POST', `/api/events/${eventId}/walk-in`, walkInTok);
    check('unregistered student walks in -> CHECKED_IN', walkIn.status === 201 && walkIn.json?.registration?.registrationType === 'WALK_IN', walkIn.status);

    const live = await api('GET', `/api/events/${eventId}/attendance/live`, orgTok);
    check('live dashboard: 2 checked in, 1 walk-in', live.json?.live?.checkedIn === 2 && live.json?.live?.walkIns === 1, live.json);

    // ════ 6. CHECK-OUT ════════════════════════════════════════════
    stage('6. CHECK-OUT — attendance completed');
    const checkout = await api('POST', `/api/events/${eventId}/registrations/${registrationIdA}/check-out`, orgTok);
    check('attendee checks out -> COMPLETED + certificate eligible', checkout.status === 200 && checkout.json?.registration?.status === 'COMPLETED' && checkout.json?.registration?.certificateEligible === true, checkout.json?.registration?.status);

    const attRep = await ReputationActivityModel.findOne({ userId: attendeeId, type: 'EVENT_COMPLETED' }).lean();
    check('attendee earned +10 Guild Score for completing', attRep?.scoreAwarded === 10, attRep?.scoreAwarded);

    // ════ 7. FINALIZE ═════════════════════════════════════════════
    stage('7. FINALIZE — sweep + awards');
    const finalize = await api('POST', `/api/events/${eventId}/finalize`, orgTok);
    check('finalize -> COMPLETED (1 no-show, 1 partial)', finalize.status === 200 && finalize.json?.noShows === 1 && finalize.json?.partials === 1, finalize.json);

    const [orgAward, partnerAward, sponsorAward, speakerAward, volunteerAward] = await Promise.all([
      ReputationActivityModel.findOne({ userId: organizerId, type: 'EVENT_ORGANIZED' }).lean(),
      ReputationActivityModel.findOne({ userId: partnerLeadId, type: 'PARTNERSHIP_HOSTED' }).lean(),
      ReputationActivityModel.findOne({ userId: organizerId, type: 'SPONSORSHIP_SECURED' }).lean(),
      ReputationActivityModel.findOne({ userId: speakerId, type: 'SPEAKER_CONTRIBUTION' }).lean(),
      ReputationActivityModel.findOne({ userId: volunteerId, type: 'VOLUNTEER_CONTRIBUTION' }).lean(),
    ]);
    check('organizer +50 (organized)', orgAward?.scoreAwarded === 50, orgAward?.scoreAwarded);
    check('partner leader +30 (co-hosted)', partnerAward?.scoreAwarded === 30, partnerAward?.scoreAwarded);
    check('organizer +20 (sponsorship secured)', sponsorAward?.scoreAwarded === 20, sponsorAward?.scoreAwarded);
    check('speaker +40 (workshop keynote)', speakerAward?.scoreAwarded === 40, speakerAward?.scoreAwarded);
    check('volunteer +20 (logistics)', volunteerAward?.scoreAwarded === 20, volunteerAward?.scoreAwarded);

    // ════ 8. CERTIFICATES ═════════════════════════════════════════
    stage('8. CERTIFICATES + APPRECIATION');
    const issue = await api('POST', `/api/events/${eventId}/issue-certificates`, orgTok);
    check('certificates issued to the 1 completed attendee', issue.status === 200 && issue.json?.issued === 1, issue.json);
    check('AUTO appreciation blast sent with the drop', issue.json?.appreciationSent === true, issue.json?.appreciationSent);

    const cert = await CertificateModel.findOne({ eventId }).lean();
    check('certificate persisted with attendee name', cert?.attendeeName === 'E2E Attendee', cert?.attendeeName);

    const verify = await api('GET', `/api/certificates/verify/${cert?.serial}`);
    check('public verification -> verified', verify.status === 200 && verify.json?.certificate?.verified === true, verify.status);
    check('certificate carries co-host community', verify.json?.certificate?.coHosts?.[0]?.name === partner.name, verify.json?.certificate?.coHosts);
    check('certificate carries partner logo (E2E TechCorp)', verify.json?.certificate?.partners?.[0]?.name === 'E2E TechCorp' && !!verify.json?.certificate?.partners?.[0]?.logo, verify.json?.certificate?.partners);
    check('sponsor NOT on certificate (no LOGO_CERTIFICATES perk)', (verify.json?.certificate?.sponsors ?? []).length === 0, verify.json?.certificate?.sponsors);

    const certNotif = await NotificationModel.findOne({ userId: attendeeId, type: 'CERTIFICATE_EARNED' }).lean();
    check('attendee got a certificate notification', !!certNotif, certNotif?.title);

    const noShowCert = await CertificateModel.findOne({ eventId, userId: noShowId }).lean();
    const walkInCert = await CertificateModel.findOne({ eventId, userId: walkInId }).lean();
    check('no-show and partial attendee got NO certificate', !noShowCert && !walkInCert);

    // ════ 9. FINAL SCORES ═════════════════════════════════════════
    stage('9. GUILD SCORES — the ledger adds up');
    const [orgScore, attScore] = await Promise.all([
      ReputationScoreModel.findOne({ userId: organizerId }).lean(),
      ReputationScoreModel.findOne({ userId: attendeeId }).lean(),
    ]);
    check('organizer Guild Score >= 70 (50 organized + 20 sponsorship)', (orgScore?.guildScore ?? 0) >= 70, orgScore?.guildScore);
    check('attendee Guild Score >= 10', (attScore?.guildScore ?? 0) >= 10, attScore?.guildScore);

    const myCerts = await api('GET', '/api/certificates/mine', attendeeTok);
    check('attendee sees the certificate in "my certificates"', (myCerts.json?.certificates ?? []).some((c: any) => c.serial === cert?.serial), myCerts.status);

    // ════ 10. FEEDBACK ═════════════════════════════════════════
    stage('10. FEEDBACK — attendees rate the event');
    const rate = await api('POST', `/api/events/${eventId}/feedback`, attendeeTok, { rating: 5, comment: 'Fantastic event!' });
    check('checked-in attendee rates 5★', rate.status === 200 && rate.json?.feedback?.rating === 5, rate);
    const noShowRate = await api('POST', `/api/events/${eventId}/feedback`, noShowTok, { rating: 1 });
    check('no-show cannot rate', noShowRate.status >= 400, noShowRate.status);
    const reRate = await api('POST', `/api/events/${eventId}/feedback`, attendeeTok, { rating: 4, comment: 'Actually 4 stars.' });
    const feedbackDocs = await EventFeedbackModel.countDocuments({ eventId });
    check('re-rating updates instead of duplicating', reRate.status === 200 && feedbackDocs === 1, feedbackDocs);
    const walkInRate = await api('POST', `/api/events/${eventId}/feedback`, walkInTok, { rating: 3 });
    check('walk-in (checked in) can rate too', walkInRate.status === 200, walkInRate.status);
    const orgSummary = await api('GET', `/api/events/${eventId}/feedback`, orgTok);
    check('organizer summary: 2 ratings, avg 3.5, comments visible', orgSummary.json?.feedback?.count === 2 && orgSummary.json?.feedback?.average === 3.5 && orgSummary.json?.feedback?.comments?.length === 1, orgSummary.json?.feedback);
    const publicRating = await api('GET', `/api/events/${eventSlug}`);
    check('public event page shows rating summary', publicRating.json?.feedback?.count === 2, publicRating.json?.feedback);

    // ════ 11. RUN IT AGAIN — clone ═════════════════════════════
    stage('11. RUN IT AGAIN — clone into a fresh draft');
    const clone = await api('POST', `/api/events/${eventId}/clone`, orgTok);
    check('clone -> 201 DRAFT', clone.status === 201 && clone.json?.event?.status === 'DRAFT', clone.status);
    clonedEventId = clone.json?.event?._id ?? '';
    check('clone copies content (theme/features/partners) but resets dates + counters',
      clone.json?.event?.theme === 'Everything, Everywhere, All at Once' &&
      clone.json?.event?.partners?.length === 1 &&
      clone.json?.event?.startDate === null &&
      clone.json?.event?.registrationCount === 0 &&
      clone.json?.event?.premiumUnlocked === false,
      { theme: clone.json?.event?.theme, start: clone.json?.event?.startDate });
    const clonedSpeakers = await EventSpeakerModel.countDocuments({ eventId: clonedEventId });
    check('speaker lineup copied to the clone', clonedSpeakers === 1, clonedSpeakers);
    const outsiderClone = await api('POST', `/api/events/${eventId}/clone`, attendeeTok);
    check('non-manager cannot clone', outsiderClone.status >= 400, outsiderClone.status);

    // ════ 12. ANNOUNCEMENT ═══════════════════════════════════
    stage('12. COMMUNITY ANNOUNCEMENT');
    const announce = await api('POST', `/api/communities/${host._id}/announce`, orgTok, { title: 'Next meeting', body: 'General meeting on Friday at 4pm, Lab 2.' });
    check('founder announces to members', announce.status === 200 && announce.json?.recipients === 1 && announce.json?.notified === 1, announce.json);
    const announceNotif = await NotificationModel.findOne({ userId: attendeeId, title: { $regex: 'Next meeting' } }).lean();
    check('member received the announcement notification', !!announceNotif, announceNotif?.title);
    const memberAnnounce = await api('POST', `/api/communities/${host._id}/announce`, attendeeTok, { title: 'Hack', body: 'nope' });
    check('plain member cannot announce -> 403', memberAnnounce.status === 403, memberAnnounce.status);

    // ════ 13. LINK PREVIEWS ══════════════════════════════════
    stage('13. CERTIFICATE LINK PREVIEWS (OG meta)');
    const before = (await CertificateModel.findOne({ serial: cert?.serial }).select('verificationCount').lean())?.verificationCount ?? 0;
    const meta = await api('GET', `/api/certificates/meta/${cert?.serial}`);
    check('meta endpoint returns preview fields', meta.status === 200 && meta.json?.certificate?.attendeeName === 'E2E Attendee' && !!meta.json?.certificate?.eventTitle, meta.json?.certificate);
    const after = (await CertificateModel.findOne({ serial: cert?.serial }).select('verificationCount').lean())?.verificationCount ?? 0;
    check('meta lookups never inflate verification counts', after === before, { before, after });
  } finally {
    // ── Teardown ────────────────────────────────────────────────
    console.log('\nCleaning up…');
    if (eventId) {
      await EventRegistrationModel.deleteMany({ eventId });
      await CertificateModel.deleteMany({ eventId });
      await EventPartnershipModel.deleteMany({ eventId });
      await EventSponsorModel.deleteMany({ eventId });
      await EventSpeakerModel.deleteMany({ eventId });
      await EventVolunteerModel.deleteMany({ eventId });
      await SponsorshipInquiryModel.deleteMany({ eventId });
      await EventFeedbackModel.deleteMany({ eventId });
      await EventModel.deleteOne({ _id: eventId });
    }
    if (clonedEventId) {
      await EventSpeakerModel.deleteMany({ eventId: clonedEventId });
      await EventModel.deleteOne({ _id: clonedEventId });
    }
    await PostModel.deleteMany({ userId: { $in: userIds } });
    await MembershipModel.deleteMany({ communityId: { $in: [host._id, partner._id] } });
    await CommunityModel.deleteMany({ _id: { $in: [host._id, partner._id] } });
    await NotificationModel.deleteMany({ userId: { $in: userIds } });
    await ReputationActivityModel.deleteMany({ userId: { $in: userIds } });
    await ReputationScoreModel.deleteMany({ userId: { $in: userIds } });
    await UserModel.deleteMany({ _id: { $in: userIds } });
    await mongoose.disconnect();
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failures.length) {
    console.log('Failures:', failures.join(' | '));
    process.exit(1);
  }
}

void main();
