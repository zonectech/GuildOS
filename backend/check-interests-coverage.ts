import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
(async () => {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const users = db.collection('users');
  const [total, withInterests, withSkills, onboarded, realish] = await Promise.all([
    users.countDocuments({ deletedAt: null }),
    users.countDocuments({ deletedAt: null, 'profile.interests.0': { $exists: true } }),
    users.countDocuments({ deletedAt: null, 'profile.skills.0': { $exists: true } }),
    users.countDocuments({ deletedAt: null, onboardingCompleted: true }),
    users.countDocuments({ deletedAt: null, email: { $not: /@(.*\.local|example\.(com|org)|test\.local|e2etest\.local)$/i } }),
  ]);
  console.log({ total, withInterests, withSkills, onboarded, realEmailUsers: realish });
  await mongoose.disconnect();
})();
