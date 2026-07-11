/**
 * Live-test helper — upserts a verified login-able test user.
 * Run: npx tsx --env-file=.env seed-livetest.ts
 * Login: livetest@guildos.local / LiveTest123!
 */
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';
import { hashPassword } from './src/utils/password';

async function main() {
  await connectDatabase();
  const email = 'livetest@guildos.local';
  const { salt, hash } = hashPassword('LiveTest123!');
  const existing = await UserModel.findOne({ email });
  if (existing) {
    existing.set({ passwordHash: hash, passwordSalt: salt, emailVerified: true, status: 'ACTIVE' });
    await existing.save();
    console.log('Updated existing live-test user:', email, existing._id.toString());
  } else {
    const user = await UserModel.create({
      fullName: 'Live Tester',
      email,
      passwordHash: hash,
      passwordSalt: salt,
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerified: true,
      profile: { username: 'live_tester', university: 'Ahmadu Bello University' },
    } as never);
    console.log('Created live-test user:', email, user._id.toString());
  }
  await mongoose.disconnect();
}

void main();
