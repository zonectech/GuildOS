import 'dotenv/config';
import mongoose from 'mongoose';

import { config } from './src/config';
import { UserModel } from './src/models/user.model';

async function main() {
  await mongoose.connect(config.mongoUri);

  const filter = {
    'profile.department': { $in: ['', null] },
    'profile.faculty': { $nin: ['', null] },
  };

  const update = [
    {
      $set: {
        'profile.department': '$profile.faculty',
      },
    },
  ];

  const result = await UserModel.updateMany(filter, update as never);

  console.log('Profile course backfill completed');
  console.log(`matched=${result.matchedCount} modified=${result.modifiedCount}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Profile course backfill failed', error);
  process.exit(1);
});
