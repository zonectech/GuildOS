/**
 * Seed ONE real certificate on throwaway data so it can be viewed live in the UI,
 * then removed with cleanup-cert.ts. Prints the certificate serial + verify URL.
 * Run: npx tsx --env-file=.env seed-cert.ts
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
    email: `certseed-${rnd}@smoketest.local`,
    passwordHash: crypto.randomBytes(16).toString('hex'),
    passwordSalt: crypto.randomBytes(16).toString('hex'),
    role: 'STUDENT', status: 'ACTIVE', emailVerified: true,
    profile: { username: `certseed_${rnd}`, university: 'Smoke Test University' },
  } as any);
  return user._id.toString();
}

(async () => {
  await connectDatabase();
  const stamp = Date.now();
  const orgId = await makeUser('Cert Seed Organizer');
  const attId = await makeUser(process.env.SEED_NAME ?? 'Ada Lovelace');
  const orgToken = createToken({ sub: orgId, purpose: 'access', jti: `cert-org-${stamp}` } as any, 3600_000);
  const attToken = createToken({ sub: attId, purpose: 'access', jti: `cert-att-${stamp}` } as any, 3600_000);

  const community = await CommunityModel.create({
    name: `Cert Seed Guild ${stamp}`,
    slug: `cert-seed-guild-${stamp}`,
    shortDescription: 'Throwaway community for certificate UI test.',
    logo: '/uploads/smoke-logo.png', category: 'TECH', university: 'Smoke Test University',
    visibility: 'PUBLIC', verificationStatus: 'VERIFIED', verificationMethod: 'MANUAL',
    verifiedBy: orgId, verifiedAt: new Date(), founder: orgId, memberCount: 1, isPremium: true,
  });
  const communityId = community._id.toString();
  await MembershipModel.create({ userId: orgId, communityId, role: 'FOUNDER', status: 'ACTIVE', assignedBy: orgId });

  const past = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const create = await api('POST', '/api/events', orgToken, {
    communityId, title: `Cert Seed Event ${stamp}`, shortDescription: 'Certificate UI test event',
    mode: 'PHYSICAL', venue: 'Test Hall', bannerImage: '/uploads/smoke-banner.png',
    startDate: past(2), endDate: past(1), registrationPolicy: 'OPEN', capacity: 0,
    certificateEnabled: true, certificateMode: 'STANDARD', certificateType: 'ATTENDANCE',
    minimumAttendanceDuration: 0, visibility: 'PUBLIC',
    certificateTheme: {
      accent: process.env.SEED_ACCENT ?? '#b8933a',
      background: process.env.SEED_BG ?? 'IVORY',
      font: process.env.SEED_FONT ?? 'SERIF',
    },
    certificateContent: {
      title: process.env.SEED_TITLE ?? '',
      presentation: process.env.SEED_PRESENTATION ?? '',
      message: process.env.SEED_MESSAGE ?? '',
      signatories: (process.env.SEED_SIGS ?? '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((pair) => {
          const [name, title] = pair.split('|');
          return { name: (name ?? '').trim(), title: (title ?? '').trim() };
        }),
      logo: process.env.SEED_LOGO ?? '',
    },
    certificateStyle: process.env.SEED_STYLE ?? 'CLASSIC',
  });
  const eventId = create.json?.event?._id;
  await api('POST', `/api/events/${eventId}/publish`, orgToken);
  if (process.env.SEED_SPONSORS === '1') {
    await EventSponsorModel.create([
      { eventId, name: 'Paystack', website: 'https://paystack.com', showOnCertificate: true },
      { eventId, name: 'MTN Nigeria', website: 'https://mtn.ng', showOnCertificate: true },
    ]);
  }
  const reg = await api('POST', `/api/events/${eventId}/register`, attToken);
  const registrationId = reg.json?.registration?._id;
  await api('POST', `/api/events/${eventId}/status`, orgToken, { status: 'CHECK_IN' });
  await api('POST', `/api/events/${eventId}/registrations/${registrationId}/check-in`, orgToken);
  await api('POST', `/api/events/${eventId}/registrations/${registrationId}/check-out`, orgToken);
  await api('POST', `/api/events/${eventId}/issue-certificates`, orgToken);
  const mine = await api('GET', '/api/certificates/mine', attToken);
  const serial = mine.json?.certificates?.[0]?.serial;

  console.log('CERT_SERIAL=' + serial);
  console.log('VERIFY_URL=' + `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/certificates/${serial}`);
  console.log('ATT_TOKEN=' + attToken);
  console.log('CLEANUP_TAG=' + stamp);
  await mongoose.connection.close();
  process.exit(0);
})().catch(async (e) => { console.error(e); try { await mongoose.connection.close(); } catch {} process.exit(1); });
