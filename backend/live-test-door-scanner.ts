/**
 * Live test: public door-scanner links.
 *   1. Manager mints an SCN- link
 *   2. Door info is public (title + scanningOpen)
 *   3. Scan-in works with NO account (token = authorization)
 *   4. Duplicate scan blocked
 *   5. Scan-out completes attendance (stay-to-end respected)
 *   6. Scanning refused while event not in CHECK_IN/CHECK_OUT
 *   7. Regenerating the link revokes the old token
 */
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { NotificationModel } from './src/models/notification.model';
import { getEventScannerLink } from './src/services/event/event-core.service';
import { doorScan, getDoorScannerInfo } from './src/services/event/event-attendance.service';
import { registerForEvent } from './src/services/event/event-registration.service';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed += 1; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  else { failed += 1; console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail !== undefined ? `  ->  ${JSON.stringify(detail)}` : ''}`); }
}

async function main() {
  await connectDatabase();
  const stamp = Date.now();
  const rnd = crypto.randomBytes(6).toString('hex');
  const mkUser = (name: string, tag: string) => UserModel.create({
    fullName: name, email: `${tag}-${rnd}@e2etest.local`, passwordHash: rnd, passwordSalt: rnd,
    role: 'STUDENT', status: 'ACTIVE', emailVerified: true, profile: { username: `${tag}_${rnd}`, university: 'Door U' },
  } as any);
  const founder = await mkUser('Door Founder', 'drf');
  const attendee = await mkUser('Door Attendee', 'dra');
  const community = await CommunityModel.create({
    name: `Door Guild ${stamp}`, normalizedName: `door guild ${stamp}`, slug: `door-${stamp}`,
    shortDescription: 'x', logo: '/uploads/demo-org-logo.svg', coverImage: '/uploads/smoke-cover.png',
    category: 'TECH', university: 'Door U', visibility: 'PUBLIC',
    verificationStatus: 'VERIFIED', verificationMethod: 'MANUAL', verifiedBy: founder._id, verifiedAt: new Date(),
    founder: founder._id, memberCount: 1,
  });
  await MembershipModel.create({ userId: founder._id, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: founder._id });
  const event = await EventModel.create({
    communityId: community._id, createdBy: founder._id, slug: `door-ev-${stamp}`, status: 'PUBLISHED',
    title: `Door Event ${stamp}`, shortDescription: 'x', mode: 'PHYSICAL', venue: 'Gate A',
    bannerImage: '/uploads/smoke-banner.png', registrationPolicy: 'OPEN',
    startDate: new Date(Date.now() - 3600_000), endDate: new Date(Date.now() - 60_000),
  } as any);
  const eventId = event._id.toString();

  try {
    const reg = await registerForEvent(eventId, attendee._id.toString());

    // 1. mint
    const { scannerToken } = await getEventScannerLink(eventId, founder._id.toString());
    check('manager mints an SCN- link', scannerToken.startsWith('SCN-'), scannerToken.slice(0, 6));

    // 6. closed while PUBLISHED
    let closed = '';
    try { await doorScan(scannerToken, reg.qrToken, 'in'); } catch (err) { closed = err instanceof Error ? err.message : 'x'; }
    check('scanning refused before check-in opens', closed.includes('closed'), closed);

    await EventModel.updateOne({ _id: eventId }, { $set: { status: 'CHECK_IN' } });

    // 2. public info
    const info = await getDoorScannerInfo(scannerToken);
    check('door info is public (title + scanningOpen)', info.title.startsWith('Door Event') && info.scanningOpen === true, info);

    // 3. scan-in without any account
    const scanIn = await doorScan(scannerToken, reg.qrToken, 'in');
    check('scan-in works with no account', scanIn.success && scanIn.student === 'Door Attendee', scanIn);
    const regDoc = await EventRegistrationModel.findById(reg._id).lean();
    check('scan attributed as DOOR_LINK', regDoc?.scannerRole === 'DOOR_LINK' && regDoc?.status === 'CHECKED_IN', { role: regDoc?.scannerRole, status: regDoc?.status });

    // 4. duplicate blocked
    let dup = '';
    try { await doorScan(scannerToken, reg.qrToken, 'in'); } catch (err) { dup = err instanceof Error ? err.message : 'x'; }
    check('duplicate scan-in blocked', dup.includes('Already checked in'), dup);

    // 5. scan-out (event ended → stay-to-end satisfied → COMPLETED)
    const scanOut = await doorScan(scannerToken, reg.qrToken, 'out');
    check('scan-out completes attendance', scanOut.success && scanOut.status === 'COMPLETED', scanOut);

    // 7. regenerate revokes
    const { scannerToken: fresh } = await getEventScannerLink(eventId, founder._id.toString(), true);
    check('regenerated token differs', fresh !== scannerToken);
    let revoked = '';
    try { await getDoorScannerInfo(scannerToken); } catch (err) { revoked = err instanceof Error ? err.message : 'x'; }
    check('old link is dead after regenerating', revoked.includes('invalid'), revoked);
  } catch (err) {
    failed += 1;
    console.error('  TEST ERROR:', err instanceof Error ? err.message : err);
  } finally {
    console.log(`\n=== ${passed} passed, ${failed} failed ===`);
    await NotificationModel.deleteMany({ userId: { $in: [founder._id, attendee._id] } });
    await EventRegistrationModel.deleteMany({ eventId });
    await EventModel.deleteOne({ _id: eventId });
    await MembershipModel.deleteMany({ communityId: community._id });
    await CommunityModel.deleteOne({ _id: community._id });
    await UserModel.deleteMany({ _id: { $in: [founder._id, attendee._id] } });
    await mongoose.disconnect();
    process.exit(failed ? 1 : 0);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
