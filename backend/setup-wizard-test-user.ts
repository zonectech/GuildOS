// One-off: create a real, login-able test organizer + a FREE-tier (non-premium)
// community they founded, so we can drive the actual event wizard UI in the
// browser (upload logo, pick alignment, watch live preview) instead of seeding
// certificates directly. Prints the login email/password.
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { hashPassword } from './src/utils/password';

const EMAIL = 'wizardtest@guildos.local';
const PASSWORD = 'WizardTest123!';

(async () => {
  await connectDatabase();
  let user = await UserModel.findOne({ email: EMAIL });
  const { salt, hash } = hashPassword(PASSWORD);
  if (!user) {
    user = await UserModel.create({
      fullName: 'Wizard Tester',
      email: EMAIL,
      passwordSalt: salt,
      passwordHash: hash,
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerified: true,
      profile: { username: 'wizardtester', university: 'Smoke Test University' },
    } as any);
  } else {
    user.passwordSalt = salt;
    user.passwordHash = hash;
    await user.save();
  }
  const userId = user._id.toString();

  // Founder updates require the community to be linked to a verified institution
  // (institution-registry guard) — seed the institution and link it.
  const { InstitutionModel } = await import('./src/models/institution.model');
  let institution = await InstitutionModel.findOne({ normalizedName: 'smoke test university' });
  if (!institution) {
    institution = await InstitutionModel.create({ name: 'Smoke Test University', normalizedName: 'smoke test university' });
  }

  const stamp = Date.now();
  const community = await CommunityModel.create({
    name: `Wizard Test Guild ${stamp}`,
    slug: `wizard-test-guild-${stamp}`,
    normalizedName: `wizard test guild ${stamp}`,
    shortDescription: 'Throwaway free-tier community for live wizard UI testing.',
    logo: '/uploads/demo-org-logo.svg', category: 'TECH', university: institution.name,
    institutionId: institution._id,
    visibility: 'PUBLIC', verificationStatus: 'VERIFIED', verificationMethod: 'MANUAL',
    verifiedBy: userId, verifiedAt: new Date(), founder: userId, memberCount: 1, isPremium: false,
  });
  await MembershipModel.create({ userId, communityId: community._id.toString(), role: 'FOUNDER', status: 'ACTIVE', assignedBy: userId });

  console.log('EMAIL=' + EMAIL);
  console.log('PASSWORD=' + PASSWORD);
  console.log('COMMUNITY_SLUG=' + community.slug);
  console.log('COMMUNITY_NAME=' + community.name);
  await mongoose.connection.close();
  process.exit(0);
})().catch(async (e) => { console.error(e); try { await mongoose.connection.close(); } catch {} process.exit(1); });
