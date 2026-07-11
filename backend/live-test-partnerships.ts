/**
 * Live test — Event partnerships (co-hosting + external partners).
 *
 * Exercises the partnership flow against the LIVE backend API (http://localhost:3001):
 *   create event with external partners → invite co-host community → permission
 *   checks (coordinator can't accept, VP can) → accepted co-host coordinator can
 *   manage the event → public event detail shows coHosts → certificate verify
 *   includes partners + coHosts → remove partnership.
 *
 * Throwaway users/communities are seeded directly in the DB and removed afterwards.
 * Run:  npx tsx --env-file=.env live-test-partnerships.ts
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
import { EventRegistrationModel } from './src/models/event-registration.model';
import { CertificateModel } from './src/models/certificate.model';
import { NotificationModel } from './src/models/notification.model';
import { ReputationActivityModel } from './src/models/reputation-activity.model';
import { ReputationScoreModel } from './src/models/reputation-score.model';

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

type ApiResult = { status: number; json: any };
async function api(method: string, path: string, token?: string, body?: unknown): Promise<ApiResult> {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
    email: `ptest-${rnd}@ptest.local`,
    passwordHash: crypto.randomBytes(16).toString('hex'),
    passwordSalt: crypto.randomBytes(16).toString('hex'),
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
    profile: { username: `ptest_${rnd}`, university: 'Partnership Test University' },
  } as any);
  return user._id.toString();
}

async function makeCommunity(name: string, slug: string, founderId: string) {
  const community = await CommunityModel.create({
    name,
    slug,
    shortDescription: 'Throwaway community for partnership live test.',
    logo: '/uploads/smoke-logo.png',
    coverImage: '/uploads/smoke-cover.png',
    category: 'TECH',
    university: 'Partnership Test University',
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
  console.log(`\n=== GuildOS partnership live test :: ${BASE} ===\n`);
  await connectDatabase();

  const health = await api('GET', '/api/communities');
  if (health.status !== 200) {
    console.error(`Backend not reachable at ${BASE}. Is the dev server running?`);
    process.exit(1);
  }

  const stamp = Date.now();
  const hostFounderId = await makeUser('Host Founder');
  const partnerFounderId = await makeUser('Partner Founder');
  const partnerCoordId = await makeUser('Partner Coordinator');
  const outsiderId = await makeUser('Random Outsider');
  const attendeeId = await makeUser('Partnership Attendee');
  const tok = (id: string, tag: string) => createToken({ sub: id, purpose: 'access', jti: `ptest-${tag}-${stamp}` } as any, 3600_000);
  const hostToken = tok(hostFounderId, 'host');
  const partnerToken = tok(partnerFounderId, 'partner');
  const coordToken = tok(partnerCoordId, 'coord');
  const outsiderToken = tok(outsiderId, 'out');
  const attendeeToken = tok(attendeeId, 'att');

  const hostCommunity = await makeCommunity(`Host Guild ${stamp}`, `host-guild-${stamp}`, hostFounderId);
  const partnerCommunity = await makeCommunity(`Partner Guild ${stamp}`, `partner-guild-${stamp}`, partnerFounderId);
  await MembershipModel.create({ userId: partnerCoordId, communityId: partnerCommunity._id, role: 'COORDINATOR', status: 'ACTIVE', assignedBy: partnerFounderId });

  const userIds = [hostFounderId, partnerFounderId, partnerCoordId, outsiderId, attendeeId].map((id) => new mongoose.Types.ObjectId(id));
  let eventId = '';
  let eventSlug = '';

  try {
    // ── EXTERNAL PARTNERS ────────────────────────────────────────
    console.log('EXTERNAL PARTNERS');
    const past = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
    const create = await api('POST', '/api/events', hostToken, {
      communityId: hostCommunity._id.toString(),
      title: `Partnership Summit ${stamp}`,
      shortDescription: 'Partnership live test event',
      mode: 'PHYSICAL',
      venue: 'Test Hall',
      bannerImage: '/uploads/smoke-banner.png',
      startDate: past(2),
      endDate: past(1),
      registrationPolicy: 'OPEN',
      capacity: 0,
      certificateEnabled: true,
      certificateMode: 'STANDARD',
      certificateType: 'ATTENDANCE',
      minimumAttendanceDuration: 0,
      visibility: 'PUBLIC',
      theme: 'AI for Social Good',
      features: ['Hands-on workshops', 'Free Wi-Fi', '', 'Certificates'],
      contacts: [
        { name: 'Amina Bello', phone: '0803 123 4567', email: 'amina@host.org' },
        { name: 'No Channel Person', phone: '', email: '' }, // dropped — no phone/email
      ],
      partners: [
        { name: 'TechCorp Nigeria', logo: '/uploads/demo-org-logo.svg', website: 'https://techcorp.example' },
        { name: '', logo: '/uploads/demo-org-logo.svg', website: 'https://ignored.example' }, // nameless -> dropped
        { name: 'No Logo Org', logo: '', website: 'https://nologo.example' }, // logo required -> dropped
      ],
    });
    check('create event with partners[] -> 201', create.status === 201 && !!create.json?.event?._id, create.status);
    eventId = create.json?.event?._id ?? '';
    eventSlug = create.json?.event?.slug ?? '';
    const savedPartners = create.json?.event?.partners ?? [];
    check('nameless + logo-less partners dropped, valid partner saved', savedPartners.length === 1 && savedPartners[0]?.name === 'TechCorp Nigeria', savedPartners);
    check('theme saved', create.json?.event?.theme === 'AI for Social Good', create.json?.event?.theme);
    check('features saved (empty lines dropped)', (create.json?.event?.features ?? []).length === 3, create.json?.event?.features);
    const savedContacts = create.json?.event?.contacts ?? [];
    check('contacts saved (channel-less contact dropped)', savedContacts.length === 1 && savedContacts[0]?.name === 'Amina Bello', savedContacts);

    const publish = await api('POST', `/api/events/${eventId}/publish`, hostToken);
    check('publish event -> PUBLISHED', publish.status === 200 && publish.json?.event?.status === 'PUBLISHED', publish.status);

    // ── CO-HOST INVITES ──────────────────────────────────────────
    console.log('\nCO-HOST INVITES');
    const selfInvite = await api('POST', `/api/events/${eventId}/partnerships`, hostToken, { communitySlug: hostCommunity.slug });
    check('inviting the host community itself -> 400', selfInvite.status === 400, selfInvite);

    const badSlug = await api('POST', `/api/events/${eventId}/partnerships`, hostToken, { communitySlug: 'does-not-exist-xyz' });
    check('inviting unknown community -> 404', badSlug.status === 404, badSlug);

    const outsiderInvite = await api('POST', `/api/events/${eventId}/partnerships`, outsiderToken, { communitySlug: partnerCommunity.slug });
    check('outsider cannot send invites -> 403', outsiderInvite.status === 403, outsiderInvite);

    const invite = await api('POST', `/api/events/${eventId}/partnerships`, hostToken, { communitySlug: partnerCommunity.slug });
    check('host invites partner community -> 201 PENDING', invite.status === 201 && invite.json?.partnership?.status === 'PENDING', invite);
    const partnershipId = invite.json?.partnership?._id ?? '';

    const dupInvite = await api('POST', `/api/events/${eventId}/partnerships`, hostToken, { communitySlug: partnerCommunity.slug });
    check('duplicate pending invite -> 400', dupInvite.status === 400, dupInvite);

    const notified = await NotificationModel.findOne({ userId: partnerFounderId, title: { $regex: 'Partnership invite' } }).lean();
    check('partner founder received invite notification', !!notified, notified?.title);

    const listAsHost = await api('GET', `/api/events/${eventId}/partnerships`, hostToken);
    check('GET partnerships as host manager -> 200 with 1 PENDING', listAsHost.status === 200 && listAsHost.json?.partnerships?.length === 1 && listAsHost.json.partnerships[0].status === 'PENDING', listAsHost.json);

    const viewAsPartner = await api('GET', `/api/events/${eventSlug}`, partnerToken);
    check('partner VP sees viewerPartnershipInvite on event page', viewAsPartner.json?.viewerPartnershipInvite?.partnershipId === partnershipId, viewAsPartner.json?.viewerPartnershipInvite);

    // ── ACCEPT / PERMISSIONS ─────────────────────────────────────
    console.log('\nACCEPT + PERMISSIONS');
    const coordAccept = await api('PATCH', `/api/events/partnerships/${partnershipId}`, coordToken, { action: 'ACCEPT' });
    check('coordinator (not VP+) cannot accept -> 4xx', coordAccept.status >= 400, coordAccept);

    const preManage = await api('PATCH', `/api/events/${eventId}`, coordToken, { shortDescription: 'should fail' });
    check('partner coordinator CANNOT manage before acceptance', preManage.status >= 400, preManage.status);

    const accept = await api('PATCH', `/api/events/partnerships/${partnershipId}`, partnerToken, { action: 'ACCEPT' });
    check('partner founder accepts -> ACCEPTED', accept.status === 200 && accept.json?.partnership?.status === 'ACCEPTED', accept);

    const publicView = await api('GET', `/api/events/${eventSlug}`);
    const coHosts = publicView.json?.coHosts ?? [];
    check('public event detail lists co-host community', coHosts.length === 1 && coHosts[0]?.name === partnerCommunity.name, coHosts);
    check('event partners[] visible on public detail', (publicView.json?.event?.partners ?? []).length === 1, publicView.json?.event?.partners);

    const postManage = await api('PATCH', `/api/events/${eventId}`, coordToken, { shortDescription: 'updated by co-host coordinator' });
    check('co-host coordinator still cannot EDIT (owner/VP+ rule, parity with host)', postManage.status === 403, postManage.status);

    const vpManage = await api('PATCH', `/api/events/${eventId}`, partnerToken, { shortDescription: 'updated by co-host VP' });
    check('co-host VP (founder) CAN edit event after acceptance', vpManage.status === 200 && vpManage.json?.event?.shortDescription === 'updated by co-host VP', vpManage.status);

    const analytics = await api('GET', `/api/events/${eventId}/analytics`, coordToken);
    check('co-host coordinator can view analytics', analytics.status === 200, analytics.status);

    const outsiderManage = await api('PATCH', `/api/events/${eventId}`, outsiderToken, { shortDescription: 'nope' });
    check('outsider still cannot manage -> 4xx', outsiderManage.status >= 400, outsiderManage.status);

    const reInvite = await api('POST', `/api/events/${eventId}/partnerships`, hostToken, { communitySlug: partnerCommunity.slug });
    check('re-inviting an accepted co-host -> 400', reInvite.status === 400, reInvite);

    const canManageView = await api('GET', `/api/events/${eventSlug}`, coordToken);
    check('co-host coordinator sees canManage=true on event page', canManageView.json?.canManage === true, canManageView.json?.canManage);

    // ── CERTIFICATE INCLUDES PARTNERSHIPS ────────────────────────
    console.log('\nCERTIFICATE');
    const register = await api('POST', `/api/events/${eventId}/register`, attendeeToken);
    const registrationId = register.json?.registration?._id ?? '';
    check('attendee registers -> 201', register.status === 201, register.status);
    // Co-host founder opens attendance; co-host coordinator runs check-in/out —
    // proves operational collaboration at both permission tiers.
    const openCheckin = await api('POST', `/api/events/${eventId}/status`, partnerToken, { status: 'CHECK_IN' });
    check('co-host VP opens check-in', openCheckin.status === 200, openCheckin);
    const checkin = await api('POST', `/api/events/${eventId}/registrations/${registrationId}/check-in`, coordToken);
    check('co-host coordinator checks attendee in', checkin.status === 200, checkin.status);
    const openCheckout = await api('POST', `/api/events/${eventId}/status`, partnerToken, { status: 'CHECK_OUT' });
    check('co-host VP opens check-out', openCheckout.status === 200, openCheckout);
    const checkout = await api('POST', `/api/events/${eventId}/registrations/${registrationId}/check-out`, coordToken);
    check('co-host coordinator checks attendee out -> COMPLETED', checkout.status === 200 && checkout.json?.registration?.status === 'COMPLETED', checkout);

    const issue = await api('POST', `/api/events/${eventId}/issue-certificates`, hostToken);
    check('issue certificates -> >= 1', issue.status === 200 && (issue.json?.issued ?? 0) >= 1, issue.json);

    const cert = await CertificateModel.findOne({ eventId }).lean();
    const serial = cert?.serial ?? '';
    const verify = await api('GET', `/api/certificates/verify/${serial}`);
    check('verify certificate -> 200 verified', verify.status === 200 && verify.json?.certificate?.verified === true, verify.status);
    check('certificate includes coHosts[] (partner community)', verify.json?.certificate?.coHosts?.[0]?.name === partnerCommunity.name, verify.json?.certificate?.coHosts);
    check('certificate includes partners[] (TechCorp)', verify.json?.certificate?.partners?.[0]?.name === 'TechCorp Nigeria', verify.json?.certificate?.partners);

    // ── AWARDS ON COMPLETION ─────────────────────────────────
    console.log('\nAWARDS');
    const addSponsor = await api('POST', `/api/events/${eventId}/sponsors`, hostToken, { name: 'MegaBank', website: 'https://megabank.example' });
    check('host adds a sponsor', addSponsor.status === 201 || addSponsor.status === 200, addSponsor.status);

    const finalize = await api('POST', `/api/events/${eventId}/finalize`, hostToken);
    check('finalize event -> 200', finalize.status === 200, finalize);

    const partnershipAward = await ReputationActivityModel.findOne({ userId: partnerFounderId, type: 'PARTNERSHIP_HOSTED' }).lean();
    check('partner leader earns PARTNERSHIP_HOSTED (+30)', partnershipAward?.scoreAwarded === 30, partnershipAward);

    const sponsorAward = await ReputationActivityModel.findOne({ userId: hostFounderId, type: 'SPONSORSHIP_SECURED' }).lean();
    check('organizer earns SPONSORSHIP_SECURED (+20 per sponsor)', sponsorAward?.scoreAwarded === 20, sponsorAward);

    const organizerAward = await ReputationActivityModel.findOne({ userId: hostFounderId, type: 'EVENT_ORGANIZED' }).lean();
    check('organizer still earns EVENT_ORGANIZED (+50)', organizerAward?.scoreAwarded === 50, organizerAward);

    const finalize2 = await api('POST', `/api/events/${eventId}/finalize`, hostToken);
    const sponsorAwards = await ReputationActivityModel.countDocuments({ userId: hostFounderId, type: 'SPONSORSHIP_SECURED' });
    check('re-finalizing does not double-award (idempotent)', finalize2.status === 200 && sponsorAwards === 1, sponsorAwards);

    const partnerScore = await ReputationScoreModel.findOne({ userId: partnerFounderId }).lean();
    check('partner leader guild score reflects award', (partnerScore?.guildScore ?? 0) >= 30, partnerScore?.guildScore);

    // ── REMOVE ───────────────────────────────────────────────────
    console.log('\nREMOVE');
    const outsiderRemove = await api('DELETE', `/api/events/${eventId}/partnerships/${partnershipId}`, outsiderToken);
    check('outsider cannot remove partnership -> 4xx', outsiderRemove.status >= 400, outsiderRemove.status);

    const remove = await api('DELETE', `/api/events/${eventId}/partnerships/${partnershipId}`, partnerToken);
    check('partner VP can withdraw partnership', remove.status === 200 && remove.json?.removed === true, remove);

    const afterRemove = await api('GET', `/api/events/${eventSlug}`);
    check('co-host disappears from event detail after removal', (afterRemove.json?.coHosts ?? []).length === 0, afterRemove.json?.coHosts);

    const coordAfter = await api('PATCH', `/api/events/${eventId}`, coordToken, { shortDescription: 'should fail again' });
    check('coordinator loses management after removal -> 4xx', coordAfter.status >= 400, coordAfter.status);
  } finally {
    // ── Teardown ─────────────────────────────────────────────────
    console.log('\nCleaning up…');
    if (eventId) {
      await EventRegistrationModel.deleteMany({ eventId });
      await CertificateModel.deleteMany({ eventId });
      await EventPartnershipModel.deleteMany({ eventId });
      await EventSponsorModel.deleteMany({ eventId });
      await EventModel.deleteOne({ _id: eventId });
    }
    await MembershipModel.deleteMany({ communityId: { $in: [hostCommunity._id, partnerCommunity._id] } });
    await CommunityModel.deleteMany({ _id: { $in: [hostCommunity._id, partnerCommunity._id] } });
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
