// One-off: link the legacy demo community to a verified institution so founder
// updates (e.g. the join-mode toggle) pass the institution-registry guard.
import { config as loadEnv } from 'dotenv';
loadEnv();
import mongoose from 'mongoose';
import { config } from './src/config';
import { CommunityModel } from './src/models/community.model';
import { InstitutionModel } from './src/models/institution.model';

async function main() {
  await mongoose.connect(config.mongoUri);
  const community = await CommunityModel.findOne({ slug: 'robotics-guild-demo' });
  if (!community) throw new Error('community not found');
  console.log('current university:', JSON.stringify(community.university), '| institutionId:', community.institutionId);

  let institution = await InstitutionModel.findOne({ normalizedName: 'ahmadu bello university' });
  if (!institution) {
    institution = await InstitutionModel.create({
      name: 'Ahmadu Bello University',
      normalizedName: 'ahmadu bello university',
    });
    console.log('created institution', institution.name);
  }

  community.institutionId = institution._id;
  community.university = institution.name;
  // Legacy gotcha: normalizedName is now required but old demo docs predate it.
  if (!community.normalizedName) community.normalizedName = community.name.trim().toLowerCase();
  await community.save();
  console.log('linked to institution:', institution.name);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
