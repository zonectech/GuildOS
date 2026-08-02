/**
 * Live-test helper — upserts a second, plain MEMBER test user and joins them
 * to robotics-guild-demo (no leadership role) so we can verify what a
 * non-founder / non-manager viewer sees on the community profile.
 * Run: npx tsx --env-file=.env seed-second-tester.ts
 * Login: livetest2@guildos.local / LiveTest123!
 */
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { hashPassword } from './src/utils/password';

async function main() {
  await connectDatabase();
  const email = 'livetest2@guildos.local';
  const { salt, hash } = hashPassword('LiveTest123!');

  let user = await UserModel.findOne({ email });
  if (user) {
    user.set({ passwordHash: hash, passwordSalt: salt, emailVerified: true, status: 'ACTIVE' });
    await user.save();
    console.log('Updated existing second tester:', email, user._id.toString());
  } else {
    user = await UserModel.create({
      fullName: 'Second Tester',
      email,
      passwordHash: hash,
      passwordSalt: salt,
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerified: true,
      profile: { username: 'second_tester', university: 'Ahmadu Bello University' },
    } as never);
    console.log('Created second tester:', email, user._id.toString());
  }

  const community = await CommunityModel.findOne({ slug: 'robotics-guild-demo' });
  if (!community) {
    console.log('robotics-guild-demo community not found — run seed-partnership-demo.ts first.');
  } else {
    const existingMembership = await MembershipModel.findOne({ communityId: community._id, userId: user._id });
    if (existingMembership) {
      console.log('Second tester already a member (role:', existingMembership.role + ')');
    } else {
      await MembershipModel.create({
        communityId: community._id,
        userId: user._id,
        role: 'MEMBER',
        assignedBy: null,
      });
      console.log('Joined second tester to robotics-guild-demo as plain MEMBER');
    }
  }

  await mongoose.disconnect();
}

void main();
