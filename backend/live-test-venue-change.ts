/**
 * Live test — venue change alerts registered attendees (bell + email path).
 *
 * Flow against the LIVE backend API (http://localhost:3001):
 *   organizer creates + publishes event → attendee registers → organizer
 *   changes the venue → attendee gets an in-app SYSTEM notification
 *   ("Venue updated: …" linking to the event page). Also verifies no
 *   duplicate alert when an unrelated field changes.
 *
 * Throwaway users/community are seeded directly in the DB and removed after.
 * Run:  npx tsx --env-file=.env live-test-venue-change.ts
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
import { EventRegistrationModel } from './src/models/event-registration.model';
import { NotificationModel } from './src/models/notification.model';

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

async function api(method: string, path: string, token?: string, body?: unknown) {
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function makeUser(fullName: string): Promise<string> {
  const rnd = crypto.randomBytes(6).toString('hex');
  const user = await UserModel.create({
    fullName,
    email: `vtest-${rnd}@vtest.local`,
    passwordHash: crypto.randomBytes(16).toString('hex'),
    passwordSalt: crypto.randomBytes(16).toString('hex'),
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
    profile: { username: `vtest_${rnd}`, university: 'Venue Test University' },
  } as any);
  return user._id.toString();
}

async function main() {
  console.log(`\n=== GuildOS venue-change live test :: ${BASE} ===\n`);
  await connectDatabase();

  const health = await api('GET', '/api/communities');
  if (health.status !== 200) {
    console.error(`Backend not reachable at ${BASE}. Is the dev server running?`);
    process.exit(1);
  }

  const stamp = Date.now();
  const organizerId = await makeUser('Venue Organizer');
  const attendeeId = await makeUser('Venue Attendee');
  const tok = (id: string, tag: string) => createToken({ sub: id, purpose: 'access', jti: `vtest-${tag}-${stamp}` } as any, 3600_000);
  const orgToken = tok(organizerId, 'org');
  const attToken = tok(attendeeId, 'att');

  const community = await CommunityModel.create({
    name: `Venue Guild ${stamp}`,
    normalizedName: `venue guild ${stamp}`,
    slug: `venue-guild-${stamp}`,
    shortDescription: 'Throwaway community for venue-change live test.',
    logo: '/uploads/smoke-logo.png',
    coverImage: '/uploads/smoke-cover.png',
    category: 'TECH',
    university: 'Venue Test University',
    visibility: 'PUBLIC',
    verificationStatus: 'VERIFIED',
    verificationMethod: 'MANUAL',
    verifiedBy: organizerId,
    verifiedAt: new Date(),
    founder: organizerId,
    memberCount: 1,
  });
  await MembershipModel.create({ userId: organizerId, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: organizerId });

  const userIds = [organizerId, attendeeId].map((id) => new mongoose.Types.ObjectId(id));
  let eventId = '';

  try {
    console.log('SETUP');
    const future = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
    const create = await api('POST', '/api/events', orgToken, {
      communityId: community._id.toString(),
      title: `Venue Change Summit ${stamp}`,
      shortDescription: 'Venue-change live test event',
      mode: 'PHYSICAL',
      venue: 'Old Hall A',
      bannerImage: '/uploads/smoke-banner.png',
      startDate: future(48),
      endDate: future(52),
      registrationPolicy: 'OPEN',
      capacity: 0,
      visibility: 'PUBLIC',
    });
    check('organizer creates event', create.status === 201, create.json);
    eventId = create.json?.event?._id ?? '';
    const slug = create.json?.event?.slug ?? '';

    const publish = await api('POST', `/api/events/${eventId}/publish`, orgToken);
    check('event published', publish.status === 200 && publish.json?.event?.status === 'PUBLISHED', publish.json);

    const register = await api('POST', `/api/events/${eventId}/register`, attToken);
    check('attendee registers (CONFIRMED)', register.status === 201 && register.json?.registration?.status === 'CONFIRMED', register.json);

    // ── VENUE CHANGE ─────────────────────────────────────────────
    console.log('\nVENUE CHANGE');
    const patch = await api('PATCH', `/api/events/${eventId}`, orgToken, { venue: 'New Great Hall B' });
    check('organizer changes venue', patch.status === 200 && patch.json?.event?.venue === 'New Great Hall B', patch.json);
    check('other fields survive partial patch', patch.json?.event?.title === `Venue Change Summit ${stamp}`, patch.json?.event?.title);

    await sleep(2000); // notification fan-out is fire-and-forget

    const bellDocs = await NotificationModel.find({ userId: attendeeId, title: /^Venue updated:/ }).lean();
    check('attendee got venue-change bell notification', bellDocs.length === 1, bellDocs.length);
    check('bell links to the event page', bellDocs[0]?.link === `/events/${slug}`, bellDocs[0]?.link);
    check('bell body mentions new venue', String(bellDocs[0]?.body ?? '').includes('New Great Hall B'), bellDocs[0]?.body);

    const bellApi = await api('GET', '/api/notifications', attToken);
    const fromApi = (bellApi.json?.notifications ?? []).filter((n: any) => String(n.title ?? '').startsWith('Venue updated:'));
    check('bell visible via GET /api/notifications', bellApi.status === 200 && fromApi.length === 1, bellApi.status);

    const organizerBells = await NotificationModel.find({ userId: organizerId, title: /^Venue updated:/ }).lean();
    check('organizer (not registered) gets no alert', organizerBells.length === 0, organizerBells.length);

    // ── NO FALSE ALERTS ──────────────────────────────────────────
    console.log('\nNO FALSE ALERTS');
    const patch2 = await api('PATCH', `/api/events/${eventId}`, orgToken, { shortDescription: 'Updated blurb — venue untouched' });
    check('unrelated edit succeeds', patch2.status === 200, patch2.json);
    await sleep(1500);
    const bellsAfter = await NotificationModel.find({ userId: attendeeId, title: /^Venue updated:/ }).lean();
    check('no duplicate alert for unrelated edit', bellsAfter.length === 1, bellsAfter.length);
  } finally {
    console.log('\nCLEANUP');
    if (eventId) {
      await EventRegistrationModel.deleteMany({ eventId });
      await EventModel.deleteOne({ _id: eventId });
    }
    await NotificationModel.deleteMany({ userId: { $in: userIds } });
    await MembershipModel.deleteMany({ communityId: community._id });
    await CommunityModel.deleteOne({ _id: community._id });
    await UserModel.deleteMany({ _id: { $in: userIds } });
    console.log('  throwaway data removed');
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failures.length) {
    console.log('Failures:', failures.join(' | '));
    process.exitCode = 1;
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
