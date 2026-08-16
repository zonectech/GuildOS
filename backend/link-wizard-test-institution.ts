// One-off: link ALL existing wizard-test communities to the Smoke Test University
// institution so founder updates (join-mode toggle etc.) pass the registry guard.
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { CommunityModel } from './src/models/community.model';
import { InstitutionModel } from './src/models/institution.model';

(async () => {
  await connectDatabase();
  let institution = await InstitutionModel.findOne({ normalizedName: 'smoke test university' });
  if (!institution) {
    institution = await InstitutionModel.create({ name: 'Smoke Test University', normalizedName: 'smoke test university' });
    console.log('created institution:', institution.name);
  }
  const result = await CommunityModel.updateMany(
    { slug: /^wizard-test-guild-/, institutionId: null },
    { institutionId: institution._id, university: institution.name },
  );
  console.log(`linked ${result.modifiedCount} wizard-test communities to ${institution.name}`);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => undefined);
  throw e; // non-zero exit via unhandled rejection
});
