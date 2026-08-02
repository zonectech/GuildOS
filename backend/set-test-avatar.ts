// One-off: give the "Amina Yusuf" test account an avatar so the leader-photo
// suggestion flow can be demoed/tested. Reuses an image already in /uploads.
import { config as loadEnv } from 'dotenv';
loadEnv();
import mongoose from 'mongoose';
import { config } from './src/config';
import { UserModel } from './src/models/user.model';

async function main() {
  await mongoose.connect(config.mongoUri);
  const user = await UserModel.findById('6a4e97137a41ae7c882dbedc');
  if (!user) {
    console.log('Amina Yusuf not found');
  } else {
    user.profile = { ...(user.profile ?? {}), avatar: '/uploads/1782776490615-79411098.png' } as typeof user.profile;
    await user.save();
    console.log('Avatar set for', user.fullName, '->', user.profile?.avatar);
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
