/** Escrow test: earnings held until the event happens; payout blocked on held funds.
 * DELTA-BASED: the demo wallet legitimately carries live-test history (real PAID
 * sales, a PAID payout), so assertions compare against a measured baseline instead
 * of absolute figures. Also cleans leftovers from prior aborted runs. */
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { WalletPayoutModel } from './src/models/wallet-payout.model';
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

  // Stale runs: drop leftover synthetic payments + the pending payout a prior
  // aborted run may have created (this suite's own signature: GTBank / test account).
  await TicketPaymentModel.deleteMany({ reference: /^TKT-ESCROW-/ });
  await WalletPayoutModel.deleteMany({ communityId: community._id, status: 'PENDING', accountName: 'Robotics Guild ABU' });
  await UserModel.deleteMany({ email: /^esc-.*@test\.local$/ });

  // Baseline BEFORE the synthetic sale — the wallet may hold real history.
  event.status = 'PUBLISHED';
  await event.save();
  const baseline = await getCommunityWallet(String(community._id), String(owner._id));
  // Other PAID sales on THIS event release together with ours when it completes.
  const otherOnEvent = await TicketPaymentModel.aggregate<{ _id: null; ngn: number }>([
    { $match: { eventId: event._id, status: 'PAID' } },
    { $group: { _id: null, ngn: { $sum: '$organizerAmount' } } },
  ]).then((rows) => Math.round((rows[0]?.ngn ?? 0) / 100));

  // Synthetic PAID sale on the (PUBLISHED = upcoming) demo event.
  const buyer = await UserModel.create({ email: `esc-${randomUUID().slice(0, 6)}@test.local`, fullName: 'Escrow Buyer', username: `esc${randomUUID().slice(0, 6)}`, role: 'STUDENT', passwordHash: 'x', passwordSalt: 'x', emailVerified: true });
  const payment = await TicketPaymentModel.create({
    eventId: event._id, communityId: community._id, userId: buyer._id, provider: 'PAYSTACK',
    reference: `TKT-ESCROW-${randomUUID().slice(0, 8)}`, amount: 1523 * 100, baseAmount: 1500 * 100,
    feeAmount: 23 * 100, commissionAmount: 150 * 100, organizerAmount: 1350 * 100, currency: 'NGN', status: 'PAID', paidAt: new Date(),
  });

  const held = await getCommunityWallet(String(community._id), String(owner._id));
  ok(
    held.heldNgn === baseline.heldNgn + 1350 && held.availableNgn === baseline.availableNgn,
    `upcoming event: held +₦1,350 (₦${held.heldNgn}), available unchanged (₦${held.availableNgn})`,
  );

  try {
    // Demo wallet can legitimately be in DEBT (payout happened, then the seed re-published
    // the event, pulling released money back into held) — request a valid amount that is
    // always above both the ₦1,000 minimum and the available balance.
    await requestWalletPayout(String(community._id), String(owner._id), { amountNgn: Math.max(1350, held.availableNgn + 1350), bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Robotics Guild ABU' });
    ok(false, 'payout of held funds blocked');
  } catch (err) {
    ok(/held until your events take place/.test((err as Error).message), `payout blocked: "${(err as Error).message}"`);
  }

  // Event happens → funds release (ours + any other PAID sale on this event).
  event.status = 'COMPLETED';
  await event.save();
  const released = await getCommunityWallet(String(community._id), String(owner._id));
  ok(
    released.heldNgn === baseline.heldNgn - otherOnEvent && released.availableNgn === baseline.availableNgn + otherOnEvent + 1350,
    `after completion: available +₦${otherOnEvent + 1350} (₦${released.availableNgn}), held ₦${released.heldNgn}`,
  );

  // Cleanup.
  event.status = originalStatus;
  await event.save();
  await TicketPaymentModel.deleteOne({ _id: payment._id });
  await UserModel.deleteOne({ _id: buyer._id });
  console.log(`\n${checks} checks done; demo restored (event ${originalStatus}).`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
