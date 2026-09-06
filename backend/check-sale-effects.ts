import 'dotenv/config';
import mongoose from 'mongoose';
import { NotificationModel } from './src/models/notification.model';
import { UserModel } from './src/models/user.model';
import { getCommunityWallet } from './src/services/community/community-wallet.service';
import { CommunityModel } from './src/models/community.model';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/guildos');
  const buyer: any = await UserModel.findOne({ email: 'guildos.livetest2@gmail.com' }).lean();
  const community: any = await CommunityModel.findOne({ slug: 'mssn-fut-minna' }).lean() ?? await CommunityModel.findById('6a524ad9e7634e0afcefc183').lean();
  const founderId = String(community.founder);

  const buyerBells = await NotificationModel.find({ userId: buyer._id }).sort({ createdAt: -1 }).limit(3).select('title createdAt').lean();
  console.log('buyer bells:', buyerBells.map((n: any) => `${n.title} (${n.createdAt.toISOString().slice(11, 19)})`));

  const founderBells = await NotificationModel.find({ userId: founderId }).sort({ createdAt: -1 }).limit(3).select('title createdAt').lean();
  console.log('founder bells:', founderBells.map((n: any) => `${n.title} (${n.createdAt.toISOString().slice(11, 19)})`));

  const wallet = await getCommunityWallet(String(community._id), founderId);
  console.log('wallet:', { earned: wallet.earnedNgn, held: wallet.heldNgn, available: wallet.availableNgn, sales: wallet.sales.length });
  console.log('latest sale:', wallet.sales[0]);
  await mongoose.disconnect();
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect(); });
