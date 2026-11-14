/**
 * Demo data for trying the new website by hand: two accounts you can sign in with, a demo community,
 * and events in every state (live, tomorrow, next week, on another site, cancelled, attended, missed).
 *
 *   npm run demo             create it (or reset it to a fresh state)
 *   npm run demo -- remove   delete all of it
 *
 * Accounts (the password is printed at the end of each run):
 *   demo-student@example.com    a student: has a pass for tomorrow, is scanned in at the live event,
 *                               attended a past event (stamp + certificate) and missed another
 *   demo-organizer@example.com  runs AI Builders Club: sees the organizer panel on its events
 *
 * Test fixtures (all demo data, one shared password: see demoPassword() below):
 *   demo-student2@example.com   a second student in Ada's department (Computer Science), listed "department only"
 *   demo-helper@example.com     an Event Helper: Helper role in the club, assigned to the live and tomorrow events
 *   demo-reviewer@example.com   a platform reviewer (ADMIN). The script only runs against the local test database.
 *   Events: an ended external listing (demo-external-ended) and an ended, not yet finalized one (demo-study-jam).
 *   Ada has 12 unread notifications.
 *
 *   npm run demo:test        (local test database only; see scripts/test-env.ts)
 *
 * Demo events have slugs starting with demo- (the web2 Events page shows a Demo data banner), and accounts use @example.com, so it is easy to spot and to remove.
 * Email is switched off while this runs, so nothing is sent.
 */
process.env.SMTP_HOST = '';

/**
 * The demo accounts' password. Never written in the repo: set DEMO_PASSWORD, or a random one is made
 * on the first run and kept in backend/.testdb/demo-password.txt (git-ignored) for the next runs.
 */
