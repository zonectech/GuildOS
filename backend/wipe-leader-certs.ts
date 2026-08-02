// One-off: wipe ALL leadership certificates for the demo community — they were issued
// during testing while the roster is still ACTIVE (not actually dissolved), which is
// misleading. Real certificates should only exist for genuinely dissolved sessions.
import { config as loadEnv } from 'dotenv';
loadEnv();
import mongoose from 'mongoose';
import { config } from './src/config';
import { CertificateModel } from './src/models/certificate.model';
import { CommunityModel } from './src/models/community.model';
import { PostModel } from './src/models/post.model';
import { ReputationActivityModel } from './src/models/reputation-activity.model';
import { recalculateReputation } from './src/services/reputation.service';

async function main() {
  await mongoose.connect(config.mongoUri);
  const community = await CommunityModel.findOne({ slug: 'robotics-guild-demo' }).select('_id').lean();
  if (!community) throw new Error('community not found');

  const certs = await CertificateModel.find({ communityId: community._id, leaderId: { $ne: null } })
    .select('_id serial userId leaderId')
    .lean();
  console.log('found', certs.length, 'leadership certificates');

  for (const cert of certs) {
    await PostModel.deleteMany({ kind: 'MILESTONE', 'milestone.type': 'CERTIFICATE', 'milestone.refId': cert._id.toString() });
    if (cert.userId && cert.leaderId) {
      const removed = await ReputationActivityModel.deleteOne({ userId: cert.userId, type: 'LEADERSHIP_SERVED', referenceId: cert.leaderId });
      if (removed.deletedCount) await recalculateReputation(cert.userId.toString());
    }
  }
  const res = await CertificateModel.deleteMany({ _id: { $in: certs.map((c) => c._id) } });
  console.log('deleted', res.deletedCount, 'certificates (+ posts/reputation side-effects)');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
