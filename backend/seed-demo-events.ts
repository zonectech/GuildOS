import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { EventModel } from './src/models/event.model';
import { EventSponsorModel } from './src/models/event-sponsor.model';
import { createToken } from './src/utils/token';

(async () => {
  await connectDatabase();
  const community = await mongoose.connection.collection('communities').findOne({ slug: 'abu-ce052f75' });
  if (!community) throw new Error('community not found');
  const founder = community.founder;

  await EventModel.deleteMany({ slug: /^demo-seed-/ });

  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const upcoming = await EventModel.create({
    communityId: community._id,
    createdBy: founder,
    title: 'AI & Careers Summit 2026',
    slug: 'demo-seed-ai-careers-summit-2026',
    type: 'CONFERENCE',
    shortDescription: 'A full-day summit on AI careers, portfolios and internships.',
    mode: 'HYBRID',
    venue: 'ABU Main Auditorium',
    startDate: new Date(now + 14 * day),
    endDate: new Date(now + 14 * day + 8 * 60 * 60 * 1000),
    capacity: 300,
    certificateEnabled: true,
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    sponsorshipOpen: true,
    sponsorshipPitch: 'Reach 300+ ambitious students.',
    sponsorshipPackages: [{ name: 'Gold', price: '150000', perks: ['LOGO_EVENT_PAGE', 'LOGO_CERTIFICATES'], benefits: '' }],
    registrationCount: 42,
  });

  const live = await EventModel.create({
    communityId: community._id,
    createdBy: founder,
    title: 'Tech Talk: Web3 Fundamentals',
    slug: 'demo-seed-tech-talk-web3',
    type: 'SEMINAR',
    shortDescription: 'An evening session demystifying blockchain and Web3.',
    mode: 'VIRTUAL',
    meetingLink: 'https://meet.example.com/web3',
    startDate: new Date(now - 1 * 60 * 60 * 1000),
    endDate: new Date(now + 2 * 60 * 60 * 1000),
    status: 'CHECK_IN',
    visibility: 'PUBLIC',
    registrationCount: 87,
  });

  const past = await EventModel.create({
    communityId: community._id,
    createdBy: founder,
    title: 'Hack the Campus Hackathon',
    slug: 'demo-seed-hack-the-campus',
    type: 'HACKATHON',
    shortDescription: '48 hours of building, shipping and pitching.',
    mode: 'PHYSICAL',
    venue: 'ICT Centre Lab 2',
    startDate: new Date(now - 30 * day),
    endDate: new Date(now - 28 * day),
    certificateEnabled: true,
    status: 'COMPLETED',
    visibility: 'PUBLIC',
    registrationCount: 120,
    checkedInCount: 96,
    completedCount: 88,
    certificatesIssued: 88,
  });

  await EventSponsorModel.create([
    { eventId: upcoming._id, name: 'Paystack', website: 'https://paystack.com' },
    { eventId: upcoming._id, name: 'MTN Nigeria', website: 'https://mtn.ng' },
    { eventId: past._id, name: 'Google Developer Groups', website: 'https://gdg.community.dev' },
  ]);

  const token = createToken({ sub: founder.toString(), purpose: 'access' } as any, 24 * 60 * 60 * 1000);
  console.log('SEEDED_OK');
  console.log('TOKEN=' + token);
  process.exit(0);
})();