function demoPassword() {
  if (process.env.DEMO_PASSWORD) return process.env.DEMO_PASSWORD;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs'); const path = require('node:path') as typeof import('node:path'); const crypto = require('node:crypto') as typeof import('node:crypto');
  const file = path.resolve(process.cwd(), '.testdb', 'demo-password.txt');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const made = `Demo-${crypto.randomBytes(9).toString('base64url')}7a`;
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, made);
  return made;
}
const STUDENT = 'demo-student@example.com';
const ORGANIZER = 'demo-organizer@example.com';
const STUDENT2 = 'demo-student2@example.com';
const HELPER = 'demo-helper@example.com';
const REVIEWER = 'demo-reviewer@example.com';
const ADMIN = 'demo-admin@example.com';
const UNVERIFIED = 'demo-unverified@example.com';
const DEMO_EMAILS = [STUDENT, ORGANIZER, STUDENT2, HELPER, REVIEWER, ADMIN, UNVERIFIED];
const SLUG = 'demo-ai-society';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function main() {
  const mongoose = (await import('mongoose')).default;
  const { config } = await import('../src/config');
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run against production');
  // Demo data lives only in the local test database. Removing it works anywhere (that is how it left the live one).
  const removing = process.argv.includes('remove');
  if (!removing && !/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(config.mongoUri)) {
    throw new Error('Demo data only goes into the local test database. Start it with "npm run dev:test", then run "npm run demo:test".');
  }
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db!;

  await remove(db);
  if (removing) { console.log('Demo data removed.'); return mongoose.disconnect(); }
  const PASSWORD = demoPassword();

  const { UserModel } = await import('../src/models/user.model');
  const { CommunityModel } = await import('../src/models/community.model');
  const { MembershipModel } = await import('../src/models/membership.model');
  const { EventModel } = await import('../src/models/event.model');
  const { EventRegistrationModel } = await import('../src/models/event-registration.model');
  const { hashPassword } = await import('../src/utils/password');
  const { finalizeEventAttendance } = await import('../src/services/event/event-attendance.service');
  const { recalcCommunityEventCount, recalcEventCounters } = await import('../src/services/event/event-shared');
  const crypto = await import('node:crypto');

  const school = 'Ahmadu Bello University';
  const account = (fullName: string, email: string, username: string, extra: Record<string, unknown> = {}, profile: Record<string, unknown> = {}, password = PASSWORD) => {
    const { salt, hash } = hashPassword(password);
    return UserModel.create({
      fullName, email, passwordHash: hash, passwordSalt: salt, role: 'STUDENT', emailVerified: true, onboardingCompleted: true,
      profile: { username, university: school, interests: ['Technology', 'Design'], bio: 'Demo account for testing the new website.', ...profile },
      ...extra,
    });
  };
  const sameDept = { faculty: 'Physical Sciences', department: 'Computer Science', level: '300' };
  const student = await account('Ada Demo', STUDENT, 'demo_student', {}, sameDept);
  // Same department as Ada, and listed for her department only: Ada sees Bola on guest lists, other students don't.
  const student2 = await account('Bola Demo', STUDENT2, 'demo_student2', { guestVisibility: 'DEPARTMENT_ONLY' }, sameDept);
  const helper = await account('Chidi Demo', HELPER, 'demo_helper', {}, { faculty: 'Engineering', department: 'Electrical Engineering', level: '200' });
  await account('Rita Demo (reviewer)', REVIEWER, 'demo_reviewer', { role: 'ADMIN' });
  const organizer = await account('Tobi Demo', ORGANIZER, 'demo_organizer', { communityAccessStatus: 'APPROVED' });
  // Has not confirmed their email: can browse and register, but certificates wait until they verify.
  const unverified = await account('Femi Demo (unverified)', UNVERIFIED, 'demo_unverified', { emailVerified: false });
  // An Admin of the club who is not its Owner: manages members, but must not see their email addresses.
  const admin = await account('Dayo Demo (admin)', ADMIN, 'demo_admin', { communityAccessStatus: 'APPROVED' }, { faculty: 'Physical Sciences', department: 'Mathematics', level: '400' });

  // Reuse an existing logo so the community has a picture (logo is required).
  const anyLogo = (await CommunityModel.findOne({ logo: { $nin: ['', null] } }).select('logo').lean())?.logo ?? '/uploads/logo.png';
  const community = await CommunityModel.create({
    name: 'AI Builders Club', normalizedName: 'ai builders club', slug: SLUG,
    shortDescription: 'Students building with AI at ABU. Demo community.',
    description: 'A **demo community** for trying the new website.\n\n- Weekly workshops\n- A hackathon every semester\n- Career talks with alumni',
    logo: anyLogo, category: 'Technology', university: school, founder: organizer._id,
    verificationStatus: 'VERIFIED', visibility: 'PUBLIC', memberCount: 5,
    chatLinks: [{ platform: 'WHATSAPP', url: 'https://chat.whatsapp.com/DemoInviteLink' }],
  });
  await MembershipModel.create([
    { userId: organizer._id, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE' },
    { userId: student._id, communityId: community._id, role: 'MEMBER', status: 'ACTIVE' },
    { userId: student2._id, communityId: community._id, role: 'MEMBER', status: 'ACTIVE' },
    { userId: helper._id, communityId: community._id, role: 'VOLUNTEER', status: 'ACTIVE' },
    { userId: admin._id, communityId: community._id, role: 'VICE_PRESIDENT', status: 'ACTIVE', title: 'Vice President' },
  ]);

  const now = Date.now();
  const at = (ms: number) => new Date(ms);
  // Tomorrow 2pm and next week 9am, Nigeria time (UTC+1).
  const day = (offsetDays: number, hourLagos: number) => { const d = new Date(now + offsetDays * DAY); d.setUTCHours(hourLagos - 1, 0, 0, 0); return d; };
  const event = (slug: string, title: string, start: Date, end: Date, more: Record<string, unknown>) => EventModel.create({
    communityId: community._id, createdBy: organizer._id, title, normalizedTitle: title.toLowerCase(), slug,
    eventStartDay: start.toISOString().slice(0, 10), startDate: start, endDate: end, timezone: 'Africa/Lagos',
    visibility: 'PUBLIC', registrationPolicy: 'OPEN', mode: 'PHYSICAL', venue: 'Senate Building Hall', state: 'Kaduna',
    status: 'PUBLISHED', qrEnabled: true, checkOutRequired: true, certificateEnabled: false,
    shortDescription: `${title}. A demo event.`,
    description: '## What to expect\n\nA **demo event** for testing the new website.\n\n- Hands-on activities\n- Meet other students\n- Scan in at the door to earn your stamp',
    ...more,
  });

  // External listings are not scanned here, so their description must not promise a stamp at the door.
  const EXTERNAL_DESCRIPTION = ['## What to expect', '', 'A **demo event** listed here and run on Luma.', '', '- Register on Luma', '- Join details come from Luma', '- Meet other students'].join('\n');
  const live = await event('demo-ml-workshop', 'Intro to Machine Learning Workshop', at(now - 45 * 60_000), at(now + 2 * HOUR),
    { type: 'WORKSHOP', status: 'CHECK_IN', capacity: 60, certificateEnabled: true });
  const tomorrow = await event('demo-careers-seminar', 'Careers in Tech Seminar', day(1, 14), day(1, 17),
    { type: 'SEMINAR', capacity: 80, certificateEnabled: true });
  const hackathon = await event('demo-campus-hackathon', '24-hour Campus Hackathon', day(7, 9), day(8, 9),
    { type: 'HACKATHON', capacity: 150, venue: 'Engineering Complex' });
  // External listing: no head count here (people register on the other site), so the page and the workspace agree.
  await event('demo-design-sprint', 'Design Sprint (registration on Luma)', day(4, 16), day(4, 18),
    { type: 'MEETUP', mode: 'VIRTUAL', venue: '', attendanceSource: 'EXTERNAL', qrEnabled: false,
      partnerRegistrationUrl: 'https://lu.ma/demo-design-sprint', partnerRegistrationLabel: 'Luma', description: EXTERNAL_DESCRIPTION });
  await event('demo-robotics-showcase', 'Robotics Showcase', day(3, 11), day(3, 15),
    { type: 'CONFERENCE', status: 'ARCHIVED', registrationCount: 0, cancellationReason: 'The hall booking fell through. A new date is coming soon.' });
  // An external listing that has ended and is not finalized: the organizer's "Finalize attendance" step is waiting.
  await event('demo-external-ended', 'Product Design Meetup (registration on Luma)', day(-2, 16), day(-2, 18),
    { type: 'MEETUP', mode: 'VIRTUAL', venue: '', attendanceSource: 'EXTERNAL', qrEnabled: false,
      partnerRegistrationUrl: 'https://lu.ma/demo-product-design', partnerRegistrationLabel: 'Luma', description: EXTERNAL_DESCRIPTION });
  const attended = await event('demo-python-beginners', 'Python for Beginners', day(-6, 10), day(-6, 13),
    { type: 'WORKSHOP', status: 'CHECK_OUT', certificateEnabled: true, minimumAttendanceDuration: 0 });
  // Ended an hour ago, attendance NOT finalized yet (the backend auto-finalizes 24 h after the end): checked in, never scanned out.
  const toFinish = await event('demo-study-jam', 'Cloud Study Jam', at(now - 4 * HOUR), at(now - HOUR),
    { type: 'TRAINING', status: 'CHECK_OUT', certificateEnabled: true, minimumAttendanceDuration: 0, registrationCount: 1, checkedInCount: 1 });
  const missed = await event('demo-open-mic', 'Open Mic Night', day(-13, 18), day(-13, 21),
    { type: 'MEETUP', status: 'CHECK_OUT' });
  // An external listing whose organizer applied Luma's attendance report and finalized: Ada's attendance comes from the report.
  const reported = await event('demo-external-reported', 'Figma Basics (registration on Luma)', day(-5, 16), day(-5, 18),
    { type: 'WORKSHOP', mode: 'VIRTUAL', venue: '', attendanceSource: 'EXTERNAL', qrEnabled: false, certificateEnabled: true,
      partnerRegistrationUrl: 'https://lu.ma/demo-figma-basics', partnerRegistrationLabel: 'Luma', description: EXTERNAL_DESCRIPTION });

  // Multi-day events. Each day is a calendar day in Lagos with its own hours; attendance is judged per day.
  const lagosDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const lagosTime = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  const agenda = (starts: Date[], hours: number) => starts.map((s, i) => ({ date: s, theme: `Day ${i + 1}`, venue: 'Engineering Complex', startTime: lagosTime(s), endTime: lagosTime(new Date(s.getTime() + hours * HOUR)) }));
  // Running now: Day 1 was yesterday, Day 2 is today, Day 3 is tomorrow. Two of three days are needed.
  const liveStarts = [day(-1, 9), day(0, 9), day(1, 9)];
  const multiLive = await event('demo-multiday-live', 'Build Week Bootcamp', liveStarts[0], new Date(liveStarts[2].getTime() + 8 * HOUR),
    { type: 'BOOTCAMP', status: 'CHECK_IN', certificateEnabled: true, minimumAttendanceDays: 2, venue: 'Engineering Complex', days: agenda(liveStarts, 8) });
  // Ended two hours ago, not finalized: Ada attended Days 1 and 2 (enough), Bola only Day 1 (not enough).
  const lastStart = new Date(now - 4 * HOUR);
  const pastStarts = [new Date(lastStart.getTime() - 2 * DAY), new Date(lastStart.getTime() - DAY), lastStart];
  const multiPast = await event('demo-multiday-past', 'Data Science Week', pastStarts[0], new Date(lastStart.getTime() + 2 * HOUR),
    { type: 'BOOTCAMP', status: 'CHECK_OUT', certificateEnabled: true, minimumAttendanceDays: 2, venue: 'Engineering Complex', days: agenda(pastStarts, 2) });

  const reg = (eventId: unknown, status: string, extra: Record<string, unknown> = {}) => EventRegistrationModel.create({
    eventId, userId: student._id, status, qrToken: crypto.randomBytes(24).toString('hex'),
    passCode: crypto.randomBytes(3).toString('hex').toUpperCase(), ...extra,
  });
  await reg(tomorrow._id, 'CONFIRMED');
  await reg(live._id, 'CHECKED_IN', { checkInAt: at(now - 40 * 60_000) });
  await reg(attended._id, 'COMPLETED', { certificateEligible: true, checkInAt: new Date(attended.startDate!.getTime() + 5 * 60_000), checkOutAt: new Date(attended.endDate!.getTime() + 5 * 60_000) });
  await reg(missed._id, 'CONFIRMED');
  // Femi attended Python for Beginners too (complete record), but hasn't verified their email yet.
  await EventRegistrationModel.create({ eventId: attended._id, userId: unverified._id, status: 'COMPLETED', certificateEligible: true, qrToken: crypto.randomBytes(24).toString('hex'),
    checkInAt: new Date(attended.startDate!.getTime() + 7 * 60_000), checkOutAt: new Date(attended.endDate!.getTime() + 4 * 60_000) });
  await reg(toFinish._id, 'CHECKED_IN', { checkInAt: new Date(toFinish.startDate!.getTime() + 10 * 60_000) });
  // Bola (department only) is going tomorrow too.
  await EventRegistrationModel.create({ eventId: tomorrow._id, userId: student2._id, status: 'CONFIRMED', qrToken: crypto.randomBytes(24).toString('hex') });

  // Multi-day attendance, as the door scanner records it: one entry per day.
  const dayEntry = (start: Date, inMin: number, outMin: number) => ({ day: lagosDay(start), checkInAt: new Date(start.getTime() + inMin * 60_000), checkOutAt: new Date(start.getTime() + outMin * 60_000), minutes: outMin - inMin });
  const d1 = dayEntry(liveStarts[0], 5, 470);
  await reg(multiLive._id, 'CHECKED_OUT', { checkInAt: d1.checkInAt, checkOutAt: d1.checkOutAt, attendanceMinutes: d1.minutes, attendanceDays: [d1], attendanceVerified: true });
  const a1 = dayEntry(pastStarts[0], 5, 115); const a2 = dayEntry(pastStarts[1], 3, 118);
  await reg(multiPast._id, 'CHECKED_OUT', { checkInAt: a1.checkInAt, checkOutAt: a2.checkOutAt, attendanceMinutes: a1.minutes + a2.minutes, attendanceDays: [a1, a2], attendanceVerified: true });
  const b1 = dayEntry(pastStarts[0], 10, 110);
  await EventRegistrationModel.create({ eventId: multiPast._id, userId: student2._id, status: 'CHECKED_OUT', qrToken: crypto.randomBytes(24).toString('hex'),
    checkInAt: b1.checkInAt, checkOutAt: b1.checkOutAt, attendanceMinutes: b1.minutes, attendanceDays: [b1], attendanceVerified: true });

  // External attendance, the real way: Ada and Bola registered here, the organizer imports Luma's report
  // (which only lists Ada, plus someone who never registered here), applies it, and finalizes.
  await reg(reported._id, 'CONFIRMED');
  await EventRegistrationModel.create({ eventId: reported._id, userId: student2._id, status: 'CONFIRMED', qrToken: crypto.randomBytes(24).toString('hex') });
  const { previewExternalReport, applyExternalReport } = await import('../src/services/event/external-report.service');
  const report = await previewExternalReport(String(reported._id), String(organizer._id), {
    kind: 'ATTENDANCE', filename: 'luma-attendance.csv', text: `email,minutes\n${STUDENT},95\nsomeone.else@example.org,40\n`,
  }) as unknown as { reportId?: string; _id?: unknown; report?: { _id?: unknown } };
  const reportId = String(report.reportId ?? report.report?._id ?? report._id);
  await applyExternalReport(String(reported._id), String(organizer._id), reportId);

  // The Event Helper is assigned to the live event and tomorrow's.
  const { EventVolunteerModel } = await import('../src/models/event-volunteer.model');
  await EventVolunteerModel.create([live, tomorrow].map((e) => ({ eventId: e._id, userId: helper._id, fullName: 'Chidi Demo', role: 'Event Helper', addedBy: organizer._id })));

  // Ada has 12 unread notifications (for the "9+" badge).
  const { NotificationModel } = await import('../src/models/notification.model');
  await NotificationModel.create(Array.from({ length: 12 }, (_, i) => ({
    userId: student._id, type: 'SYSTEM', title: `Demo notification ${i + 1}`, body: 'A demo notification for testing the unread badge.', link: '/events', read: false,
  })));

  // Close attendance on the past events the real way: stamps, the certificate, points, no-shows, the thank-you.
  for (const e of [attended, missed, reported]) {
    await finalizeEventAttendance(String(e._id), String(organizer._id)).catch((err: Error) => console.warn(`  could not close ${e.slug}: ${err.message}`));
  }

  // Keep demo counters in sync with the registration records above. Other event
  // samples that model registrations on an external site retain their own totals.
  for (const e of [live, tomorrow, hackathon, attended, toFinish, missed, reported, multiLive, multiPast]) {
    await recalcEventCounters(String(e._id));
  }
  await recalcCommunityEventCount(community._id);

  console.log(`
Demo data ready. Password for the demo accounts: ${PASSWORD}
  Student    ${STUDENT}
  Student 2  ${STUDENT2}   (same department as Ada, listed for her department only)
  Organizer  ${ORGANIZER}
  Helper     ${HELPER}
  Reviewer   ${REVIEWER}
  Admin      ${ADMIN}   (Vice President of the club, not its Owner)
  Unverified ${UNVERIFIED}   (email not verified: attended Python for Beginners, certificate held)
Community: AI Builders Club (/communities/${SLUG}), 12 events.
Remove it with: npm run demo -- remove`);
  await mongoose.disconnect();
}

/** Deletes the demo accounts, their community, its events, and every record pointing at any of them. */
async function remove(db: import('mongodb').Db) {
  const users = await db.collection('users').find({ email: { $in: DEMO_EMAILS } }).project({ _id: 1 }).toArray();
  const userIds = users.map((u) => u._id);
  const communities = await db.collection('communities').find({ slug: SLUG }).project({ _id: 1 }).toArray();
  const communityIds = communities.map((c) => c._id);
  const events = await db.collection('events').find({ communityId: { $in: communityIds } }).project({ _id: 1 }).toArray();
  const eventIds = events.map((e) => e._id);
  const regs = await db.collection('eventregistrations').find({ eventId: { $in: eventIds } }).project({ _id: 1 }).toArray();
  const ids = [...userIds, ...communityIds, ...eventIds, ...regs.map((r) => r._id)];
  if (!ids.length) return;
  const fields = ['userId', 'user', 'founder', 'createdBy', 'communityId', 'eventId', 'recipientId', 'invitedBy', 'respondedBy', 'registrationId', 'referenceId', 'actorId'];
  for (const { name } of await db.listCollections().toArray()) {
    const or: Record<string, unknown>[] = fields.map((f) => ({ [f]: { $in: ids } }));
    if (name === 'users') or.push({ _id: { $in: userIds } });
    if (name === 'communities') or.push({ _id: { $in: communityIds } });
    if (name === 'events') or.push({ _id: { $in: eventIds } });
    await db.collection(name).deleteMany({ $or: or });
  }
}

main().catch(async (err) => {
  console.error('Demo data failed:', err instanceof Error ? err.message : err);
  const mongoose = (await import('mongoose')).default;
  await mongoose.disconnect();
  process.exit(1);
});
