/**
 * Demo data for trying the new website by hand: two accounts you can sign in with, a demo community,
 * and events in every state (live, tomorrow, next week, on another site, cancelled, attended, missed).
 *
 *   npm run demo             create it (or reset it to a fresh state)
 *   npm run demo -- remove   delete all of it
 *
 * Accounts (password Demo!2026):
 *   demo-student@example.com    a student: has a pass for tomorrow, is scanned in at the live event,
 *                               attended a past event (stamp + certificate) and missed another
 *   demo-organizer@example.com  runs AI Builders Club: sees the organizer panel on its events
 *
 * Test fixtures (all demo data, same password unless noted):
 *   demo-student2@example.com   a second student in Ada's department (Computer Science), listed "department only"
 *   demo-helper@example.com     an Event Helper: Helper role in the club, assigned to the live and tomorrow events
 *   demo-reviewer@example.com   a platform reviewer (ADMIN). ONLY created when the database is on this machine
 *                               (npm run demo:test): a reviewer can approve communities, so it never exists on a
 *                               hosted database.
 *   Events: an ended external listing (demo-external-ended) and an ended, not yet finalized one (demo-study-jam).
 *   Ada has 12 unread notifications.
 *
 * Demo events have slugs starting with demo- (the web2 Events page shows a Demo data banner), and accounts use @example.com, so it is easy to spot and to remove.
 * Email is switched off while this runs, so nothing is sent.
 */
process.env.SMTP_HOST = '';

const PASSWORD = 'Demo!2026';
const STUDENT = 'demo-student@example.com';
const ORGANIZER = 'demo-organizer@example.com';
const STUDENT2 = 'demo-student2@example.com';
const HELPER = 'demo-helper@example.com';
const REVIEWER = 'demo-reviewer@example.com';
const DEMO_EMAILS = [STUDENT, ORGANIZER, STUDENT2, HELPER, REVIEWER];
const SLUG = 'demo-ai-society';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function main() {
  const mongoose = (await import('mongoose')).default;
  const { config } = await import('../src/config');
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run against production');
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db!;

  await remove(db);
  if (process.argv.includes('remove')) { console.log('Demo data removed.'); return mongoose.disconnect(); }

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
  // A reviewer can approve communities: only ever on a database on this machine, never a hosted one.
  const localDatabase = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(config.mongoUri);
  if (localDatabase) await account('Rita Demo (reviewer)', REVIEWER, 'demo_reviewer', { role: 'ADMIN' });
  const organizer = await account('Tobi Demo', ORGANIZER, 'demo_organizer', { communityAccessStatus: 'APPROVED' });

  // Reuse an existing logo so the community has a picture (logo is required).
  const anyLogo = (await CommunityModel.findOne({ logo: { $nin: ['', null] } }).select('logo').lean())?.logo ?? '/uploads/logo.png';
  const community = await CommunityModel.create({
    name: 'AI Builders Club', normalizedName: 'ai builders club', slug: SLUG,
    shortDescription: 'Students building with AI at ABU. Demo community.',
    description: 'A **demo community** for trying the new website.\n\n- Weekly workshops\n- A hackathon every semester\n- Career talks with alumni',
    logo: anyLogo, category: 'Technology', university: school, founder: organizer._id,
    verificationStatus: 'VERIFIED', visibility: 'PUBLIC', memberCount: 4,
    chatLinks: [{ platform: 'WHATSAPP', url: 'https://chat.whatsapp.com/DemoInviteLink' }],
  });
  await MembershipModel.create([
    { userId: organizer._id, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE' },
    { userId: student._id, communityId: community._id, role: 'MEMBER', status: 'ACTIVE' },
    { userId: student2._id, communityId: community._id, role: 'MEMBER', status: 'ACTIVE' },
    { userId: helper._id, communityId: community._id, role: 'VOLUNTEER', status: 'ACTIVE' },
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
  // Ended an hour ago, attendance NOT finalized yet (the backend auto-finalizes 3 h after the end): checked in, never scanned out.
  const toFinish = await event('demo-study-jam', 'Cloud Study Jam', at(now - 4 * HOUR), at(now - HOUR),
    { type: 'TRAINING', status: 'CHECK_OUT', certificateEnabled: true, minimumAttendanceDuration: 0, registrationCount: 1, checkedInCount: 1 });
  const missed = await event('demo-open-mic', 'Open Mic Night', day(-13, 18), day(-13, 21),
    { type: 'MEETUP', status: 'CHECK_OUT' });

  const reg = (eventId: unknown, status: string, extra: Record<string, unknown> = {}) => EventRegistrationModel.create({
    eventId, userId: student._id, status, qrToken: crypto.randomBytes(24).toString('hex'),
    passCode: crypto.randomBytes(3).toString('hex').toUpperCase(), ...extra,
  });
  await reg(tomorrow._id, 'CONFIRMED');
  await reg(live._id, 'CHECKED_IN', { checkInAt: at(now - 40 * 60_000) });
  await reg(attended._id, 'COMPLETED', { certificateEligible: true, checkInAt: new Date(attended.startDate!.getTime() + 5 * 60_000), checkOutAt: new Date(attended.endDate!.getTime() + 5 * 60_000) });
  await reg(missed._id, 'CONFIRMED');
  await reg(toFinish._id, 'CHECKED_IN', { checkInAt: new Date(toFinish.startDate!.getTime() + 10 * 60_000) });
  // Bola (department only) is going tomorrow too.
  await EventRegistrationModel.create({ eventId: tomorrow._id, userId: student2._id, status: 'CONFIRMED', qrToken: crypto.randomBytes(24).toString('hex') });

  // The Event Helper is assigned to the live event and tomorrow's.
  const { EventVolunteerModel } = await import('../src/models/event-volunteer.model');
  await EventVolunteerModel.create([live, tomorrow].map((e) => ({ eventId: e._id, userId: helper._id, fullName: 'Chidi Demo', role: 'Event Helper', addedBy: organizer._id })));

  // Ada has 12 unread notifications (for the "9+" badge).
  const { NotificationModel } = await import('../src/models/notification.model');
  await NotificationModel.create(Array.from({ length: 12 }, (_, i) => ({
    userId: student._id, type: 'SYSTEM', title: `Demo notification ${i + 1}`, body: 'A demo notification for testing the unread badge.', link: '/events', read: false,
  })));

  // Close attendance on the past events the real way: stamps, the certificate, points, no-shows, the thank-you.
  for (const e of [attended, missed]) {
    await finalizeEventAttendance(String(e._id), String(organizer._id)).catch((err: Error) => console.warn(`  could not close ${e.slug}: ${err.message}`));
  }

  // Keep demo counters in sync with the registration records above. Other event
  // samples that model registrations on an external site retain their own totals.
  for (const e of [live, tomorrow, hackathon, attended, toFinish, missed]) {
    await recalcEventCounters(String(e._id));
  }
  await recalcCommunityEventCount(community._id);

  console.log(`
Demo data ready. Password for the demo accounts: ${PASSWORD}
  Student    ${STUDENT}
  Student 2  ${STUDENT2}   (same department as Ada, listed for her department only)
  Organizer  ${ORGANIZER}
  Helper     ${HELPER}
  Reviewer   ${localDatabase ? REVIEWER : '(not created: this database is not on this machine)'}
Community: AI Builders Club (/communities/${SLUG}), 9 events.
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
