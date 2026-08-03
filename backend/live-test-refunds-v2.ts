/** Clean refund E2E: cancel paid event → real gateway refund + notifications + wallet reversal. */
import mongoose from 'mongoose';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { NotificationModel } from './src/models/notification.model';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { refundEventTickets } from './src/services/event/event-ticket.service';
import { getCommunityWallet } from './src/services/community/community-wallet.service';

let checks = 0;
function ok(cond: boolean, label: string) {
  checks += 1;
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ FAIL: ${label}`); process.exitCode = 1; }
}

async function main() {
  await mongoose.connect(config.mongoUri);
  const event = await EventModel.findOne({ slug: 'tech-week-summit-demo' });
  const owner = await UserModel.findOne({ email: 'livetest@guildos.local' });
  const buyer = await UserModel.findOne({ email: 'livetest5@guildos.local' });
  const community = await CommunityModel.findOne({ slug: 'robotics-guild-demo' });
  if (!event || !owner || !buyer || !community) throw new Error('fixtures missing');

  const before = await getCommunityWallet(String(community._id), String(owner._id));
  console.log(`wallet before: earned ₦${before.earnedNgn} (from the fresh purchase)`);
  ok(before.earnedNgn === 1350, 'fresh purchase credited the wallet ₦1,350');

  // Run the sweep directly (awaited) — this is exactly what archiveEvent fires.
  const result = await refundEventTickets(String(event._id), 'event cancelled by the organizers');
  console.log('sweep result:', JSON.stringify(result));
  ok(result.refunded === 1 && result.queued === 0, 'real sandbox charge refunded via gateway');

  const payment = await TicketPaymentModel.findOne({ eventId: event._id, userId: buyer._id, status: 'REFUNDED', refundRef: { $regex: /^rfd_/ } }).sort({ createdAt: -1 });
  ok(Boolean(payment), `payment REFUNDED with gateway ref ${payment?.refundRef}`);

  const reg = await EventRegistrationModel.findOne({ eventId: event._id, userId: buyer._id }).sort({ registeredAt: -1 });
  ok(reg?.status === 'CANCELLED', 'buyer registration cancelled');

  const bell = await NotificationModel.findOne({ userId: buyer._id, title: /Refund issued/ }).sort({ createdAt: -1 });
  ok(Boolean(bell), `buyer notified: "${bell?.title}"`);

  const after = await getCommunityWallet(String(community._id), String(owner._id));
  ok(after.earnedNgn === 0, `wallet earnings reversed (earned ₦${after.earnedNgn})`);

  console.log(`\n${checks} checks done. (Event status untouched — sweep tested directly.)`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
