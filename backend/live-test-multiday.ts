/**
 * Live test — Multi-day events (day agenda + per-day attendance).
 *
 * Exercises the multi-day flow against the LIVE backend API (http://localhost:3001):
 *   create event with days[] (per-day theme/venue/features validated) +
 *   minimumAttendanceDays → public detail exposes agenda → QR check-in buckets
 *   into attendanceDays (same-day duplicate blocked) → mid-event checkout settles
 *   as CHECKED_OUT (not PARTIAL) → attendee with enough distinct days completes
 *   on final-day checkout → finalize settles stragglers on the day quota →
 *   certificates only for the day-quota crowd → clone carries agenda, resets dates.
 *
 * Throwaway users/communities are seeded directly in the DB and removed afterwards.
 * Run:  npx tsx --env-file=.env live-test-multiday.ts
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
import { sendDueEventReminders } from './src/services/event-notification.service';
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
    email: `mdtest-${rnd}@mdtest.local`,
    passwordHash: crypto.randomBytes(16).toString('hex'),
    passwordSalt: crypto.randomBytes(16).toString('hex'),
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
    profile: { username: `mdtest_${rnd}`, university: 'Multiday Test University' },
  } as any);
  return user._id.toString();
}

// Day keys in the event's timezone (the test event uses Africa/Lagos, matching the backend bucketing).
const TEST_TZ = 'Africa/Lagos';
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TEST_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

async function main() {
  console.log(`\n=== GuildOS multi-day event live test :: ${BASE} ===\n`);
  await connectDatabase();

  const health = await api('GET', '/api/communities');
  if (health.status !== 200) {
    console.error(`Backend not reachable at ${BASE}. Is the dev server running?`);
    process.exit(1);
  }

  const stamp = Date.now();
  const founderId = await makeUser('Multiday Founder');
  const fullAttendeeId = await makeUser('Full Attendee'); // attends 2 of 3 days (meets quota)
  const oneDayAttendeeId = await makeUser('One Day Attendee'); // attends 1 day (below quota)
  const tok = (id: string, tag: string) => createToken({ sub: id, purpose: 'access', jti: `mdtest-${tag}-${stamp}` } as any, 3600_000);
  const founderToken = tok(founderId, 'founder');
  const fullToken = tok(fullAttendeeId, 'full');
  const oneDayToken = tok(oneDayAttendeeId, 'oneday');

  const community = await CommunityModel.create({
    name: `Multiday Guild ${stamp}`,
    slug: `multiday-guild-${stamp}`,
    shortDescription: 'Throwaway community for multi-day live test.',
    logo: '/uploads/smoke-logo.png',
    coverImage: '/uploads/smoke-cover.png',
    category: 'TECH',
    university: 'Multiday Test University',
    visibility: 'PUBLIC',
    verificationStatus: 'VERIFIED',
    verificationMethod: 'MANUAL',
    verifiedBy: founderId,
    verifiedAt: new Date(),
    founder: founderId,
    memberCount: 1,
  });
  await MembershipModel.create({ userId: founderId, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: founderId });

  const userIds = [founderId, fullAttendeeId, oneDayAttendeeId].map((id) => new mongoose.Types.ObjectId(id));
  let eventId = '';
  let eventSlug = '';
  let cloneId = '';
  let reminderEventId = '';

  // 3-day event: started 2 days ago, ends later today (so "today" is the final day).
  // End time is capped at 1 min before Lagos midnight so the calendar span stays
  // exactly 3 days even when the test runs late in the evening.
  const now = Date.now();
  const dayMs = 86400000;
  const day1 = new Date(now - 2 * dayMs);
  const day2 = new Date(now - 1 * dayMs);
  const day3 = new Date(now);
  const lagosMidnight = (() => {
    const [y, m, d] = dayKey(day3).split('-').map(Number);
    // Lagos is UTC+1: the next Lagos midnight after this Lagos date = 23:00 UTC same date.
    return Date.UTC(y, m - 1, d, 23, 0, 0);
  })();
  const endsAt = new Date(Math.min(now + 3600_000, lagosMidnight - 60_000));

  try {
    // ── CREATE ───────────────────────────────────────────────────
    console.log('CREATE MULTI-DAY EVENT');
    const create = await api('POST', '/api/events', founderToken, {
      communityId: community._id.toString(),
      title: `Multiday Summit ${stamp}`,
      shortDescription: 'Multi-day live test event',
      mode: 'PHYSICAL',
      venue: 'Main Hall',
      bannerImage: '/uploads/smoke-banner.png',
      startDate: day1.toISOString(),
      endDate: endsAt.toISOString(), // final day today, capped before Lagos midnight
      registrationPolicy: 'OPEN',
      capacity: 0,
      allowWalkIns: true,
      certificateEnabled: true,
      certificateMode: 'STANDARD',
      certificateType: 'ATTENDANCE',
      minimumAttendanceDuration: 0,
      visibility: 'PUBLIC',
      timezone: TEST_TZ,
      theme: 'The Future of Robotics', // grand theme
      days: [
        {
          date: day1.toISOString(),
          theme: 'Day 1: Foundations',
          venue: 'Main Hall',
          features: ['Keynote', 'Intro labs', ''],
          facilitators: [
            { name: 'Dr. Amina Bello', title: 'Lead Facilitator' },
            { name: '', title: 'Nameless — dropped' },
          ],
          sessions: [
            { time: '13:00', title: 'Opening Keynote', venue: 'Main Hall', facilitator: 'Dr. Amina Bello' },
            { time: '25:99', title: 'Bad time kept, time blanked', venue: '', facilitator: '' },
            { time: '15:00', title: '', venue: 'Titleless — dropped', facilitator: '' },
          ],
        },
        { date: day2.toISOString(), theme: 'Day 2: Deep Dive', venue: 'Engineering Block B', features: ['Hands-on workshop'], facilitators: [{ name: 'Engr. Chidi Okafor', title: '' }] },
        { date: day3.toISOString(), theme: 'Day 3: Demo Day', venue: '', endTime: '23:59', features: ['Project demos', 'Awards'] },
        { date: null, theme: '', venue: '', features: [] }, // empty -> dropped
      ],
      minimumAttendanceDays: 2,
    });
    check('create event with days[] -> 201', create.status === 201 && !!create.json?.event?._id, { status: create.status, body: create.json });
    eventId = create.json?.event?._id ?? '';
    if (!eventId) throw new Error('Event creation failed — aborting to teardown');
    eventSlug = create.json?.event?.slug ?? '';
    const savedDays = create.json?.event?.days ?? [];
    check('empty day dropped (3 of 4 kept)', savedDays.length === 3, savedDays.length);
    check('per-day theme + venue saved', savedDays[1]?.theme === 'Day 2: Deep Dive' && savedDays[1]?.venue === 'Engineering Block B', savedDays[1]);
    check('per-day features saved (blank line dropped)', savedDays[0]?.features?.length === 2, savedDays[0]?.features);
    check('minimumAttendanceDays saved', create.json?.event?.minimumAttendanceDays === 2, create.json?.event?.minimumAttendanceDays);
    check('facilitators saved (nameless dropped)', savedDays[0]?.facilitators?.length === 1 && savedDays[0]?.facilitators?.[0]?.name === 'Dr. Amina Bello', savedDays[0]?.facilitators);
    check('sessions saved (titleless dropped, bad time blanked)', savedDays[0]?.sessions?.length === 2 && savedDays[0]?.sessions?.[0]?.time === '13:00' && savedDays[0]?.sessions?.[1]?.time === '', savedDays[0]?.sessions);

    // Per-day speaker assignment.
    const spk1 = await api('POST', `/api/events/${eventId}/speakers`, founderToken, { fullName: 'Day Two Speaker', title: 'Robotics Lead', day: 2 });
    check('add speaker assigned to day 2', spk1.status === 201 && spk1.json?.speaker?.day === 2, spk1.json?.speaker);
    const spk2 = await api('POST', `/api/events/${eventId}/speakers`, founderToken, { fullName: 'All Days Speaker' });
    check('add whole-event speaker (day null)', spk2.status === 201 && (spk2.json?.speaker?.day ?? null) === null, spk2.json?.speaker);
    const spkMove = await api('PATCH', `/api/events/${eventId}/speakers/${spk2.json?.speaker?._id}`, founderToken, { day: 3 });
    check('reassign speaker to day 3', spkMove.status === 200 && spkMove.json?.speaker?.day === 3, spkMove.json?.speaker);

    const publish = await api('POST', `/api/events/${eventId}/publish`, founderToken);
    check('publish -> PUBLISHED', publish.status === 200 && publish.json?.event?.status === 'PUBLISHED', publish.status);

    const detail = await api('GET', `/api/events/${eventSlug}`);
    check('public event detail exposes days agenda', (detail.json?.event?.days ?? []).length === 3, detail.json?.event?.days?.length);

    // ── REGISTER + OPEN CHECK-IN ─────────────────────────────────
    console.log('\nREGISTER + CHECK-IN (TODAY = FINAL DAY)');
    const reg1 = await api('POST', `/api/events/${eventId}/register`, fullToken, { plannedDays: [1, 3] });
    check('full attendee registers -> 201', reg1.status === 201, reg1.status);
    check('RSVP plan saved (days 1 & 3)', JSON.stringify(reg1.json?.registration?.plannedDays) === '[1,3]', reg1.json?.registration?.plannedDays);
    const reg2 = await api('POST', `/api/events/${eventId}/register`, oneDayToken, { plannedDays: [1, 2, 3] });
    check('one-day attendee registers -> 201', reg2.status === 201, reg2.status);
    check('picking every day normalizes to [] (all days)', (reg2.json?.registration?.plannedDays ?? []).length === 0, reg2.json?.registration?.plannedDays);
    const qr1 = reg1.json?.registration?.qrToken ?? '';
    const qr2 = reg2.json?.registration?.qrToken ?? '';

    const openCheckIn = await api('POST', `/api/events/${eventId}/status`, founderToken, { status: 'CHECK_IN' });
    check('organizer opens check-in', openCheckIn.status === 200, openCheckIn.status);

    // Simulate day-1 attendance for the full attendee (checked in + out two days ago).
    await EventRegistrationModel.updateOne(
      { eventId, userId: fullAttendeeId },
      {
        $set: {
          attendanceDays: [{ day: dayKey(day1), checkInAt: day1, checkOutAt: new Date(day1.getTime() + 6 * 3600_000), minutes: 360 }],
          checkInAt: day1,
          status: 'CHECKED_OUT',
          attendanceMinutes: 360,
        },
      },
    );

    // Today (final day): both attendees scan in.
    const scanFull = await api('POST', `/api/events/check-in/${qr1}`, founderToken);
    check('full attendee checks in on day 3 (2nd distinct day)', scanFull.status === 200 && scanFull.json?.registration?.status === 'CHECKED_IN', scanFull.status);
    const scanDup = await api('POST', `/api/events/check-in/${qr1}`, founderToken);
    check('same-day duplicate check-in blocked ("today")', scanDup.status >= 400 && String(scanDup.json?.error ?? '').includes('today'), scanDup.json);
    const scanOne = await api('POST', `/api/events/check-in/${qr2}`, founderToken);
    check('one-day attendee checks in on day 3 (1st day)', scanOne.status === 200 && scanOne.json?.registration?.status === 'CHECKED_IN', scanOne.status);

    const fullRegAfterScan = await EventRegistrationModel.findOne({ eventId, userId: fullAttendeeId }).lean();
    check('attendanceDays has 2 distinct day entries', (fullRegAfterScan?.attendanceDays ?? []).filter((d: any) => d.checkInAt).length === 2, fullRegAfterScan?.attendanceDays);
    check('today\'s entry keyed in event timezone', (fullRegAfterScan?.attendanceDays ?? []).some((d: any) => d.day === dayKey(new Date())), fullRegAfterScan?.attendanceDays?.map((d: any) => d.day));

    // ── LIVE DASHBOARD DAY PULSE ────────────────────────────
    console.log('\nLIVE DASHBOARD');
    const liveRes = await api('GET', `/api/events/${eventId}/attendance/live`, founderToken);
    const liveDay = liveRes.json?.live?.day;
    check('live dashboard reports Day 3 of 3', liveDay?.current === 3 && liveDay?.total === 3, liveDay);
    check('live dashboard counts today\'s check-ins (2)', liveDay?.checkedInToday === 2, liveDay);
    check('expected today = planned day 3 + all-days (2)', liveDay?.expectedToday === 2, liveDay);

    // ── CHECK-OUT ────────────────────────────────────────────────
    console.log('\nCHECK-OUT');
    const regFullId = fullRegAfterScan?._id?.toString() ?? '';
    const outFull = await api('POST', `/api/events/${eventId}/registrations/${regFullId}/check-out`, founderToken);
    check('full attendee checkout on final day -> COMPLETED (2/2 day quota)', outFull.status === 200 && outFull.json?.registration?.status === 'COMPLETED', outFull.json?.registration?.status);
    const fullRegDone = await EventRegistrationModel.findOne({ eventId, userId: fullAttendeeId }).lean();
    check('certificateEligible = true', fullRegDone?.certificateEligible === true, fullRegDone?.certificateEligible);
    check('total minutes = sum of day minutes (>= 360)', (fullRegDone?.attendanceMinutes ?? 0) >= 360, fullRegDone?.attendanceMinutes);

    // One-day attendee never checks out today — finalize should settle them below.

    // ── FINALIZE ─────────────────────────────────────────────────
    console.log('\nFINALIZE');
    const finalize = await api('POST', `/api/events/${eventId}/finalize`, founderToken);
    check('finalize -> 200', finalize.status === 200, finalize);
    const oneDayReg = await EventRegistrationModel.findOne({ eventId, userId: oneDayAttendeeId }).lean();
    check('one-day attendee settled as PARTIAL_ATTENDANCE (1 < 2 days)', oneDayReg?.status === 'PARTIAL_ATTENDANCE' && oneDayReg?.certificateEligible === false, oneDayReg?.status);
    check('forgot-to-scan-out day credited minutes (agenda endTime)', (oneDayReg?.attendanceMinutes ?? 0) > 0, oneDayReg?.attendanceMinutes);
    const fullRegFinal = await EventRegistrationModel.findOne({ eventId, userId: fullAttendeeId }).lean();
    check('full attendee still COMPLETED after finalize', fullRegFinal?.status === 'COMPLETED', fullRegFinal?.status);

    const completedAward = await ReputationActivityModel.findOne({ userId: fullAttendeeId, type: 'EVENT_COMPLETED' }).lean();
    check('EVENT_COMPLETED awarded once (+10, idempotent)', completedAward?.scoreAwarded === 10, completedAward);

    // ── CERTIFICATES ─────────────────────────────────────────────
    console.log('\nCERTIFICATES');
    const issue = await api('POST', `/api/events/${eventId}/issue-certificates`, founderToken);
    check('issue certificates -> exactly 1 (day quota gate)', issue.status === 200 && issue.json?.issued === 1, issue.json);
    const cert = await CertificateModel.findOne({ eventId, userId: fullAttendeeId }).lean();
    check('certificate went to the 2-day attendee', !!cert, cert?.serial);
    check('certificate snapshots daysAttended 2 of 3', (cert as any)?.daysAttended === 2 && (cert as any)?.totalDays === 3, { d: (cert as any)?.daysAttended, t: (cert as any)?.totalDays });
    const verifyCert = await api('GET', `/api/certificates/verify/${cert?.serial}`);
    check('verify endpoint returns daysAttended/totalDays', verifyCert.json?.certificate?.daysAttended === 2 && verifyCert.json?.certificate?.totalDays === 3, verifyCert.json?.certificate);

    // ── ATTENDANCE REPORT ──────────────────────────────────
    console.log('\nATTENDANCE REPORT');
    const report = await api('GET', `/api/events/${eventId}/attendance-report`, founderToken);
    const rows = report.json?.report ?? report.json?.attendees ?? report.json ?? [];
    const list = Array.isArray(rows) ? rows : [];
    const fullRow = list.find((r: any) => r.fullName === 'Full Attendee');
    const oneRow = list.find((r: any) => r.fullName === 'One Day Attendee');
    check('report row shows daysAttended = 2', fullRow?.daysAttended === 2, fullRow);
    check('report row shows daysAttended = 1 + RSVP plan', oneRow?.daysAttended === 1 && Array.isArray(oneRow?.plannedDays), oneRow);

    // ── REMINDERS (bell + email) ────────────────────────────
    console.log('\nREMINDERS');
    // Future-dated 2-day event: starts in 2h (whole-event reminder due) and
    // Day 2 starts in ~20h (day reminder due) — both inside a 24h window.
    const remStart = new Date(Date.now() + 2 * 3600_000);
    const remDay2 = new Date(Date.now() + 20 * 3600_000);
    const remCreate = await api('POST', '/api/events', founderToken, {
      communityId: community._id.toString(),
      title: `Reminder Summit ${stamp}`,
      shortDescription: 'Reminder live test event',
      mode: 'PHYSICAL',
      venue: 'Reminder Hall',
      bannerImage: '/uploads/smoke-banner.png',
      startDate: remStart.toISOString(),
      endDate: new Date(remDay2.getTime() + 8 * 3600_000).toISOString(),
      registrationPolicy: 'OPEN',
      capacity: 0,
      visibility: 'PUBLIC',
      timezone: TEST_TZ,
      days: [
        { date: remStart.toISOString(), theme: 'Day 1: Kickoff', venue: 'Reminder Hall', features: ['Opening'] },
        { date: remDay2.toISOString(), theme: 'Day 2: Wrap-up', venue: 'Reminder Annex', features: ['Closing'] },
      ],
    });
    reminderEventId = remCreate.json?.event?._id ?? '';
    check('reminder event created', remCreate.status === 201 && !!reminderEventId, remCreate.status);
    await api('POST', `/api/events/${reminderEventId}/publish`, founderToken);
    const remReg = await api('POST', `/api/events/${reminderEventId}/register`, fullToken);
    check('attendee registered for reminder event', remReg.status === 201, remReg.status);

    await sendDueEventReminders(24 * 3600_000);
    const remEvent = await EventModel.findById(reminderEventId).lean();
    check('whole-event reminder stamped', !!remEvent?.reminderSentAt, remEvent?.reminderSentAt);
    check('day-2 reminder stamped', (remEvent?.dayRemindersSent ?? []).includes('d2'), remEvent?.dayRemindersSent);
    const bellMain = await NotificationModel.findOne({ userId: fullAttendeeId, title: { $regex: '^Reminder Summit.*starts soon' } }).lean();
    const bellDay = await NotificationModel.findOne({ userId: fullAttendeeId, title: { $regex: '^Day 2 of Reminder Summit.*starts soon' } }).lean();
    check('bell notification for event start', !!bellMain, bellMain?.title);
    check('bell notification for Day 2', !!bellDay, bellDay?.title);
    const rerun = await sendDueEventReminders(24 * 3600_000);
    const bellCount = await NotificationModel.countDocuments({ userId: fullAttendeeId, title: { $regex: 'starts soon|less than an hour' } });
    check('re-run sends nothing new (idempotent)', bellCount === 2, { rerun, bellCount });

    // Last-call nudges (~1h before): shift the event to start in 30 min and
    // backdate the day-before stamp so the anti-double-ping guard passes.
    await EventModel.updateOne(
      { _id: reminderEventId },
      { $set: { startDate: new Date(Date.now() + 30 * 60_000), reminderSentAt: new Date(Date.now() - 3600_000) } },
    );
    await sendDueEventReminders(24 * 3600_000);
    const afterFinal = await EventModel.findById(reminderEventId).lean();
    check('last-call stamp set (event start)', !!afterFinal?.finalReminderSentAt, afterFinal?.finalReminderSentAt);
    const bellFinal = await NotificationModel.findOne({ userId: fullAttendeeId, title: { $regex: '^Reminder Summit.*less than an hour' } }).lean();
    check('bell last call for event start', !!bellFinal, bellFinal?.title);

    // Day 2 last call: move Day 2 to 40 min from now.
    await EventModel.updateOne(
      { _id: reminderEventId },
      { $set: { 'days.1.date': new Date(Date.now() + 40 * 60_000) } },
    );
    await sendDueEventReminders(24 * 3600_000);
    const afterDayFinal = await EventModel.findById(reminderEventId).lean();
    check('day-2 last-call marker set', (afterDayFinal?.dayRemindersSent ?? []).includes('d2-final'), afterDayFinal?.dayRemindersSent);
    const bellDayFinal = await NotificationModel.findOne({ userId: fullAttendeeId, title: { $regex: '^Day 2 of Reminder Summit.*less than an hour' } }).lean();
    check('bell last call for Day 2', !!bellDayFinal, bellDayFinal?.title);

    // ── CLONE ────────────────────────────────────────────────────
    console.log('\nCLONE');
    const clone = await api('POST', `/api/events/${eventId}/clone`, founderToken);
    check('clone -> 201', clone.status === 201 || clone.status === 200, clone.status);
    cloneId = clone.json?.event?._id ?? '';
    const clonedDays = clone.json?.event?.days ?? [];
    check('clone carries day agenda (3 days)', clonedDays.length === 3, clonedDays.length);
    check('cloned day dates reset to null', clonedDays.every((d: any) => d.date === null), clonedDays.map((d: any) => d.date));
    check('clone keeps minimumAttendanceDays', clone.json?.event?.minimumAttendanceDays === 2, clone.json?.event?.minimumAttendanceDays);
    check('clone carries facilitators', clonedDays[0]?.facilitators?.[0]?.name === 'Dr. Amina Bello', clonedDays[0]?.facilitators);
    check('clone carries sessions', clonedDays[0]?.sessions?.length === 2 && clonedDays[0]?.sessions?.[0]?.title === 'Opening Keynote', clonedDays[0]?.sessions);
    const clonedSpeakers = await EventSpeakerModel.find({ eventId: cloneId }).lean();
    check('cloned speakers keep day assignment', clonedSpeakers.some((s) => s.fullName === 'Day Two Speaker' && s.day === 2), clonedSpeakers.map((s) => ({ n: s.fullName, d: s.day })));

    // ── SINGLE-DAY REGRESSION ────────────────────────────────────
    console.log('\nSINGLE-DAY REGRESSION');
    const single = await api('POST', '/api/events', founderToken, {
      communityId: community._id.toString(),
      title: `Single Day Check ${stamp}`,
      shortDescription: 'Single-day regression',
      mode: 'PHYSICAL',
      venue: 'Room 1',
      bannerImage: '/uploads/smoke-banner.png',
      startDate: new Date(now - 3600_000).toISOString(),
      endDate: new Date(now - 60_000).toISOString(),
      registrationPolicy: 'OPEN',
      visibility: 'PUBLIC',
    });
    const singleId = single.json?.event?._id ?? '';
    await api('POST', `/api/events/${singleId}/publish`, founderToken);
    const sReg = await api('POST', `/api/events/${singleId}/register`, oneDayToken);
    await api('POST', `/api/events/${singleId}/status`, founderToken, { status: 'CHECK_IN' });
    const sScan = await api('POST', `/api/events/check-in/${sReg.json?.registration?.qrToken}`, founderToken);
    check('single-day check-in works', sScan.status === 200, sScan.status);
    const sDup = await api('POST', `/api/events/check-in/${sReg.json?.registration?.qrToken}`, founderToken);
    check('single-day duplicate blocked (classic message)', sDup.status >= 400 && String(sDup.json?.error ?? '').includes('checked in') && !String(sDup.json?.error ?? '').includes('today'), sDup.json?.error);
    const sRegDoc = await EventRegistrationModel.findOne({ eventId: singleId, userId: oneDayAttendeeId }).lean();
    const sOut = await api('POST', `/api/events/${singleId}/registrations/${sRegDoc?._id}/check-out`, founderToken);
    check('single-day checkout past end -> COMPLETED (stay-to-end rule intact)', sOut.status === 200 && sOut.json?.registration?.status === 'COMPLETED', sOut.json?.registration?.status);
    await EventRegistrationModel.deleteMany({ eventId: singleId });
    await EventModel.deleteOne({ _id: singleId });
  } finally {
    // ── Teardown ─────────────────────────────────────────────────
    console.log('\nCleaning up…');
    const eventIds = [eventId, cloneId, reminderEventId].filter(Boolean);
    if (eventIds.length) {
      await EventRegistrationModel.deleteMany({ eventId: { $in: eventIds } });
      await CertificateModel.deleteMany({ eventId: { $in: eventIds } });
      await EventSpeakerModel.deleteMany({ eventId: { $in: eventIds } });
      await EventModel.deleteMany({ _id: { $in: eventIds } });
    }
    await MembershipModel.deleteMany({ communityId: community._id });
    await CommunityModel.deleteOne({ _id: community._id });
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
