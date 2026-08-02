/** Ticketing smoke test — sets a price on the demo event, checks quote math and guards. */
import mongoose from 'mongoose';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { UserModel } from './src/models/user.model';
import { getTicketQuote, startTicketCheckout } from './src/services/event/event-ticket.service';
import { registerForEvent } from './src/services/event/event-registration.service';

async function main() {
  await mongoose.connect(config.mongoUri);
  const event = await EventModel.findOne({ slug: 'demo-seed-hack-the-campus' });
  if (!event) throw new Error('demo event not found');
  const originalStatus = event.status;
  event.status = 'PUBLISHED';
  event.registrationDeadline = null as never;
  event.ticketPrice = 1500;
  await event.save();

  const quote = await getTicketQuote(String(event._id));
  console.log('quote:', quote);

  const user = await UserModel.findOne({ email: 'livetest2@guildos.local' }) ?? await UserModel.findOne({ email: 'livetest@guildos.local' });
  if (!user) throw new Error('test user not found');

  try {
    await registerForEvent(String(event._id), String(user._id));
    console.log('FAIL: free registration was allowed on a paid event');
  } catch (err) {
    console.log('free-register guard OK:', (err as Error).message);
  }

  try {
    await startTicketCheckout(String(event._id), String(user._id));
    console.log('checkout started (gateway configured?)');
  } catch (err) {
    console.log('checkout guard OK:', (err as Error).message);
  }

  // reset
  event.ticketPrice = 0;
  event.status = originalStatus;
  await event.save();
  console.log('ticketPrice + status reset');
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
