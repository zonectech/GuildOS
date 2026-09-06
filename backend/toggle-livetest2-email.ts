import 'dotenv/config';
import mongoose from 'mongoose';
import { UserModel } from './src/models/user.model';

// Usage: npx tsx toggle-livetest2-email.ts [real|local]
async function main() {
  const mode = process.argv[2] === 'local' ? 'local' : 'real';
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/guildos');
  const email = mode === 'real' ? 'guildos.livetest2@gmail.com' : 'livetest2@guildos.local';
  const r = await UserModel.updateOne(
    { email: mode === 'real' ? 'livetest2@guildos.local' : 'guildos.livetest2@gmail.com' },
    { $set: { email } },
  );
  console.log(`livetest2 email -> ${email} (matched ${r.matchedCount}, modified ${r.modifiedCount})`);
  await mongoose.disconnect();
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect(); });
