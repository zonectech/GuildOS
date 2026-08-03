/** Escrow test: earnings held until the event happens; payout blocked on held funds. */
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { getCommunityWallet, requestWalletPayout } from './src/services/community/community-wallet.service';

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
  const community = await CommunityModel.findOne({ slug: 'robotics-guild-demo' });
  if (!event || !owner || !community) throw new Error('fixtures missing');
  const originalStatus = event.status;

  // Synthetic PAID sale on the (PUBLISHED = upcoming) demo event.
  const buyer = await UserModel.create({ email: `esc-${randomUUID().slice(0, 6)}@test.local`, fullName: 'Escrow Buyer', username: `esc${randomUUID().slice(0, 6)}`, role: 'STUDENT', passwordHash: 'x', passwordSalt: 'x', emailVerified: true });
  const payment = await TicketPaymentModel.create({
    eventId: event._id, communityId: community._id, userId: buyer._id, provider: 'PAYSTACK',
    reference: `TKT-ESCROW-${randomUUID().slice(0, 8)}`, amount: 1523 * 100, baseAmount: 1500 * 100,
    feeAmount: 23 * 100, commissionAmount: 150 * 100, organizerAmount: 1350 * 100, currency: 'NGN', status: 'PAID', paidAt: new Date(),
  });

  const held = await getCommunityWallet(String(community._id), String(owner._id));
  ok(held.heldNgn === 1350 && held.availableNgn === 0, `upcoming event: ₦${held.heldNgn} ON HOLD, ₦${held.availableNgn} available`);

  try {
    await requestWalletPayout(String(community._id), String(owner._id), { amountNgn: 1350, bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Robotics Guild ABU' });
    ok(false, 'payout of held funds blocked');
  } catch (err) {
    ok(/held until your events take place/.test((err as Error).message), `payout blocked: "${(err as Error).message}"`);
  }

  // Event happens → funds release.
  event.status = 'COMPLETED';
  await event.save();
  const released = await getCommunityWallet(String(community._id), String(owner._id));
  ok(released.heldNgn === 0 && released.availableNgn === 1350, `after completion: ₦${released.availableNgn} available, ₦${released.heldNgn} held`);

  // Cleanup.
  event.status = originalStatus;
  await event.save();
  await TicketPaymentModel.deleteOne({ _id: payment._id });
  await UserModel.deleteOne({ _id: buyer._id });
  console.log(`\n${checks} checks done; demo restored (event ${originalStatus}).`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
