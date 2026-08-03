/**
 * Live test: public door-scanner passes (multi-link, single-device).
 *   1. Manager mints 3 SCN- passes (labels Scanner 1..3)
 *   2. Door info is public; first device claims the pass
 *   3. A second device is refused on a claimed pass
 *   4. Scan-in works with NO account (token+device = authorization)
 *   5. Duplicate scan blocked
 *   6. Scan-out completes attendance (stay-to-end respected)
 *   7. Scanning refused while event not in CHECK_IN/CHECK_OUT
 *   8. Revoking a pass kills it; other passes keep working
 *   9. Cap: can't exceed 10 passes per event
 */
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { ScannerPassModel } from './src/models/scanner-pass.model';
import { NotificationModel } from './src/models/notification.model';
import { createScannerPasses, revokeScannerPass, doorScan, getDoorScannerInfo } from './src/services/event/event-attendance.service';
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
    const helper2 = await mkUser('Door Helper2', 'drh');
    await registerForEvent(eventId, helper2._id.toString());
    const reg2 = await EventRegistrationModel.findOne({ eventId, userId: helper2._id });

    // 1. mint 3 passes
    const passes = await createScannerPasses(eventId, founder._id.toString(), 3);
    check('manager mints 3 SCN- passes with labels', passes.length === 3 && passes.every((p) => p.token.startsWith('SCN-')) && passes[2].label === 'Scanner 3', passes.map((p) => p.label));
    const [passA, passB] = passes;

    // 7. closed while PUBLISHED
    let closed = '';
    try { await doorScan(passA.token, reg.qrToken, 'in', 'device-A'); } catch (err) { closed = err instanceof Error ? err.message : 'x'; }
    check('scanning refused before check-in opens', closed.includes('closed'), closed);

    await EventModel.updateOne({ _id: eventId }, { $set: { status: 'CHECK_IN' } });

    // 2. public info + device claim
    const info = await getDoorScannerInfo(passA.token, 'device-A');
    check('door info is public; first device claims the pass', info.title.startsWith('Door Event') && info.scanningOpen === true && info.label === 'Scanner 1', info);

    // 3. second device refused
    let otherDevice = '';
    try { await getDoorScannerInfo(passA.token, 'device-EVIL'); } catch (err) { otherDevice = err instanceof Error ? err.message : 'x'; }
    check('claimed pass refuses another device', otherDevice.includes('another device'), otherDevice);
    let otherScan = '';
    try { await doorScan(passA.token, reg.qrToken, 'in', 'device-EVIL'); } catch (err) { otherScan = err instanceof Error ? err.message : 'x'; }
    check('scans from another device are refused too', otherScan.includes('another device'), otherScan);

    // 4. scan-in from the claiming device
    const scanIn = await doorScan(passA.token, reg.qrToken, 'in', 'device-A');
    check('scan-in works with no account', scanIn.success && scanIn.student === 'Door Attendee', scanIn);
    const regDoc = await EventRegistrationModel.findById(reg._id).lean();
    check('scan attributed as DOOR_LINK', regDoc?.scannerRole === 'DOOR_LINK' && regDoc?.status === 'CHECKED_IN', { role: regDoc?.scannerRole, status: regDoc?.status });

    // 5. duplicate blocked
    let dup = '';
    try { await doorScan(passA.token, reg.qrToken, 'in', 'device-A'); } catch (err) { dup = err instanceof Error ? err.message : 'x'; }
    check('duplicate scan-in blocked', dup.includes('Already checked in'), dup);

    // 6. scan-out (event ended → stay-to-end satisfied → COMPLETED)
    const scanOut = await doorScan(passA.token, reg.qrToken, 'out', 'device-A');
    check('scan-out completes attendance', scanOut.success && scanOut.status === 'COMPLETED', scanOut);

    // 8. revoke passA; passB (claimed by device-B) still works
    await revokeScannerPass(eventId, passA.id, founder._id.toString());
    let revoked = '';
    try { await getDoorScannerInfo(passA.token, 'device-A'); } catch (err) { revoked = err instanceof Error ? err.message : 'x'; }
    check('revoked pass is dead', revoked.includes('invalid'), revoked);
    const scanB = await doorScan(passB.token, reg2!.qrToken, 'in', 'device-B');
    check('other passes keep working after a revoke', scanB.success && scanB.student === 'Door Helper2', scanB);

    // 9. cap at 10
    await createScannerPasses(eventId, founder._id.toString(), 6); // 2 existing + 6 = 8
    let capped = '';
    try { await createScannerPasses(eventId, founder._id.toString(), 5); } catch (err) { capped = err instanceof Error ? err.message : 'x'; }
    check('cap of 10 passes enforced', capped.includes('at most 10'), capped);

    await UserModel.deleteOne({ _id: helper2._id });
  } catch (err) {
    failed += 1;
    console.error('  TEST ERROR:', err instanceof Error ? err.message : err);
  } finally {
    console.log(`\n=== ${passed} passed, ${failed} failed ===`);
    await NotificationModel.deleteMany({ userId: { $in: [founder._id, attendee._id] } });
    await ScannerPassModel.deleteMany({ eventId });
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
