import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from './src/config';
import { SponsorshipInquiryModel } from './src/models/sponsorship-inquiry.model';
import { EventSponsorModel } from './src/models/event-sponsor.model';
import { EventModel } from './src/models/event.model';
import { UserModel } from './src/models/user.model';
import { getCommunityWallet } from './src/services/community/community-wallet.service';

async function main() {
  await mongoose.connect(config.mongoUri);
  const event = await EventModel.findOne({ slug: 'ai-robotics-career-night-2026-d0afdaae' }).select('_id communityId').lean();
  const inq = await SponsorshipInquiryModel.findOne({ eventId: event!._id, email: 'kolawoleabubakir6@gmail.com' }).lean();
  console.log('inquiry:', inq?.companyName, 'status', inq?.status, 'feeStatus', inq?.feeStatus);
  const sponsor = await EventSponsorModel.findOne({ eventId: event!._id }).lean();
  console.log('sponsor listing:', sponsor?.name, 'paidViaPlatform', sponsor?.paidViaPlatform, 'showOnCertificate', sponsor?.showOnCertificate);
  const owner = await UserModel.findOne({ email: 'livetest@guildos.local' }).select('_id').lean();
  const w = await getCommunityWallet(String(event!.communityId), String(owner!._id));
  console.log('wallet: available', w.availableNgn, 'held', w.heldNgn);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
