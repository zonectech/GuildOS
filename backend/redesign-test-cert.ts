/**
 * Throwaway certificate seeder for visually testing the certificate redesign
 * (issuer logo x partner logos lockup, sponsors-before-signatures, empty-space
 * collapsing). Run multiple times with different env flags, prints the serial
 * + verify URL each time. Clean up with cleanup-cert.ts style removal (manual).
 *
 * Env flags:
 *   SEED_LOGO=1        include issuer logo
 *   SEED_PARTNERS=1     include 2 external partner logos
 *   SEED_SPONSORS=1     include 2 sponsors (1 with logo, 1 name-only)
 *   SEED_SIGS=1         include 2 signatories
 *   SEED_LABEL=text     just a note printed to console
 */
import './src/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { createToken } from './src/utils/token';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { EventSponsorModel } from './src/models/event-sponsor.model';
import { EventModel } from './src/models/event.model';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3001';

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}

async function makeUser(fullName: string) {
  const rnd = crypto.randomBytes(6).toString('hex');
  const user = await UserModel.create({
    fullName,
    email: `redesign-${rnd}@smoketest.local`,
    passwordHash: crypto.randomBytes(16).toString('hex'),
    passwordSalt: crypto.randomBytes(16).toString('hex'),
    role: 'STUDENT', status: 'ACTIVE', emailVerified: true,
    profile: { username: `redesign_${rnd}`, university: 'Smoke Test University' },
  } as any);
  return user._id.toString();
}

(async () => {
  await connectDatabase();
  const stamp = Date.now();
  const orgId = await makeUser('Redesign Test Organizer');
  const attId = await makeUser('Amina Yusuf');
  const orgToken = createToken({ sub: orgId, purpose: 'access', jti: `redesign-org-${stamp}` } as any, 3600_000);
  const attToken = createToken({ sub: attId, purpose: 'access', jti: `redesign-att-${stamp}` } as any, 3600_000);

  const community = await CommunityModel.create({
    name: `Redesign Test Guild ${stamp}`,
    slug: `redesign-test-guild-${stamp}`,
    normalizedName: `redesign test guild ${stamp}`,
    shortDescription: 'Throwaway community for certificate redesign UI test.',
    logo: '/uploads/demo-org-logo.svg', category: 'TECH', university: 'Smoke Test University',
    visibility: 'PUBLIC', verificationStatus: 'VERIFIED', verificationMethod: 'MANUAL',
    verifiedBy: orgId, verifiedAt: new Date(), founder: orgId, memberCount: 1, isPremium: true,
  });
  const communityId = community._id.toString();
  await MembershipModel.create({ userId: orgId, communityId, role: 'FOUNDER', status: 'ACTIVE', assignedBy: orgId });

  const past = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const future = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

  const partners = process.env.SEED_PARTNERS === '1'
    ? [
        { name: 'Alpha Co', logo: '/uploads/test-partner-alpha.svg', website: '' },
        { name: 'Beta Inc', logo: '/uploads/test-partner-beta.svg', website: '' },
      ]
    : [];

  const signatories = process.env.SEED_SIGS === '1'
    ? [
        { name: 'Dr. Amina Bello', title: 'Community President' },
        { name: 'John Okafor', title: 'Programme Lead' },
      ]
    : [];

  const create = await api('POST', '/api/events', orgToken, {
    communityId, title: `Certificate Redesign Test Event ${stamp}`, shortDescription: 'Certificate redesign UI test event',
    mode: 'PHYSICAL', venue: 'Test Hall', bannerImage: '/uploads/demo-org-logo.svg',
    startDate: future(2), endDate: future(3), registrationPolicy: 'OPEN', capacity: 0,
    certificateEnabled: true, certificateMode: 'STANDARD', certificateType: 'ATTENDANCE',
    minimumAttendanceDuration: 0, visibility: 'PUBLIC',
    partners,
    certificateTheme: { accent: '#b8933a', background: 'IVORY', font: 'SERIF' },
    certificateContent: {
      title: '', presentation: '', message: '',
      signatories,
      logo: process.env.SEED_LOGO === '1' ? '/uploads/demo-org-logo.svg' : '',
    },
    certificateStyle: 'CLASSIC',
  });
  const eventId = create.json?.event?._id;
  if (!eventId) {
    console.error('event create failed', create.status, create.json);
    process.exit(1);
  }
  const pub = await api('POST', `/api/events/${eventId}/publish`, orgToken);
  if (process.env.SEED_DEBUG === '1') console.log('publish', pub.status, JSON.stringify(pub.json));
  // Backdate after publish (a 'Past events cannot be published' guard blocks publishing
  // an already-past event, so create it in the future then move it back).
  await EventModel.updateOne({ _id: eventId }, { $set: { startDate: new Date(past(2)), endDate: new Date(past(1)) } });

  if (process.env.SEED_SPONSORS === '1') {
    await EventSponsorModel.create([
      { eventId, name: 'Paystack', logo: '/uploads/test-partner-alpha.svg', website: 'https://paystack.com', showOnCertificate: true },
      { eventId, name: 'MTN Nigeria', website: 'https://mtn.ng', showOnCertificate: true },
    ]);
  }

  const reg = await api('POST', `/api/events/${eventId}/register`, attToken);
  const registrationId = reg.json?.registration?._id;
  if (process.env.SEED_DEBUG === '1') console.log('reg', reg.status, JSON.stringify(reg.json));
  const st = await api('POST', `/api/events/${eventId}/status`, orgToken, { status: 'CHECK_IN' });
  if (process.env.SEED_DEBUG === '1') console.log('status', st.status, JSON.stringify(st.json));
  const ci = await api('POST', `/api/events/${eventId}/registrations/${registrationId}/check-in`, orgToken);
  if (process.env.SEED_DEBUG === '1') console.log('check-in', ci.status, JSON.stringify(ci.json));
  const co = await api('POST', `/api/events/${eventId}/registrations/${registrationId}/check-out`, orgToken);
  if (process.env.SEED_DEBUG === '1') console.log('check-out', co.status, JSON.stringify(co.json));
  const iss = await api('POST', `/api/events/${eventId}/issue-certificates`, orgToken);
  if (process.env.SEED_DEBUG === '1') console.log('issue', iss.status, JSON.stringify(iss.json));
  const mine = await api('GET', '/api/certificates/mine', attToken);
  if (process.env.SEED_DEBUG === '1') console.log('mine', mine.status, JSON.stringify(mine.json));
  const serial = mine.json?.certificates?.[0]?.serial;

  console.log('LABEL=' + (process.env.SEED_LABEL ?? ''));
  console.log('CERT_SERIAL=' + serial);
  console.log('VERIFY_URL=' + `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/certificates/${serial}`);
  await mongoose.connection.close();
  process.exit(0);
})().catch(async (e) => { console.error(e); try { await mongoose.connection.close(); } catch {} process.exit(1); });
