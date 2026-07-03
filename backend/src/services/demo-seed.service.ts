import { UserModel } from '../models/user.model';
import { CommunityModel } from '../models/community.model';
import { MembershipModel } from '../models/membership.model';
import { EventModel } from '../models/event.model';
import { RecruiterProfileModel } from '../models/recruiter-profile.model';
import { authStore } from '../store/auth-store';
import { createCommunity } from './community.service';
import { createEvent } from './event.service';
import { registerRecruiter } from './recruiter.service';
import { createOpportunity } from './opportunity.service';
import { createPost } from './feed.service';

const MARKER_EMAIL = 'demo.ada@guildos.local';
const DEMO_PASSWORD = 'DemoPass!123';
const PLACEHOLDER_LOGO = 'https://placehold.co/128x128?text=G';

type SeedSummary = {
  alreadySeeded: boolean;
  students: number;
  communities: number;
  memberships: number;
  events: number;
  recruiters: number;
  opportunities: number;
  posts: number;
};

async function makeStudent(fullName: string, username: string, email: string, extra: { university: string; faculty: string; department: string; level: string; interests: string[]; bio: string }) {
  const user = await authStore.createUser({
    fullName,
    email,
    password: DEMO_PASSWORD,
    role: 'STUDENT',
    profile: {
      username,
      university: extra.university,
      faculty: extra.faculty,
      department: extra.department,
      level: extra.level,
      interests: extra.interests,
      bio: extra.bio,
      profileVisibility: 'PUBLIC',
      avatar: '',
    },
  });
  user.emailVerified = true;
  user.onboardingCompleted = true;
  await user.save();
  return user;
}

function futureDate(daysAhead: number, hour = 15) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/**
 * Idempotent demo dataset so early users can see the network effect: students,
 * communities, cross-memberships, events, a verified recruiter, opportunities, and posts.
 * Guarded by a marker account — running twice is a no-op.
 */
