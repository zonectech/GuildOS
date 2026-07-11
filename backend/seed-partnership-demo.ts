/**
 * Demo seed — a browsable event showing partnerships live.
 *
 * Creates (idempotently, keyed by fixed slugs):
 *   - login-able demo user  livetest@guildos.local / LiveTest123!  (from seed-livetest.ts)
 *   - "Robotics Guild" (host, VERIFIED) — livetest is FOUNDER
 *   - "AI Society" (VERIFIED) — co-host with ACCEPTED partnership
 *   - "Design Circle" (VERIFIED, livetest FOUNDER) — PENDING invite so the
 *     accept/decline banner shows when logged in as livetest
 *   - published event "Robotics × AI Summit" with external partner TechCorp Nigeria
 *
 * Run:  npx tsx --env-file=.env seed-partnership-demo.ts
 * View: http://localhost:3000/events/<slug printed below>
 */
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { hashPassword } from './src/utils/password';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { EventModel } from './src/models/event.model';
import { EventPartnershipModel } from './src/models/event-partnership.model';

const BANNER = '/uploads/1783291004244-550137268.jpg';
const LOGO = '/uploads/demo-org-logo.svg';

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
      slug,
      shortDescription: `${name} — partnership demo community.`,
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

async function main() {
  await connectDatabase();
  const user = await upsertUser();

  const host = await upsertCommunity('Robotics Guild', 'robotics-guild-demo', user._id);
  const aiSociety = await upsertCommunity('AI Society', 'ai-society-demo', user._id);
  const designCircle = await upsertCommunity('Design Circle', 'design-circle-demo', user._id);

  const slug = 'robotics-x-ai-summit-demo';
  let event = await EventModel.findOne({ slug });
  if (!event) {
    const in3days = new Date(Date.now() + 3 * 24 * 3600_000);
    const end = new Date(in3days.getTime() + 4 * 3600_000);
    event = await EventModel.create({
      communityId: host._id,
      title: 'Robotics × AI Summit',
      slug,
      type: 'CONFERENCE',
      shortDescription: 'A joint summit exploring robotics and AI — co-hosted demo event.',
      description: 'Two communities, one stage. Talks, demos and workshops on robotics and applied AI.\n\nThis event demonstrates the new partnerships feature: a co-host community plus an external partner organization.',
      bannerImage: BANNER,
      mode: 'PHYSICAL',
      venue: 'Engineering Auditorium',
      address: 'Ahmadu Bello University, Zaria',
      startDate: in3days,
      endDate: end,
      registrationPolicy: 'OPEN',
      capacity: 0,
      certificateEnabled: true,
      certificateMode: 'STANDARD',
      certificateType: 'ATTENDANCE',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      createdBy: user._id,
      partners: [{ name: 'TechCorp Nigeria', logo: LOGO, website: 'https://example.com' }],
    } as never);
  }

  // AI Society: ACCEPTED co-host. Design Circle: PENDING invite (banner demo).
  await EventPartnershipModel.updateOne(
    { eventId: event._id, communityId: aiSociety._id },
    { $set: { status: 'ACCEPTED', invitedBy: user._id, respondedBy: user._id, respondedAt: new Date() } },
    { upsert: true },
  );
  await EventPartnershipModel.updateOne(
    { eventId: event._id, communityId: designCircle._id },
    { $setOnInsert: { status: 'PENDING', invitedBy: user._id, respondedBy: null, respondedAt: null } },
    { upsert: true },
  );

  console.log('Demo ready!');
  console.log('  Event page :', `http://localhost:3000/events/${slug}`);
  console.log('  Login      : livetest@guildos.local / LiveTest123!');
  console.log('  Co-host    : AI Society (ACCEPTED) — shows in "In partnership with"');
  console.log('  Invite     : Design Circle (PENDING) — accept/decline banner when logged in');
  await mongoose.disconnect();
}

void main();
