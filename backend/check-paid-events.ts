import 'dotenv/config';
import mongoose from 'mongoose';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { PlatformSettingsModel } from './src/models/platform-settings.model';
import { UserModel } from './src/models/user.model';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/guildos');
  const settings = await PlatformSettingsModel.findOne({ key: 'GLOBAL' }).lean();
  console.log('Active gateway:', settings?.paymentGateway);

  const events = await EventModel.find({
    deletedAt: null,
    status: { $in: ['PUBLISHED', 'CHECK_IN'] },
    $or: [{ ticketPrice: { $gt: 0 } }, { 'ticketTiers.price': { $gt: 0 } }],
  })
    .select('title slug status ticketPrice ticketTiers startDate registrationClosed')
    .lean();
  console.log('\nPaid live events:');
  for (const e of events) {
    console.log(`- ${e.title} | /events/${e.slug} | status ${e.status} | price ₦${e.ticketPrice} | tiers ${(e.ticketTiers ?? []).map((t: any) => `${t.name}:₦${t.price}`).join(',') || 'none'} | starts ${e.startDate?.toISOString?.().slice(0, 10)} | regClosed ${e.registrationClosed}`);
    const testUsers = await UserModel.find({ email: /livetest\d*@guildos\.local/ }).select('email fullName').lean();
    for (const u of testUsers) {
      const reg = await EventRegistrationModel.findOne({ eventId: e._id, userId: u._id, status: { $nin: ['CANCELLED', 'REJECTED'] } }).lean();
      if (!reg) console.log(`    can buy: ${u.email}`);
    }
  }
  await mongoose.disconnect();
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect(); });
