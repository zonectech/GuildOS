/**
 * Demo seed — a browsable MULTI-DAY event (day-by-day agenda + per-day attendance).
 *
 * Idempotent (keyed by fixed slug tech-week-summit-demo). Reuses the demo user
 * and Robotics Guild community from seed-partnership-demo.ts / seed-livetest.ts:
 *   login: livetest@guildos.local / LiveTest123!
 *
 * Run:  npx tsx --env-file=.env seed-multiday-demo.ts
 * View: http://localhost:3000/events/tech-week-summit-demo
 */
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { hashPassword } from './src/utils/password';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { EventModel } from './src/models/event.model';
import { EventSpeakerModel } from './src/models/event-speaker.model';
import { EventSponsorModel } from './src/models/event-sponsor.model';

const BANNER = '/uploads/1783291004244-550137268.jpg';
const LOGO = '/uploads/demo-org-logo.svg';
const SLUG = 'tech-week-summit-demo';

async function upsertUser() {
  const email = 'livetest@guildos.local';
  const { salt, hash } = hashPassword('LiveTest123!');
  let user = await UserModel.findOne({ email });
  if (user) {
    user.set({ passwordHash: hash, passwordSalt: salt, emailVerified: true, status: 'ACTIVE' });
    await user.save();
  } else {
    user = await UserModel.create({
      fullName: 'Live Tester',
      email,
      passwordHash: hash,
      passwordSalt: salt,
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerified: true,
      profile: { username: 'live_tester', university: 'Ahmadu Bello University' },
    } as never);
  }
  return user;
}

async function upsertCommunity(name: string, slug: string, founderId: mongoose.Types.ObjectId) {
  let community = await CommunityModel.findOne({ slug });
  if (!community) {
    community = await CommunityModel.create({
      name,
      normalizedName: name.trim().toLowerCase(),
      slug,
      shortDescription: `${name} — multi-day demo community.`,
      logo: LOGO,
      coverImage: BANNER,
      category: 'TECH',
      university: 'Ahmadu Bello University',
      visibility: 'PUBLIC',
      verificationStatus: 'VERIFIED',
      verificationMethod: 'MANUAL',
      verifiedBy: founderId,
      verifiedAt: new Date(),
      founder: founderId,
      memberCount: 1,
    });
    await MembershipModel.create({ userId: founderId, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: founderId });
  }
  return community;
}

