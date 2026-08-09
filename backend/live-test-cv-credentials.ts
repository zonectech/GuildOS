/**
 * Test: profile skills field, self-reported external credentials, and the "living CV"
 * refresh/freshness/staleness-notification loop, all wired together.
 * Run: npx tsx --env-file=.env live-test-cv-credentials.ts
 */
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { config } from './src/config';
import { UserModel } from './src/models/user.model';
import { CvDocumentModel } from './src/models/cv-document.model';
import { CvGenerationLogModel } from './src/models/cv-generation-log.model';
import { NotificationModel } from './src/models/notification.model';
import { ReputationActivityModel } from './src/models/reputation-activity.model';
import { ReputationScoreModel } from './src/models/reputation-score.model';
import { ExternalCredentialModel } from './src/models/external-credential.model';
import { saveProfile } from './src/services/auth.service';
import {
  createCredential, updateCredential, deleteCredential, listMyCredentials,
} from './src/services/external-credential.service';
import {
  generateCv, getCvForOwner, getCvFreshness, refreshCv, notifyStaleCvs, verifyCv,
} from './src/services/cv.service';
import { awardReputation } from './src/services/reputation.service';

let checks = 0;
function ok(cond: boolean, label: string) {
  checks += 1;
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ FAIL: ${label}`); process.exitCode = 1; }
}

async function main() {
  await mongoose.connect(config.mongoUri);

  const tag = randomUUID().slice(0, 6);
  const user = await UserModel.create({
    email: `cvtest-${tag}@test.local`,
    fullName: 'CV Test User',
    username: `cvtest${tag}`,
    role: 'STUDENT',
    passwordHash: 'x',
    passwordSalt: 'x',
    emailVerified: true,
  });
  const userId = String(user._id);

  // --- Profile: skills field ---
  await saveProfile(userId, {
    username: `cvtest${tag}`,
    university: 'Test University',
    faculty: 'Engineering',
    department: 'Computer Science',
    level: '300',
    interests: ['Robotics'],
    skills: ['Public Speaking', 'Python'],
  });
  const savedUser = await UserModel.findById(userId);
  ok((savedUser?.profile.skills ?? []).includes('Public Speaking') && (savedUser?.profile.skills ?? []).includes('Python'), 'profile.skills saved via saveProfile');

  // --- Other credentials: CRUD ---
  const cred1 = await createCredential(userId, { title: 'Google Data Analytics Certificate', issuer: 'Coursera', issueDate: '2025-01-15' });
  const cred2 = await createCredential(userId, { title: 'National Hackathon Finalist', issuer: 'DevFest' });
  let mine = await listMyCredentials(userId);
  ok(mine.length === 2, 'listMyCredentials returns both credentials');

  const updated = await updateCredential(userId, cred2.id, { title: 'National Hackathon — Finalist (Updated)' });
  ok(updated.title === 'National Hackathon — Finalist (Updated)', 'updateCredential edits in place');

  // --- CV generation wires in skills + external credentials ---
  const generated = await generateCv(userId, { template: 'PROFESSIONAL', mode: 'INTERNSHIP' });
  ok(/^CV-\d{4}-\d{6}$/.test(generated.cvId), 'cvId has the expected format');
  const cvId = generated.cvId;

  let cv = await getCvForOwner(cvId, userId);
  const certTitles = cv.content.certifications.map((c) => c.title);
  ok(certTitles.includes(cred1.title) && certTitles.includes('National Hackathon — Finalist (Updated)'), 'external credentials appear in CV certifications');
  const selfReported = cv.content.certifications.filter((c) => c.status === 'SELF_REPORTED');
  ok(selfReported.length === 2 && selfReported.every((c) => !c.verifyUrl && !c.serial), 'self-reported certs carry no fake serial/verify link');
  ok(cv.content.skills.includes('Public Speaking') && cv.content.skills.includes('Python'), 'declared skills flow into the CV');

  // --- Freshness: fresh right after generation ---
  let freshness = await getCvFreshness(cvId, userId);
  ok(freshness.stale === false, 'freshly generated CV is not stale');

  // --- Reputation changes → CV goes stale ---
  await awardReputation({
    userId,
    category: 'ATTENDANCE',
    type: 'EVENT_COMPLETED',
    scoreAwarded: 50,
    description: 'Live-test reputation bump',
    referenceId: new mongoose.Types.ObjectId().toString(),
  });
  freshness = await getCvFreshness(cvId, userId);
  ok(freshness.stale === true && freshness.currentGuildScore > freshness.storedGuildScore, 'CV goes stale after a reputation change');

  // --- Refresh: same cvId/verificationId, content catches up ---
  const beforeVerificationId = cv.verificationId;
  const refreshResult = await refreshCv(cvId, userId);
  ok(refreshResult.cvId === cvId && refreshResult.verificationId === beforeVerificationId, 'refresh keeps the same cvId/verificationId (link never breaks)');
  ok(refreshResult.refreshCount === 1 && Boolean(refreshResult.refreshedAt), 'refreshCount/refreshedAt updated');

  cv = await getCvForOwner(cvId, userId);
  ok((cv.content.guildScore?.score ?? 0) === freshness.currentGuildScore, 'refreshed CV content reflects the new Guild Score');

  freshness = await getCvFreshness(cvId, userId);
  ok(freshness.stale === false, 'CV is fresh again immediately after refresh');

  // --- Public verification page exposes refreshedAt ("last updated") ---
  const verified = await verifyCv(beforeVerificationId);
  ok(Boolean(verified.refreshedAt), 'public verify endpoint exposes refreshedAt for recruiters');

  // --- Staleness notification scheduler ---
  await createCredential(userId, { title: 'AWS Cloud Practitioner', issuer: 'AWS' }); // more drift
  // Backdate refreshedAt past the scheduler's 3-day "leave new CVs alone" window.
  await CvDocumentModel.updateOne({ cvId }, { $set: { refreshedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) } });

  const sweep1 = await notifyStaleCvs();
  ok(sweep1.notified >= 1, 'notifyStaleCvs notifies the user once their CV has drifted');
  const bell = await NotificationModel.findOne({ userId, title: 'Your CV is out of date' });
  ok(Boolean(bell), 'bell notification created with the expected title/link');
  ok(bell?.link === '/cv', 'notification links to the CV builder');

  const bellCountBefore = await NotificationModel.countDocuments({ userId, title: 'Your CV is out of date' });
  const sweep2 = await notifyStaleCvs();
  const bellCountAfter = await NotificationModel.countDocuments({ userId, title: 'Your CV is out of date' });
  ok(bellCountAfter === bellCountBefore, 'immediate re-sweep does not duplicate the notification (14-day dedupe)');
  void sweep2;

  // A manual refresh should reset the dedupe window.
  await CvDocumentModel.updateOne({ cvId }, { $set: { refreshedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) } });
  await refreshCv(cvId, userId);
  const afterManualRefresh = await CvDocumentModel.findOne({ cvId }).select('staleNotifiedAt').lean();
  ok(afterManualRefresh?.staleNotifiedAt == null, 'manual refresh resets staleNotifiedAt');

  // --- Delete a credential ---
  await deleteCredential(userId, cred1.id);
  mine = await listMyCredentials(userId);
  ok(mine.length === 2, 'deleteCredential removes exactly one credential');

  // --- Cleanup ---
  await CvGenerationLogModel.deleteMany({ userId });
  await CvDocumentModel.deleteMany({ userId });
  await ExternalCredentialModel.deleteMany({ userId });
  await NotificationModel.deleteMany({ userId });
  await ReputationActivityModel.deleteMany({ userId });
  await ReputationScoreModel.deleteMany({ userId });
  await UserModel.deleteOne({ _id: userId });

  console.log(`\n${checks} checks done; throwaway user cleaned up.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
