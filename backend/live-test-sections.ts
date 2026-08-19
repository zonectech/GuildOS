/**
 * Live test — Sections/Tracks (parallel cohorts inside one workshop).
 *
 * Exercises the full sectioned-workshop journey against the LIVE backend API
 * (http://localhost:3001), exactly what an organizer + attendees would do
 * through the browser:
 *   create WORKSHOP with days[] + sections[] (keys minted, empty dropped) →
 *   trainers assigned per section + a general speaker → publish → public detail
 *   exposes sections/availability/trainer assignments → registration REQUIRES a
 *   section → per-section cap waitlists overflow → self-service switch frees a
 *   seat (waitlist promoted) → per-track blast reaches only that cohort → switch
 *   locks once check-in opens → station check-in reports the attendee's track →
 *   live dashboard breaks arrivals down per track → checkout + finalize +
 *   certificates snapshot the section name → verify endpoint exposes it →
 *   sections can't be removed after publish (rename ok) → clone carries
 *   sections + trainer assignments.
 *
 * Throwaway users/communities are seeded directly in the DB and removed afterwards.
 * Run:  npx tsx --env-file=.env live-test-sections.ts
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
import { EventSpeakerModel } from './src/models/event-speaker.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { NotificationModel } from './src/models/notification.model';
import { CertificateModel } from './src/models/certificate.model';
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
    email: `sectest-${rnd}@sectest.local`,
    passwordHash: crypto.randomBytes(16).toString('hex'),
    passwordSalt: crypto.randomBytes(16).toString('hex'),
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
    profile: { username: `sectest_${rnd}`, university: 'Sections Test University' },
  } as any);
  return user._id.toString();
}

const TEST_TZ = 'Africa/Lagos';
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TEST_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

async function main() {
  console.log(`\n=== GuildOS sections/tracks live test :: ${BASE} ===\n`);
  await connectDatabase();

  const health = await api('GET', '/api/communities');
  if (health.status !== 200) {
    console.error(`Backend not reachable at ${BASE}. Is the dev server running?`);
    process.exit(1);
  }

  const stamp = Date.now();
  const founderId = await makeUser('Sections Founder');
  const adaId = await makeUser('Ada DataScience'); // registers Data Science, later switches to Coding
  const bayoId = await makeUser('Bayo DataScience'); // registers Data Science, checks in + completes
  const chikaId = await makeUser('Chika Waitlist'); // third into the capped section → waitlisted
  const derenId = await makeUser('Deren Coder'); // registers Coding
  const tok = (id: string, tag: string) => createToken({ sub: id, purpose: 'access', jti: `sectest-${tag}-${stamp}` } as any, 3600_000);
  const founderToken = tok(founderId, 'founder');
  const adaToken = tok(adaId, 'ada');
  const bayoToken = tok(bayoId, 'bayo');
  const chikaToken = tok(chikaId, 'chika');
  const derenToken = tok(derenId, 'deren');

  const community = await CommunityModel.create({
    name: `Sections Guild ${stamp}`,
    normalizedName: `sections guild ${stamp}`,
    slug: `sections-guild-${stamp}`,
    shortDescription: 'Throwaway community for the sections live test.',
    logo: '/uploads/smoke-logo.png',
    coverImage: '/uploads/smoke-cover.png',
    category: 'TECH',
    university: 'Sections Test University',
    visibility: 'PUBLIC',
    verificationStatus: 'VERIFIED',
    verificationMethod: 'MANUAL',
    verifiedBy: founderId,
    verifiedAt: new Date(),
    founder: founderId,
    memberCount: 1,
  });
  await MembershipModel.create({ userId: founderId, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: founderId });

  const userIds = [founderId, adaId, bayoId, chikaId, derenId].map((id) => new mongoose.Types.ObjectId(id));
  const clearCreationCooldown = () =>
    mongoose.connection.collection('eventcreationguards').updateOne({ key: `user:${founderId}` }, { $set: { nextAllowedAt: new Date(0) } });

  let eventId = '';
  let eventSlug = '';
  let cloneId = '';
  let dsKey = ''; // Data Science section key (server-minted)
  let codeKey = ''; // Coding section key

  // 3-day workshop: started 2 days ago, final day is today (capped before Lagos midnight)
  // so check-in works now and a final-day checkout can settle as COMPLETED.
  const now = Date.now();
  const dayMs = 86400000;
  const day1 = new Date(now - 2 * dayMs);
  const day2 = new Date(now - 1 * dayMs);
  const day3 = new Date(now);
  const lagosMidnight = (() => {
    const [y, m, d] = dayKey(day3).split('-').map(Number);
    return Date.UTC(y, m - 1, d, 23, 0, 0); // Lagos = UTC+1
  })();
  const endsAt = new Date(Math.min(now + 3600_000, lagosMidnight - 60_000));

  try {
    // ── 1. CREATE — workshop with parallel sections ──────────────
    console.log('CREATE SECTIONED WORKSHOP');
    const create = await api('POST', '/api/events', founderToken, {
      communityId: community._id.toString(),
      title: `Sectioned Workshop ${stamp}`,
      type: 'WORKSHOP',
      shortDescription: 'Two parallel tracks, one workshop.',
      mode: 'PHYSICAL',
      venue: 'Innovation Hub',
      bannerImage: '/uploads/smoke-banner.png',
      startDate: day1.toISOString(),
      endDate: endsAt.toISOString(),
      registrationPolicy: 'OPEN',
      capacity: 0,
      waitlistEnabled: true,
      allowWalkIns: true,
      certificateEnabled: true,
      certificateMode: 'STANDARD',
      certificateType: 'ATTENDANCE',
      minimumAttendanceDuration: 0,
      minimumAttendanceDays: 1, // one attended day earns the certificate
      visibility: 'PUBLIC',
      timezone: TEST_TZ,
      theme: 'Build With Data', // grand theme stays on the event
      days: [
        {
          date: day1.toISOString(),
          theme: 'Day 1: Setup',
          venue: 'Innovation Hub',
          sessions: [
            { time: '09:00', title: 'Joint opening keynote', venue: 'Auditorium', sectionKey: '' },
            { time: '11:00', title: 'Pandas lab', venue: 'Room A', sectionKey: 'data-science' },
            { time: '11:00', title: 'HTML sprint', venue: 'Room B', sectionKey: 'coding' },
            { time: '13:00', title: 'Ghost-track session', venue: '', sectionKey: 'no-such-track' },
          ],
        },
        { date: day2.toISOString(), theme: 'Day 2: Deep work', venue: 'Innovation Hub' },
        { date: day3.toISOString(), theme: 'Day 3: Demos', venue: 'Innovation Hub' },
      ],
      sections: [
        { name: 'Data Science', description: 'Python, pandas, ML fundamentals', capacity: 2, venue: 'Room A' },
        { name: 'Coding', description: 'Web dev from zero', capacity: 0, venue: 'Room B' },
        { name: '', description: 'nameless — must be dropped', capacity: 5 }, // invalid
      ],
    });
    check('create workshop with sections[] -> 201', create.status === 201, create.json);
    eventId = create.json?.event?._id ?? '';
    eventSlug = create.json?.event?.slug ?? '';
    const createdSections = create.json?.event?.sections ?? [];
    check('nameless section dropped (2 of 3 kept)', createdSections.length === 2, createdSections);
    dsKey = createdSections.find((s: any) => s.name === 'Data Science')?.key ?? '';
    codeKey = createdSections.find((s: any) => s.name === 'Coding')?.key ?? '';
    check('server minted stable slug keys', dsKey === 'data-science' && codeKey === 'coding', { dsKey, codeKey });
    check('per-section capacity + venue saved', createdSections[0]?.capacity === 2 && createdSections[0]?.venue === 'Room A', createdSections[0]);
    const day1Sessions = create.json?.event?.days?.[0]?.sessions ?? [];
    check('per-track sessions saved with their sectionKey', day1Sessions.some((s: any) => s.sectionKey === 'data-science') && day1Sessions.some((s: any) => s.sectionKey === 'coding'), day1Sessions);
    check('shared-spine session keeps empty sectionKey', day1Sessions.some((s: any) => s.title === 'Joint opening keynote' && (s.sectionKey ?? '') === ''), day1Sessions);
    check('session pointing at unknown track falls back to shared', day1Sessions.find((s: any) => s.title === 'Ghost-track session')?.sectionKey === '', day1Sessions);

    // ── 2. TRAINERS — per section + a general speaker ────────────
    console.log('\nTRAINERS PER SECTION');
    const t1 = await api('POST', `/api/events/${eventId}/speakers`, founderToken, {
      fullName: 'Dr. Amina Bello', title: 'Data Lead', speakerType: 'TRAINER', sectionKey: dsKey,
    });
    check('trainer assigned to Data Science', t1.status === 201 && t1.json?.speaker?.sectionKey === dsKey, t1.json);
    const t2 = await api('POST', `/api/events/${eventId}/speakers`, founderToken, {
      fullName: 'John Okafor', title: 'Fullstack Coach', speakerType: 'TRAINER', sectionKey: codeKey,
    });
    check('trainer assigned to Coding', t2.status === 201 && t2.json?.speaker?.sectionKey === codeKey, t2.json);
    const t3 = await api('POST', `/api/events/${eventId}/speakers`, founderToken, {
      fullName: 'Sarah Danjuma', title: 'Keynote', speakerType: 'GUEST',
    });
    check('general speaker has no section', t3.status === 201 && (t3.json?.speaker?.sectionKey ?? '') === '', t3.json);
    const badSection = await api('PATCH', `/api/events/${eventId}/speakers/${t3.json?.speaker?._id}`, founderToken, { sectionKey: 'no-such-track' });
    check('bogus sectionKey normalizes to whole-event', badSection.status === 200 && (badSection.json?.speaker?.sectionKey ?? '') === '', badSection.json);

    // ── 3. PUBLISH + PUBLIC DETAIL ───────────────────────────────
    console.log('\nPUBLISH + PUBLIC DETAIL');
    const publish = await api('POST', `/api/events/${eventId}/publish`, founderToken);
    check('publish -> PUBLISHED', publish.status === 200 && publish.json?.event?.status === 'PUBLISHED', publish.json);
    const detail = await api('GET', `/api/events/${eventSlug}`);
    check('public detail exposes sections', (detail.json?.event?.sections ?? []).length === 2);
    const avail = detail.json?.sectionAvailability ?? [];
    check('sectionAvailability lists both tracks (0 taken)', avail.length === 2 && avail.every((a: any) => a.taken === 0), avail);
    const detailTrainers = (detail.json?.speakers ?? []).filter((s: any) => s.sectionKey);
    check('trainer section assignments visible publicly', detailTrainers.length === 2, detailTrainers);

    // ── 4. REGISTRATION — section is mandatory, caps enforced ────
    console.log('\nREGISTRATION');
    const noSection = await api('POST', `/api/events/${eventId}/register`, adaToken, {});
    check('registering without a section -> 400', noSection.status === 400, noSection.json);
    const badKey = await api('POST', `/api/events/${eventId}/register`, adaToken, { sectionKey: 'quantum' });
    check('registering with unknown section -> 400', badKey.status === 400, badKey.json);
    const adaReg = await api('POST', `/api/events/${eventId}/register`, adaToken, { sectionKey: dsKey });
    check('Ada registers Data Science -> CONFIRMED', adaReg.status === 201 && adaReg.json?.registration?.status === 'CONFIRMED' && adaReg.json?.registration?.sectionKey === dsKey, adaReg.json);
    const bayoReg = await api('POST', `/api/events/${eventId}/register`, bayoToken, { sectionKey: dsKey });
    check('Bayo registers Data Science -> CONFIRMED (2/2)', bayoReg.status === 201 && bayoReg.json?.registration?.status === 'CONFIRMED', bayoReg.json);
    const chikaReg = await api('POST', `/api/events/${eventId}/register`, chikaToken, { sectionKey: dsKey });
    check('Chika overflows the DS cap -> WAITLISTED', chikaReg.status === 201 && chikaReg.json?.registration?.status === 'WAITLISTED', chikaReg.json);
    const derenReg = await api('POST', `/api/events/${eventId}/register`, derenToken, { sectionKey: codeKey });
    check('Deren registers Coding (uncapped) -> CONFIRMED', derenReg.status === 201 && derenReg.json?.registration?.status === 'CONFIRMED', derenReg.json);
    const availAfter = (await api('GET', `/api/events/${eventSlug}`)).json?.sectionAvailability ?? [];
    const dsAvail = availAfter.find((a: any) => a.key === dsKey);
    check('DS availability shows 2 seats taken of 2', dsAvail?.capacity === 2 && dsAvail?.taken >= 2, dsAvail);

    // ── 5. SWITCH — self-service until check-in opens ────────────
    console.log('\nSECTION SWITCH');
    const fullSwitch = await api('POST', `/api/events/${eventId}/register/section`, derenToken, { sectionKey: dsKey });
    check('switching INTO a full section -> 400', fullSwitch.status === 400, fullSwitch.json);
    const adaSwitch = await api('POST', `/api/events/${eventId}/register/section`, adaToken, { sectionKey: codeKey });
    check('Ada switches DS -> Coding', adaSwitch.status === 200 && adaSwitch.json?.registration?.sectionKey === codeKey, adaSwitch.json);
    const chikaAfter = await EventRegistrationModel.findOne({ eventId, userId: chikaId }).lean();
    check('freed DS seat auto-promotes Chika off the waitlist', chikaAfter?.status === 'CONFIRMED' && chikaAfter?.sectionKey === dsKey, chikaAfter?.status);

    // ── 6. PER-TRACK BLAST ───────────────────────────────────────
    console.log('\nPER-TRACK BLAST');
    const blastBad = await api('POST', `/api/events/${eventId}/message`, founderToken, { subject: 'Nope', message: 'Bad section key', sectionKey: 'ghost' });
    check('blast to unknown section -> 4xx', blastBad.status >= 400, blastBad.json);
    const blast = await api('POST', `/api/events/${eventId}/message`, founderToken, {
      subject: 'Bring your laptops', message: 'Coding track: we build tomorrow — bring a laptop.', sectionKey: codeKey,
    });
    check('per-track blast -> 200 with section name', blast.status === 200 && blast.json?.section === 'Coding', blast.json);
    check('blast reached exactly the Coding cohort (2)', blast.json?.notified === 2, blast.json);
    const bayoBell = await NotificationModel.findOne({ userId: bayoId, title: /Bring your laptops/ }).lean();
    const adaBell = await NotificationModel.findOne({ userId: adaId, title: /Bring your laptops/ }).lean();
    check('Data Science attendee got NO Coding blast', !bayoBell);
    check('switched-in Coding attendee got the blast', Boolean(adaBell));

    // ── 7. LIVE — check-in reports the track, dashboard splits ───
    console.log('\nLIVE DAY');
    const open = await api('POST', `/api/events/${eventId}/status`, founderToken, { status: 'CHECK_IN' });
    check('organizer opens check-in', open.status === 200 && open.json?.event?.status === 'CHECK_IN');
    const lateSwitch = await api('POST', `/api/events/${eventId}/register/section`, bayoToken, { sectionKey: codeKey });
    check('switching locked once check-in opens -> 400', lateSwitch.status === 400, lateSwitch.json);
    const bayoRegDoc = await EventRegistrationModel.findOne({ eventId, userId: bayoId }).lean();
    const stationScan = await api('POST', '/api/attendance/checkin', founderToken, { token: bayoRegDoc?.qrToken });
    check('station check-in names the track + room', stationScan.status === 200 && stationScan.json?.section?.name === 'Data Science' && stationScan.json?.section?.venue === 'Room A', stationScan.json);
    const live = await api('GET', `/api/events/${eventId}/attendance/live`, founderToken);
    const liveSections = live.json?.live?.sections ?? [];
    const liveDs = liveSections.find((s: any) => s.key === dsKey);
    const liveCode = liveSections.find((s: any) => s.key === codeKey);
    check('live dashboard breaks arrivals down per track', liveDs?.checkedIn === 1 && liveCode?.checkedIn === 0, liveSections);
    check('live dashboard carries per-track registered counts', liveDs?.registered === 2 && liveCode?.registered === 2, liveSections);

    // ── 8. COMPLETE + CERTIFICATE — section rides on the cert ────
    console.log('\nCERTIFICATE');
    const checkout = await api('POST', '/api/attendance/checkout', founderToken, { token: bayoRegDoc?.qrToken });
    check('final-day checkout completes Bayo (1-day quota)', checkout.status === 200 && checkout.json?.certificateEligible === true, checkout.json);
    const finalize = await api('POST', `/api/events/${eventId}/finalize`, founderToken);
    check('finalize -> 200', finalize.status === 200, finalize.json);
    const issue = await api('POST', `/api/events/${eventId}/issue-certificates`, founderToken);
    check('certificates issued to the completed attendee', issue.status === 200 && issue.json?.issued === 1, issue.json);
    const cert = await CertificateModel.findOne({ eventId, userId: bayoId }).lean();
    check('certificate snapshots sectionName "Data Science"', cert?.sectionName === 'Data Science', cert?.sectionName);
    const verify = await api('GET', `/api/certificates/verify/${cert?.serial}`);
    check('public verify exposes the section', verify.status === 200 && verify.json?.certificate?.sectionName === 'Data Science', verify.json?.certificate?.sectionName);

    // ── 9. EDIT GUARDS — rename ok, removal blocked ──────────────
    console.log('\nEDIT GUARDS');
    const rename = await api('PATCH', `/api/events/${eventId}`, founderToken, {
      sections: [
        { key: dsKey, name: 'Data Science & AI', description: 'Python, pandas, ML fundamentals', capacity: 2, venue: 'Room A' },
        { key: codeKey, name: 'Coding', description: 'Web dev from zero', capacity: 0, venue: 'Room B' },
      ],
    });
    check('renaming a section keeps its key', rename.status === 200 && (rename.json?.event?.sections ?? []).find((s: any) => s.key === dsKey)?.name === 'Data Science & AI', rename.json?.event?.sections);
    const remove = await api('PATCH', `/api/events/${eventId}`, founderToken, {
      sections: [{ key: codeKey, name: 'Coding', description: '', capacity: 0, venue: 'Room B' }],
    });
    check('removing a section after publish -> 400', remove.status === 400, remove.json);

    // ── 10. ROSTER + CLONE ───────────────────────────────────────
    console.log('\nROSTER + CLONE');
    const roster = await api('GET', `/api/events/${eventId}/registrations`, founderToken);
    check('roster carries section names for labelling', (roster.json?.sections ?? []).length === 2, roster.json?.sections);
    const rows = roster.json?.registrations ?? [];
    const chikaRow = rows.find((r: any) => String(r.registration.userId) === chikaId);
    check('roster rows carry each attendee sectionKey', chikaRow?.registration?.sectionKey === dsKey, chikaRow?.registration?.sectionKey);
    await clearCreationCooldown();
    const clone = await api('POST', `/api/events/${eventId}/clone`, founderToken);
    check('clone -> 201 DRAFT', clone.status === 201 && clone.json?.event?.status === 'DRAFT', clone.json);
    cloneId = clone.json?.event?._id ?? '';
    const cloneSections = clone.json?.event?.sections ?? [];
    check('clone carries sections (keys intact)', cloneSections.length === 2 && cloneSections.some((s: any) => s.key === dsKey), cloneSections);
    const cloneTrainers = await EventSpeakerModel.find({ eventId: cloneId }).lean();
    check('cloned trainers keep section assignment', cloneTrainers.some((s) => s.sectionKey === dsKey) && cloneTrainers.some((s) => s.sectionKey === codeKey), cloneTrainers.map((s) => s.sectionKey));
  } finally {
    // ── CLEANUP ──────────────────────────────────────────────────
    console.log('\nCleaning up…');
    const eventIds = [eventId, cloneId].filter(Boolean).map((id) => new mongoose.Types.ObjectId(id));
    if (eventIds.length) {
      await EventSpeakerModel.deleteMany({ eventId: { $in: eventIds } });
      await EventRegistrationModel.deleteMany({ eventId: { $in: eventIds } });
      await CertificateModel.deleteMany({ eventId: { $in: eventIds } });
      await EventModel.deleteMany({ _id: { $in: eventIds } });
    }
    await NotificationModel.deleteMany({ userId: { $in: userIds } });
    await ReputationActivityModel.deleteMany({ userId: { $in: userIds } });
    await ReputationScoreModel.deleteMany({ userId: { $in: userIds } });
    await MembershipModel.deleteMany({ communityId: community._id });
    await CommunityModel.deleteOne({ _id: community._id });
    await UserModel.deleteMany({ _id: { $in: userIds } });
    await mongoose.connection.collection('eventcreationguards').deleteMany({ key: `user:${founderId}` });
    await mongoose.disconnect();
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failures.length) {
    console.log('Failed checks:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