export async function seedDemoData(): Promise<SeedSummary> {
  const summary: SeedSummary = { alreadySeeded: false, students: 0, communities: 0, memberships: 0, events: 0, recruiters: 0, opportunities: 0, posts: 0 };

  const existing = await UserModel.findOne({ email: MARKER_EMAIL });
  if (existing) {
    summary.alreadySeeded = true;
    return summary;
  }

  // 1) Students
  const ada = await makeStudent('Ada Obi', 'ada', MARKER_EMAIL, { university: 'FUTMINNA', faculty: 'Engineering', department: 'Computer Engineering', level: '400', interests: ['AI', 'Robotics'], bio: 'Builder. Robotics club lead.' });
  const tunde = await makeStudent('Tunde Bello', 'tunde', 'demo.tunde@guildos.local', { university: 'FUTMINNA', faculty: 'Science', department: 'Computer Science', level: '300', interests: ['Web', 'Open Source'], bio: 'Full-stack learner.' });
  const zara = await makeStudent('Zara Musa', 'zara', 'demo.zara@guildos.local', { university: 'FUTMINNA', faculty: 'Agriculture', department: 'Agricultural Economics', level: '200', interests: ['AgriTech', 'Data'], bio: 'AgriTech enthusiast.' });
  const kemi = await makeStudent('Kemi Alao', 'kemi', 'demo.kemi@guildos.local', { university: 'FUTMINNA', faculty: 'Science', department: 'Mathematics', level: '400', interests: ['Data Science', 'Speaking'], bio: 'Data + community.' });
  summary.students = 4;

  // 2) Communities
  const aiClub = await createCommunity({
    name: 'AI Innovators Club',
    shortDescription: 'Building and shipping AI projects on campus.',
    description: 'A student community exploring machine learning, robotics, and applied AI through workshops and hackathons.',
    logo: PLACEHOLDER_LOGO,
    category: 'Technology',
    university: 'FUTMINNA',
    faculty: 'Engineering',
    department: 'Computer Engineering',
    visibility: 'PUBLIC',
    verificationMethod: 'MANUAL',
    creatorId: ada.id,
  });
  const agriSociety = await createCommunity({
    name: 'AgriConnect Society',
    shortDescription: 'Connecting students to modern agriculture and AgriTech.',
    description: 'Workshops, field trips, and speaker sessions on the future of farming and agricultural technology.',
    logo: PLACEHOLDER_LOGO,
    category: 'Agriculture',
    university: 'FUTMINNA',
    faculty: 'Agriculture',
    department: 'Agricultural Economics',
    visibility: 'PUBLIC',
    verificationMethod: 'MANUAL',
    creatorId: zara.id,
  });
  await CommunityModel.updateMany({ _id: { $in: [aiClub._id, agriSociety._id] } }, { $set: { verificationStatus: 'VERIFIED' } });
  summary.communities = 2;

  // 3) Cross-memberships
  const memberships: Array<{ community: typeof aiClub; user: typeof tunde; by: string }> = [
    { community: aiClub, user: tunde, by: ada.id },
    { community: aiClub, user: kemi, by: ada.id },
    { community: agriSociety, user: ada, by: zara.id },
    { community: agriSociety, user: tunde, by: zara.id },
  ];
  for (const m of memberships) {
    const exists = await MembershipModel.findOne({ communityId: m.community._id, userId: m.user.id });
    if (exists) continue;
    await MembershipModel.create({ communityId: m.community._id, userId: m.user.id, role: 'MEMBER', assignedBy: m.by });
    await CommunityModel.updateOne({ _id: m.community._id }, { $inc: { memberCount: 1 } });
    summary.memberships += 1;
  }

  // 4) Events (published, upcoming)
  const events = [
    { communityId: aiClub._id.toString(), by: ada.id, title: 'Intro to Machine Learning Workshop', venue: 'Engineering Auditorium', days: 7 },
    { communityId: aiClub._id.toString(), by: ada.id, title: 'Campus AI Hackathon', venue: 'Innovation Hub', days: 21 },
    { communityId: agriSociety._id.toString(), by: zara.id, title: 'AgriTech Field Day', venue: 'Campus Farm', days: 14 },
  ];
  for (const e of events) {
    try {
      const event = await createEvent(e.communityId, e.by, {
        title: e.title,
        type: 'WORKSHOP',
        mode: 'PHYSICAL',
        venue: e.venue,
        shortDescription: `${e.title} — open to all members.`,
        startDate: futureDate(e.days),
        endDate: futureDate(e.days, 18),
        registrationPolicy: 'OPEN',
        capacity: 100,
      } as Parameters<typeof createEvent>[2]);
      await EventModel.updateOne({ _id: event._id }, { $set: { status: 'PUBLISHED' } });
      summary.events += 1;
    } catch {
      /* skip event on failure */
    }
  }

  // 5) Recruiter (verified)
  const recruiterUser = await makeStudent('Grace Eze', 'grace-recruiter', 'demo.recruiter@guildos.local', { university: 'FUTMINNA', faculty: 'Business', department: 'HR', level: 'Staff', interests: ['Hiring'], bio: 'Talent lead at TechFarm.' });
  try {
    await registerRecruiter(recruiterUser.id, { company: 'TechFarm Labs', position: 'Talent Lead', website: 'https://techfarm.example', about: 'We hire student builders for internships and graduate roles.' });
    await RecruiterProfileModel.updateOne({ userId: recruiterUser.id }, { $set: { verified: true, verificationStatus: 'VERIFIED' } });
    summary.recruiters = 1;

    // 6) Opportunities (auto-verified)
    const opps = [
      { title: 'Software Engineering Intern', category: 'INTERNSHIP', location: 'Remote', description: 'Build features across our web stack. Great for CS/CE students.', tags: ['React', 'Node', 'TypeScript'] },
      { title: 'AgriData Analyst (Graduate)', category: 'CAMPUS_ROLE', location: 'Minna', description: 'Analyze farm data to improve yields. AgriEcon and Data students encouraged.', tags: ['Data', 'AgriTech'] },
    ];
    for (const o of opps) {
      try {
        await createOpportunity(recruiterUser.id, {
          title: o.title,
          category: o.category as never,
          organization: 'TechFarm Labs',
          location: o.location,
          description: o.description,
          tags: o.tags as never,
          applicationUrl: 'https://techfarm.example/apply',
        }, { autoVerify: true });
        summary.opportunities += 1;
      } catch {
        /* skip */
      }
    }
  } catch {
    /* recruiter seed optional */
  }

  // 7) Posts
  const posts = [
    { userId: ada.id, content: 'Just kicked off the AI Innovators Club! Join us for our first ML workshop next week 🤖' },
    { userId: tunde.id, content: 'Learning so much in the open-source study group. Shipped my first PR today 🚀' },
    { userId: zara.id, content: 'AgriConnect field day is coming — see modern farming tech up close 🌾' },
  ];
  for (const p of posts) {
    try {
      await createPost(p.userId, { content: p.content });
      summary.posts += 1;
    } catch {
      /* skip */
    }
  }

  return summary;
}
