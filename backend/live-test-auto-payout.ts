/** Auto-payout test: AUTO mode without gateway keys must fall back to a PENDING manual request. */
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { config } from './src/config';
import { CommunityModel } from './src/models/community.model';
import { EventModel } from './src/models/event.model';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { WalletPayoutModel } from './src/models/wallet-payout.model';
import { UserModel } from './src/models/user.model';
import { getCommunityWallet, requestWalletPayout, setPayoutMode, getPayoutMode } from './src/services/community/community-wallet.service';

async function main() {
  await mongoose.connect(config.mongoUri);
  const community = await CommunityModel.findOne({ slug: 'robotics-guild-demo' });
  const event = await EventModel.findOne({ slug: 'tech-week-summit-demo' });
  const leader = await UserModel.findOne({ email: 'livetest@guildos.local' });
  if (!community || !event || !leader) throw new Error('fixtures missing');

  await setPayoutMode('AUTO');
  console.log('payout mode:', await getPayoutMode());

  // Synthetic PAID sale so there is a balance to withdraw.
  const buyer = await UserModel.create({ email: `auto-${randomUUID().slice(0, 6)}@test.local`, fullName: 'Auto Test Buyer', username: `auto${randomUUID().slice(0, 6)}`, role: 'STUDENT', passwordHash: 'x', passwordSalt: 'x', emailVerified: true });
  const payment = await TicketPaymentModel.create({
    eventId: event._id, communityId: community._id, userId: buyer._id, provider: 'PAYSTACK',
    reference: `TKT-AUTOTEST-${randomUUID().slice(0, 8)}`, amount: 2030 * 100, baseAmount: 2000 * 100,
    feeAmount: 30 * 100, commissionAmount: 200 * 100, organizerAmount: 1800 * 100, currency: 'NGN', status: 'PAID', paidAt: new Date(),
  });

  const wallet = await getCommunityWallet(String(community._id), String(leader._id));
  console.log('wallet payoutMode:', wallet.payoutMode, '| available:', wallet.availableNgn);

  const payout = await requestWalletPayout(String(community._id), String(leader._id), {
    amountNgn: 1800, bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Robotics Guild ABU',
  });
  console.log('payout status:', payout.status);
  console.log('payout note:', payout.note);

  // Cleanup
  await WalletPayoutModel.deleteOne({ _id: payout._id });
  await TicketPaymentModel.deleteOne({ _id: payment._id });
  await UserModel.deleteOne({ _id: buyer._id });
  await setPayoutMode('MANUAL');
  console.log('cleaned up; payout mode back to', await getPayoutMode());
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
