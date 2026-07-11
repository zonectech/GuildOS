import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { createToken } from './src/utils/token';

(async () => {
  await connectDatabase();
  const u = await mongoose.connection
    .collection('users')
    .findOne({ email: { $ne: 'sonabubakar63@gmail.com' } }, { projection: { _id: 1, fullName: 1, email: 1 } });
  if (!u) {
    console.log('NO_OTHER_USER');
    process.exit(0);
  }
  // Ensure this user is NOT a member of the ABU community
  const community = await mongoose.connection.collection('communities').findOne({ slug: 'abu-ce052f75' });
  if (community) {
    const membership = await mongoose.connection
      .collection('memberships')
      .findOne({ communityId: community._id, userId: u._id });
    console.log('IS_MEMBER=' + Boolean(membership));
  }
  console.log('USER=' + JSON.stringify({ id: u._id.toString(), name: u.fullName, email: u.email }));
  console.log('TOKEN=' + createToken({ sub: u._id.toString(), purpose: 'access', jti: 'demo-view2' } as any, 86400000));
  process.exit(0);
})();
