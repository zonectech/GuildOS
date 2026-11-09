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
 * Demo events have slugs starting with demo- (the web2 Events page shows a Demo data banner), and accounts use @example.com, so it is easy to spot and to remove.
 * Email is switched off while this runs, so nothing is sent.
 */
process.env.SMTP_HOST = '';

const PASSWORD = 'Demo!2026';
const STUDENT = 'demo-student@example.com';
const ORGANIZER = 'demo-organizer@example.com';
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
  const crypto = await import('node:crypto');

  const school = 'Ahmadu Bello University';
  const account = (fullName: string, email: string, username: string, extra: Record<string, unknown> = {}) => {
    const { salt, hash } = hashPassword(PASSWORD);
    return UserModel.create({
      fullName, email, passwordHash: hash, passwordSalt: salt, role: 'STUDENT', emailVerified: true, onboardingCompleted: true,
      profile: { username, university: school, interests: ['Technology', 'Design'], bio: 'Demo account for testing the new website.' },
      ...extra,
    });
  };
  const student = await account('Ada Demo', STUDENT, 'demo_student');
  const organizer = await account('Tobi Demo', ORGANIZER, 'demo_organizer', { communityAccessStatus: 'APPROVED' });

  // Reuse an existing logo so the community has a picture (logo is required).
  const anyLogo = (await CommunityModel.findOne({ logo: { $nin: ['', null] } }).select('logo').lean())?.logo ?? '/uploads/logo.png';
  const community = await CommunityModel.create({
    name: 'AI Builders Club', normalizedName: 'ai builders club', slug: SLUG,
    shortDescription: 'Students building with AI at ABU. Demo community.',
    description: 'A **demo community** for trying the new website.\n\n- Weekly workshops\n- A hackathon every semester\n- Career talks with alumni',
    logo: anyLogo, category: 'Technology', university: school, founder: organizer._id,
    verificationStatus: 'VERIFIED', visibility: 'PUBLIC', memberCount: 2,
    chatLinks: [{ platform: 'WHATSAPP', url: 'https://chat.whatsapp.com/DemoInviteLink' }],
  });
  await MembershipModel.create([
    { userId: organizer._id, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE' },
    { userId: student._id, communityId: community._id, role: 'MEMBER', status: 'ACTIVE' },
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

  const live = await event('demo-ml-workshop', 'Intro to Machine Learning Workshop', at(now - 45 * 60_000), at(now + 2 * HOUR),
    { type: 'WORKSHOP', status: 'CHECK_IN', capacity: 60, registrationCount: 42, checkedInCount: 27, certificateEnabled: true });
  const tomorrow = await event('demo-careers-seminar', 'Careers in Tech Seminar', day(1, 14), day(1, 17),
    { type: 'SEMINAR', capacity: 80, registrationCount: 18, certificateEnabled: true });
  await event('demo-campus-hackathon', '24-hour Campus Hackathon', day(7, 9), day(8, 9),
    { type: 'HACKATHON', capacity: 150, registrationCount: 64, venue: 'Engineering Complex' });
  await event('demo-design-sprint', 'Design Sprint (registration on Luma)', day(4, 16), day(4, 18),
    { type: 'MEETUP', mode: 'VIRTUAL', venue: '', attendanceSource: 'EXTERNAL', qrEnabled: false, registrationCount: 9,
      partnerRegistrationUrl: 'https://lu.ma/demo-design-sprint', partnerRegistrationLabel: 'Luma' });
  await event('demo-robotics-showcase', 'Robotics Showcase', day(3, 11), day(3, 15),
    { type: 'CONFERENCE', status: 'ARCHIVED', registrationCount: 0, cancellationReason: 'The hall booking fell through. A new date is coming soon.' });
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

  // Close attendance on the past events the real way: stamps, the certificate, points, no-shows, the thank-you.
  for (const e of [attended, missed]) {
    await finalizeEventAttendance(String(e._id), String(organizer._id)).catch((err: Error) => console.warn(`  could not close ${e.slug}: ${err.message}`));
  }

  console.log(`
Demo data ready. Password for both accounts: ${PASSWORD}
  Student    ${STUDENT}
  Organizer  ${ORGANIZER}
Community: AI Builders Club (/communities/${SLUG}), 8 events.
Remove it with: npm run demo -- remove`);
  await mongoose.disconnect();
}

/** Deletes the demo accounts, their community, its events, and every record pointing at any of them. */
async function remove(db: import('mongodb').Db) {
  const users = await db.collection('users').find({ email: { $in: [STUDENT, ORGANIZER] } }).project({ _id: 1 }).toArray();
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
