// Live-test: revoke side-effects on a leadership certificate (milestone post removed,
// LEADERSHIP_SERVED reputation clawed back, page keeps saying REVOKED), then restore
// everything so the demo data stays intact.
import { config as loadEnv } from 'dotenv';
loadEnv();
import mongoose from 'mongoose';
import { config } from './src/config';
import { CertificateModel } from './src/models/certificate.model';
import { PostModel } from './src/models/post.model';
import { ReputationActivityModel } from './src/models/reputation-activity.model';
import { revokeCertificate } from './src/services/event/event-certificate.service';
import { awardReputation, REPUTATION_POINTS } from './src/services/reputation.service';
import { createMilestonePost } from './src/services/feed.service';
import { CommunityModel } from './src/models/community.model';
import { CommunityLeaderModel } from './src/models/community-leader.model';

const SERIAL = 'GLD-2026-000006'; // Amina Yusuf — linked account, has post + reputation

async function main() {
  await mongoose.connect(config.mongoUri);
  const cert = await CertificateModel.findOne({ serial: SERIAL });
  if (!cert || !cert.userId || !cert.leaderId) throw new Error('cert/user/leader missing');
  const userId = cert.userId.toString();
  const certId = cert._id.toString();

  const postsBefore = await PostModel.countDocuments({ kind: 'MILESTONE', 'milestone.refId': certId });
  const repBefore = await ReputationActivityModel.countDocuments({ userId: cert.userId, type: 'LEADERSHIP_SERVED', referenceId: cert.leaderId });
  console.log('BEFORE  status:', cert.status, '| milestone posts:', postsBefore, '| rep awards:', repBefore);

  await revokeCertificate(SERIAL, userId, 'Live test — will be restored');

  const after = await CertificateModel.findOne({ serial: SERIAL }).lean();
  const postsAfter = await PostModel.countDocuments({ kind: 'MILESTONE', 'milestone.refId': certId });
  const repAfter = await ReputationActivityModel.countDocuments({ userId: cert.userId, type: 'LEADERSHIP_SERVED', referenceId: cert.leaderId });
  console.log('REVOKED status:', after?.status, '| milestone posts:', postsAfter, '| rep awards:', repAfter);
  console.log('checks:', after?.status === 'REVOKED' && postsAfter === 0 && repAfter === 0 ? 'ALL PASS' : 'FAILED');

  // ---- restore demo state ----
  await CertificateModel.updateOne({ serial: SERIAL }, { $set: { status: 'VERIFIED', revokedAt: null, revokedBy: null, revokeReason: '' } });
  const community = await CommunityModel.findById(cert.communityId).lean();
  const leader = await CommunityLeaderModel.findById(cert.leaderId).lean();
  if (community && leader) {
    await createMilestonePost(userId, {
      type: 'CERTIFICATE',
      label: `Completed a leadership term as ${leader.title || 'an executive'} · @${community.name}`,
      refId: certId,
      communityId: community._id.toString(),
      tags: [{ type: 'COMMUNITY', refId: community._id.toString(), label: community.name, handle: community.slug }],
    }).catch(() => undefined);
    await awardReputation({
      userId,
      category: 'LEADERSHIP',
      type: 'LEADERSHIP_SERVED',
      scoreAwarded: REPUTATION_POINTS.LEADERSHIP_SERVED,
      description: `Served as ${leader.title || 'an executive'} of ${community.name} (${leader.session})`,
      referenceId: cert.leaderId.toString(),
      communityId: community._id.toString(),
    }).catch(() => undefined);
  }
  const restored = await CertificateModel.findOne({ serial: SERIAL }).select('status').lean();
  console.log('RESTORED status:', restored?.status);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