function at(dayOffset: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  await connectDatabase();
  const user = await upsertUser();
  const host = await upsertCommunity('Robotics Guild', 'robotics-guild-demo', user._id);

  const fields = {
    communityId: host._id,
    createdBy: user._id,
    title: 'ABU Tech Week Summit',
    type: 'CONFERENCE',
    shortDescription: 'Three days of AI, robotics, and career acceleration — one grand theme, a different focus every day.',
    description:
      'ABU Tech Week brings students, builders, and industry together for three packed days.\n\nEach day has its own sub-theme and venue — check in every day with the same QR pass. Attend at least 2 of the 3 days to earn your verified certificate.',
    theme: 'Building Africa’s Next Tech Generation',
    features: ['Verified certificate (attend 2 of 3 days)', 'Hands-on labs', 'Industry keynotes', 'Career fair access'],
    days: [
      {
        date: at(0, 9),
        theme: 'Day 1: Foundations & AI',
        venue: 'Engineering Auditorium',
        startTime: '09:00',
        endTime: '16:30',
        features: ['Opening keynote: State of African AI', 'Intro to ML lab', 'Speed networking'],
        facilitators: [
          { name: 'Dr. Amina Bello', title: 'Lead Facilitator' },
          { name: 'Kunle Adepoju', title: 'MC' },
        ],
        // Shared spine + parallel track sessions — attendees see shared + their own track.
        sessions: [
          { time: '09:00', title: 'Opening keynote: State of African AI', venue: 'Engineering Auditorium', facilitator: 'Prof. Ngozi Eze', sectionKey: '' },
          { time: '11:00', title: 'Python & pandas bootcamp', venue: 'Lab 1', facilitator: 'Dr. Amina Bello', sectionKey: 'data-science' },
          { time: '11:00', title: 'HTML/CSS crash build', venue: 'Innovation Hub', facilitator: 'John Okafor', sectionKey: 'coding' },
          { time: '15:00', title: 'Speed networking (all tracks)', venue: 'Main Foyer', facilitator: '', sectionKey: '' },
        ],
      },
      {
        date: at(1, 9),
        theme: 'Day 2: Robotics & Hardware',
        venue: 'Innovation Hub Workshop Floor',
        startTime: '10:00',
        endTime: '17:00',
        features: ['Robot assembly challenge', 'Drones in agriculture demo', 'Hardware startup panel'],
        facilitators: [
          { name: 'Engr. Chidi Okafor', title: 'Workshop Lead' },
          { name: 'Fatima Sule', title: 'Lab Coordinator' },
        ],
      },
      {
        date: at(2, 9),
        theme: 'Day 3: Careers & Demo Day',
        venue: 'Main Campus Hall',
        startTime: '09:30',
        endTime: '15:00',
        features: ['Student project showcase', 'CV & portfolio clinic', 'Recruiter meet-and-greet', 'Closing awards'],
        facilitators: [{ name: 'Zainab Musa', title: 'Programme Director' }],
      },
    ],
    minimumAttendanceDays: 2,
    // Parallel tracks: attendees pick ONE at registration and follow it all 3 days.
    sections: [
      { key: 'data-science', name: 'Data Science', description: 'Python, pandas and machine learning fundamentals — no prior experience needed.', capacity: 40, venue: 'Lab 1 · Engineering Block' },
      { key: 'coding', name: 'Coding', description: 'Web development from zero to a deployed app — HTML/CSS/JS and a modern framework.', capacity: 0, venue: 'Innovation Hub · Floor 2' },
    ],
    contacts: [{ name: 'Amina Bello', phone: '0803 123 4567', email: 'techweek@abu.edu.ng' }],
    // External partner orgs — shown in "In partnership with" and on certificates.
    partners: [
      { name: 'TechCorp Nigeria', logo: LOGO, website: 'https://techcorp.example.com' },
      { name: 'DataLab Africa', logo: LOGO, website: 'https://datalab.example.com' },
    ],
    bannerImage: BANNER,
    mode: 'PHYSICAL',
    venue: 'ABU Main Campus (see daily agenda)',
    address: 'Ahmadu Bello University, Zaria',
    startDate: at(0, 9),
    endDate: at(2, 17),
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
  let eventId: mongoose.Types.ObjectId;
  if (existing) {
    existing.set(fields as never);
    await existing.save();
    eventId = existing._id;
    console.log('Updated existing demo event.');
  } else {
    const created = await EventModel.create({ slug: SLUG, ...fields } as never);
    eventId = created._id;
    console.log('Created demo event.');
  }

  // Speaker lineup — per-section trainers, day-specific and whole-event speakers.
  await EventSpeakerModel.deleteMany({ eventId });
  await EventSpeakerModel.insertMany([
    { eventId, speakerType: 'TRAINER', day: null, sectionKey: 'data-science', fullName: 'Dr. Amina Bello', title: 'Lead Data Trainer', organization: 'DataLab Africa', bio: 'Amina has spent a decade turning messy datasets into decisions — first at a national bank, now leading applied ML research at DataLab Africa. She has trained 800+ students in Python, pandas and practical machine learning, and her track takes you from zero to your first trained model in three days. Expect hands-on labs, real Nigerian datasets, and no fluff.' },
    { eventId, speakerType: 'TRAINER', day: null, sectionKey: 'coding', fullName: 'John Okafor', title: 'Fullstack Coach', organization: 'BuildSpace NG', bio: 'John builds and ships web products for startups across Lagos and Abuja, and has coached three cohorts of first-time developers to deployed portfolio apps. His track covers HTML/CSS/JS foundations on day one, a modern framework on day two, and ends with your own app live on the internet on day three. Bring a laptop — everything else is provided.' },
    { eventId, speakerType: 'GUEST', day: 1, fullName: 'Prof. Ngozi Eze', title: 'Director of AI Research', organization: 'DataLab Africa' },
    { eventId, speakerType: 'WORKSHOP', day: 2, fullName: 'Tunde Bakare', title: 'Robotics Engineer', organization: 'TechCorp Nigeria' },
    { eventId, speakerType: 'PANEL', day: 2, fullName: 'Hauwa Ibrahim', title: 'Hardware Founder', organization: 'AgriDrone NG' },
    { eventId, speakerType: 'GUEST', day: 3, fullName: 'Emeka Nwosu', title: 'Head of Talent', organization: 'PayLink' },
    { eventId, speakerType: 'GUEST', day: null, fullName: 'Sarah Danjuma', title: 'Community Growth Lead', organization: 'GuildOS' },
  ]);
  console.log('Seeded 7 speakers (2 section trainers + 4 day-specific + 1 all-days).');

  // A confirmed sponsor — shows in the "Sponsors" card (and certificates when flagged).
  await EventSponsorModel.deleteMany({ eventId });
  await EventSponsorModel.create({ eventId, name: 'PayLink', logo: LOGO, website: 'https://paylink.example.com', showOnCertificate: true });
  console.log('Seeded 1 sponsor + 2 partners.');

  console.log(`\nView as a student: http://localhost:3000/events/${SLUG}`);
  console.log('Login (to register / see the QR pass): livetest@guildos.local / LiveTest123!');
  await mongoose.disconnect();
}

void main();
