/**
 * Demo seed — "Da'wah Week" (MSSN FUT Minna flyer) as a GuildOS multi-day event.
 *
 * 9 days, grand theme + per-day themes, per-day venues/times/facilitators, and
 * multi-session days (the flyer's procession / cup final / mock exam items).
 * Dates are relative: Day 1 = next week, so the countdown ticks.
 *
 * Idempotent (slug dawah-week-demo). Reuses the livetest demo user/community.
 * Run:  npx tsx --env-file=.env seed-dawah-week-demo.ts
 */
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { EventModel } from './src/models/event.model';

const SLUG = 'dawah-week-demo';
const BANNER = '/uploads/1783291004244-550137268.jpg';
const LOGO = '/uploads/demo-org-logo.svg';

function at(dayOffset: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 7 + dayOffset); // Day 1 = one week from today
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  await connectDatabase();
  const user = await UserModel.findOne({ email: 'livetest@guildos.local' });
  if (!user) throw new Error('Run seed-multiday-demo.ts first (creates the livetest user)');

  let community = await CommunityModel.findOne({ slug: 'mssn-futminna-demo' });
  if (!community) {
    community = await CommunityModel.create({
      name: 'MSSN FUT Minna',
      slug: 'mssn-futminna-demo',
      shortDescription: 'Muslim Students’ Society of Nigeria — FUT Minna chapter (demo).',
      logo: LOGO,
      coverImage: BANNER,
      category: 'RELIGIOUS',
      university: 'Federal University of Technology, Minna',
      visibility: 'PUBLIC',
      verificationStatus: 'VERIFIED',
      verificationMethod: 'MANUAL',
      verifiedBy: user._id,
      verifiedAt: new Date(),
      founder: user._id,
      memberCount: 1,
    });
    await MembershipModel.create({ userId: user._id, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: user._id });
  }

  const fields = {
    communityId: community._id,
    createdBy: user._id,
    title: 'Da’wah Week (14/47th)',
    type: 'CONFERENCE',
    shortDescription: 'Nine days of lectures, recitations, and community programmes — themed The Praxis Paradox: Fusing The Divergence.',
    description:
      'The annual Da’wah Week of MSSN FUT Minna: nine days of programmes across campus — from Words from the Minbar to the Reportorial Conference and Award Giving ceremony.\n\nCheck in each day with the same QR pass. Attend at least 5 of the 9 days to earn your verified certificate of participation.',
    theme: 'The Praxis Paradox: Fusing The Divergence',
    features: ['Verified certificate (attend 5 of 9 days)', 'Daily lectures & recitations', 'Amir’s Cup Final', 'Award giving ceremony'],
    days: [
      {
        date: at(0, 13),
        theme: 'Words from the Minbar',
        venue: 'Ummah Masjid (GK & Bosso Campus)',
        startTime: '13:00',
        endTime: '',
        features: [],
        facilitators: [],
        sessions: [
          { time: '13:00', title: 'Words from the Minbar', venue: 'Ummah Masjid (GK & Bosso Campus)', facilitator: '' },
          { time: '', title: 'Da’wah Procession (Brothers only) — after Jum’ah', venue: 'Starting Point: Ummah Masjid, GK Campus', facilitator: '' },
        ],
      },
      {
        date: at(1, 9),
        theme: 'Niger Recites Day 1 (Sisters) — The Qur’anic Paragon: Transcending the Age of Deception',
        venue: 'SICT New LT',
        startTime: '09:00',
        endTime: '',
        features: [],
        facilitators: [{ name: 'Mallama Khadijah Sakiwa', title: 'Facilitator' }],
        sessions: [
          { time: '09:00', title: 'Niger Recites Day 1 (Sisters)', venue: 'SICT New LT', facilitator: 'Mallama Khadijah Sakiwa' },
          { time: '16:30', title: 'Amir’s Cup Final', venue: 'GK School Field', facilitator: '' },
        ],
      },
      {
        date: at(2, 9),
        theme: 'Niger Recites Day 2 — The Qur’anic Paragon: Transcending the Age of Deception',
        venue: 'School Auditorium',
        startTime: '09:00',
        endTime: '',
        features: [],
        facilitators: [{ name: 'Imam Dr. Ahmad Bashir Yankuzo', title: 'Facilitator' }],
        sessions: [],
      },
      {
        date: at(3, 16, 30),
        theme: 'Health Program — The Smart Student’s Feeding Guide',
        venue: 'Environmental LT',
        startTime: '16:30',
        endTime: '',
        features: [],
        facilitators: [{ name: 'Dr. Ibrahim Bello', title: 'Facilitator' }],
        sessions: [],
      },
      {
        date: at(4, 16, 30),
        theme: 'Seerah Evening — Chronicles of Al-Aqsa: Echoes of Resilience',
        venue: 'PTDF Hall, Engineering Complex',
        startTime: '16:30',
        endTime: '',
        features: [],
        facilitators: [{ name: 'Mal. Muhammad Nasir Sheu', title: 'Facilitator' }],
        sessions: [],
      },
      {
        date: at(5, 14),
        theme: 'Theme Lecture / Magazine Launching — The Praxis Paradox: Fusing the Divergence',
        venue: 'Convo Square',
        startTime: '14:00',
        endTime: '',
        features: [],
        facilitators: [{ name: 'Shaykh Muhammad Bima Enagi', title: 'Facilitator' }],
        sessions: [],
      },
      {
        date: at(6, 16, 30),
        theme: 'Nikaah Program — The Half That Completes: From Intent to I Do',
        venue: 'School Auditorium',
        startTime: '16:30',
        endTime: '',
        features: [],
        facilitators: [{ name: 'Imam Dr. Dhikrullah Zubayr', title: 'Facilitator' }],
        sessions: [],
      },
      {
        date: at(7, 10),
        theme: 'Sisters’ Colloquium',
        venue: 'Ummah Masjid GK',
        startTime: '10:00',
        endTime: '',
        features: [],
        facilitators: [],
        sessions: [
          { time: '10:00', title: 'Mock Exam for 100-Level', venue: 'SICT New LT', facilitator: '' },
          { time: '14:30', title: 'Sisters’ Colloquium', venue: 'Ummah Masjid GK', facilitator: '' },
        ],
      },
      {
        date: at(8, 9),
        theme: 'Reportorial Conference / Award Giving & Handing Over Ceremony',
        venue: 'SICT New LT, GK Campus',
        startTime: '09:00',
        endTime: '',
        features: [],
        facilitators: [{ name: 'Mr. Ibrahim Ja’far ‘Aqib', title: 'Facilitator' }],
        sessions: [],
      },
    ],
    minimumAttendanceDays: 5,
    contacts: [
      { name: 'Ameer', phone: '0813 332 4104', email: '' },
      { name: 'Chief Organizer', phone: '0905 660 9264', email: '' },
    ],
    bannerImage: BANNER,
    mode: 'PHYSICAL',
    venue: 'FUT Minna (see daily agenda)',
    address: 'Federal University of Technology, Minna',
    timezone: 'Africa/Lagos',
    startDate: at(0, 13),
    endDate: at(8, 17),
    registrationPolicy: 'OPEN',
    capacity: 0,
    waitlistEnabled: false,
    allowWalkIns: true,
    qrEnabled: true,
    certificateEnabled: true,
    certificateMode: 'STANDARD',
    certificateType: 'ATTENDANCE',
    minimumAttendanceDuration: 0,
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
  };

  const existing = await EventModel.findOne({ slug: SLUG });
  if (existing) {
    existing.set(fields as never);
    await existing.save();
    console.log('Updated Da’wah Week demo event.');
  } else {
    await EventModel.create({ slug: SLUG, ...fields } as never);
    console.log('Created Da’wah Week demo event.');
  }
  console.log(`View: http://localhost:3000/events/${SLUG}`);
  await mongoose.disconnect();
}

void main();
