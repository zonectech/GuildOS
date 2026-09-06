// One-off: seed a PUBLISHED demo event (clone of Career Night's doc) with sponsorship open,
// so the full sponsor flow (inquiry → convert → announcement ad post) can run through the real UI.
import mongoose from 'mongoose';
import { EventModel } from './src/models/event.model';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const src = await EventModel.findOne({ slug: 'ai-robotics-career-night-2026-d0afdaae' }).lean();
  if (!src) throw new Error('source event missing');
  const existing = await EventModel.findOne({ slug: 'robotics-demo-day-2026' }).lean();
  if (existing) {
    console.log('already exists:', existing.slug, existing.status);
    await mongoose.disconnect();
    return;
  }
  const { _id, createdAt, updatedAt, ...rest } = src as Record<string, unknown> & { _id: unknown; createdAt?: unknown; updatedAt?: unknown };
  const start = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
  const doc = await EventModel.create({
    ...rest,
    title: 'Robotics Demo Day 2026',
    slug: 'robotics-demo-day-2026',
    normalizedTitle: 'robotics demo day 2026',
    eventStartDay: start.toISOString().slice(0, 10),
    status: 'PUBLISHED',
    cancellationReason: '',
    startDate: start,
    endDate: new Date(start.getTime() + 5 * 60 * 60 * 1000),
    registrationCount: 0,
    checkedInCount: 0,
    certificatesIssued: 0,
    viewCount: 0,
    sponsorshipOpen: true,
    sponsorshipPitch: 'Put your brand in front of 150+ robotics and AI students at ABU. Packages include logo placement, social announcements, and verified attendance reports.',
  });
  console.log('created:', doc.slug, doc.status, 'packages:', doc.sponsorshipPackages.map((p) => `${p.name}(${p.perks.join(',')})`).join(' | '));
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
