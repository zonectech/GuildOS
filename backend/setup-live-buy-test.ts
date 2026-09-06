import 'dotenv/config';
import mongoose from 'mongoose';
import { EventModel } from './src/models/event.model';
import { PlatformSettingsModel } from './src/models/platform-settings.model';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/guildos');

  const settings = await PlatformSettingsModel.findOne({ key: 'GLOBAL' });
  console.log('Active gateway:', settings?.paymentGateway);

  const event = await EventModel.findOne({ slug: 'tech-week-summit-demo' });
  if (!event) {
    console.log('tech-week-summit-demo not found; listing paid/published candidates:');
    const candidates = await EventModel.find({ status: 'PUBLISHED', deletedAt: null }).select('slug title ticketPrice status').limit(10).lean();
    candidates.forEach((c) => console.log(' -', c.slug, '| ₦' + c.ticketPrice, '|', c.status));
    await mongoose.disconnect();
    return;
  }
  console.log('Before:', { status: event.status, ticketPrice: event.ticketPrice, tiers: event.ticketTiers?.length ?? 0, regClosed: event.registrationClosed });
  event.ticketPrice = 100;
  event.ticketTiers = [];
  event.registrationClosed = false;
  if (event.status !== 'PUBLISHED') event.status = 'PUBLISHED';
  // Make sure the event is in the future so registration is allowed
  if (event.startDate && event.startDate.getTime() < Date.now()) {
    const shift = 7 * 24 * 60 * 60 * 1000;
    event.startDate = new Date(Date.now() + shift);
    event.endDate = new Date(Date.now() + shift + 3 * 24 * 60 * 60 * 1000);
    console.log('Shifted dates forward (event was in the past)');
  }
  await event.save();
  console.log('After:', { slug: event.slug, status: event.status, ticketPrice: event.ticketPrice, startDate: event.startDate });
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
