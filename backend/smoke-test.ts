/**
 * Integration smoke test — Community + Event + Certificate chain.
 *
 * Exercises the full flow against the LIVE backend API (http://localhost:3001):
 *   verified community listing → create event → publish → list (with sponsors/speakers)
 *   → register → open check-in → check-in → check-out (COMPLETED)
 *   → issue certificates → fetch mine → verify serial → negative checks.
 *
 * Setup/teardown touch the DB directly with throwaway users + community so no
 * real data is polluted. Run:  npx tsx --env-file=.env smoke-test.ts
 */
import './src/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { createToken } from './src/utils/token';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';

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
    email: `smoke-${rnd}@smoketest.local`,
    passwordHash: crypto.randomBytes(16).toString('hex'),
    passwordSalt: crypto.randomBytes(16).toString('hex'),
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
    profile: { username: `smoke_${rnd}`, university: 'Smoke Test University' },
  } as any);
  return user._id.toString();
}

async function main() {
  console.log(`\n=== GuildOS smoke test :: ${BASE} ===\n`);
  await connectDatabase();

  // Confirm the API is reachable before doing setup work.
  const health = await api('GET', '/api/communities');
  if (health.status !== 200) {
    console.error(`Backend not reachable at ${BASE} (GET /api/communities -> ${health.status}). Is the dev server running?`);
    process.exit(1);
  }

  // ── Setup (DB) ────────────────────────────────────────────────
  const stamp = Date.now();
  const orgId = await makeUser('Smoke Organizer');
  const attId = await makeUser('Smoke Attendee');
  const orgToken = createToken({ sub: orgId, purpose: 'access', jti: `smoke-org-${stamp}` } as any, 3600_000);
  const attToken = createToken({ sub: attId, purpose: 'access', jti: `smoke-att-${stamp}` } as any, 3600_000);

  const community = await CommunityModel.create({
    name: `Smoke Test Guild ${stamp}`,
    slug: `smoke-test-guild-${stamp}`,
    shortDescription: 'Throwaway community for smoke testing.',
    logo: '/uploads/smoke-logo.png',
    coverImage: '/uploads/smoke-cover.png',
    category: 'TECH',
    university: 'Smoke Test University',
    visibility: 'PUBLIC',
    verificationStatus: 'VERIFIED',
    verificationMethod: 'MANUAL',
    verifiedBy: orgId,
    verifiedAt: new Date(),
    founder: orgId,
    memberCount: 1,
  });
  const communityId = community._id.toString();
  await MembershipModel.create({ userId: orgId, communityId, role: 'FOUNDER', status: 'ACTIVE', assignedBy: orgId });

  const cleanupIds = [
    new mongoose.Types.ObjectId(orgId),
    new mongoose.Types.ObjectId(attId),
    new mongoose.Types.ObjectId(communityId),
  ];
  let eventId = '';

  try {
    // ── COMMUNITY ───────────────────────────────────────────────
    console.log('COMMUNITY');
    const list = await api('GET', '/api/communities');
    check('GET /api/communities returns 200', list.status === 200, list.status);
    check('verified community appears in public discovery',
      Array.isArray(list.json?.communities) && list.json.communities.some((c: any) => c._id === communityId));

    const detail = await api('GET', `/api/communities/${community.slug}`, orgToken);
    check('GET /api/communities/:slug returns the community', detail.status === 200 && detail.json?.community?._id === communityId, detail.status);
    check('founder is recognised as viewer member',
      detail.json?.viewerMembership?.role === 'FOUNDER', detail.json?.viewerMembership);

    // ── EVENT ───────────────────────────────────────────────────
    console.log('\nEVENT');
    const past = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
    const create = await api('POST', '/api/events', orgToken, {
      communityId,
      title: `Smoke Event ${stamp}`,
      shortDescription: 'Smoke test event',
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
    });
    check('POST /api/events creates a DRAFT event', create.status === 201 && !!create.json?.event?._id, create);
    eventId = create.json?.event?._id ?? '';
    check('new event starts in DRAFT status', create.json?.event?.status === 'DRAFT', create.json?.event?.status);

    const publish = await api('POST', `/api/events/${eventId}/publish`, orgToken);
    check('POST /api/events/:id/publish -> PUBLISHED', publish.status === 200 && publish.json?.event?.status === 'PUBLISHED', publish);

    const eventsList = await api('GET', `/api/events?communityId=${communityId}`);
    const listed = eventsList.json?.events?.find((e: any) => e._id === eventId);
    check('published event appears in community events list', !!listed, eventsList.status);
    check('listed event includes sponsors[] array (profile card feature)', Array.isArray(listed?.sponsors), listed?.sponsors);
    check('listed event includes speakers[] array (profile card feature)', Array.isArray(listed?.speakers), listed?.speakers);

    // ── ATTENDANCE ──────────────────────────────────────────────
    console.log('\nATTENDANCE');
    const register = await api('POST', `/api/events/${eventId}/register`, attToken);
    check('attendee registers -> 201 CONFIRMED', register.status === 201 && register.json?.registration?.status === 'CONFIRMED', register);
    const registrationId = register.json?.registration?._id ?? '';

    const openCheckin = await api('POST', `/api/events/${eventId}/status`, orgToken, { status: 'CHECK_IN' });
    check('organizer opens check-in -> CHECK_IN', openCheckin.status === 200 && openCheckin.json?.event?.status === 'CHECK_IN', openCheckin);

    const checkin = await api('POST', `/api/events/${eventId}/registrations/${registrationId}/check-in`, orgToken);
    check('check-in -> CHECKED_IN + attendanceVerified', checkin.status === 200 && checkin.json?.registration?.status === 'CHECKED_IN' && checkin.json?.registration?.attendanceVerified === true, checkin);

    const checkout = await api('POST', `/api/events/${eventId}/registrations/${registrationId}/check-out`, orgToken);
    check('check-out -> COMPLETED + certificateEligible', checkout.status === 200 && checkout.json?.registration?.status === 'COMPLETED' && checkout.json?.registration?.certificateEligible === true, checkout);

    // ── CERTIFICATE ─────────────────────────────────────────────
    console.log('\nCERTIFICATE');
    const issue = await api('POST', `/api/events/${eventId}/issue-certificates`, orgToken);
    check('issue-certificates -> issued >= 1', issue.status === 200 && (issue.json?.issued ?? 0) >= 1, issue);

    const mine = await api('GET', '/api/certificates/mine', attToken);
    const cert = mine.json?.certificates?.[0];
    check('attendee sees the issued certificate', mine.status === 200 && !!cert?.serial, mine);
    const serial = cert?.serial ?? '';

    const verify = await api('GET', `/api/certificates/verify/${encodeURIComponent(serial)}`);
    check('public verify by serial returns the certificate', verify.status === 200 && verify.json?.certificate?.serial === serial, verify.status);
    check('verified certificate status is VERIFIED', (verify.json?.certificate?.status ?? 'VERIFIED') === 'VERIFIED', verify.json?.certificate?.status);
    check('certificate attendee name matches', verify.json?.certificate?.attendeeName === 'Smoke Attendee', verify.json?.certificate?.attendeeName);

    // ── NEGATIVE CHECKS ─────────────────────────────────────────
    console.log('\nNEGATIVE');
    const bogus = await api('GET', '/api/certificates/verify/GLD-0000-NOPE');
    check('verify unknown serial -> 404', bogus.status === 404, bogus.status);

    const noPerm = await api('POST', `/api/events/${eventId}/issue-certificates`, attToken);
    check('non-manager cannot issue certificates -> 403', noPerm.status === 403, noPerm.status);

    const anon = await api('POST', `/api/events/${eventId}/register`);
    check('unauthenticated register -> 401', anon.status === 401, anon.status);
  } finally {
    // ── Teardown (DB sweep) ─────────────────────────────────────
    console.log('\nCLEANUP');
    if (eventId) cleanupIds.push(new mongoose.Types.ObjectId(eventId));
    const orClauses = [
      { _id: { $in: cleanupIds } },
      { userId: { $in: cleanupIds } },
      { communityId: { $in: cleanupIds } },
      { eventId: { $in: cleanupIds } },
      { founder: { $in: cleanupIds } },
      { issuedBy: { $in: cleanupIds } },
      { recipientId: { $in: cleanupIds } },
      { actorId: { $in: cleanupIds } },
      { authorId: { $in: cleanupIds } },
      { membershipId: { $in: cleanupIds } },
    ];
    const collections = await mongoose.connection.db.listCollections().toArray();
    let removed = 0;
    for (const { name } of collections) {
      try {
        const r = await mongoose.connection.collection(name).deleteMany({ $or: orClauses } as any);
        removed += r.deletedCount ?? 0;
      } catch {
        /* field type mismatch on some collections is fine */
      }
    }
    console.log(`  removed ${removed} throwaway document(s) across ${collections.length} collections`);
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    console.log('Failed checks:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  await mongoose.connection.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('\nSmoke test crashed:', err);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
