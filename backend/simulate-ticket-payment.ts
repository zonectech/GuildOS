/**
 * Simulates a successful gateway payment for a ticket — dev has no Paystack key,
 * so this stands in for: checkout → buyer pays on Paystack → webhook verifies → fulfil.
 * Uses the SAME fulfilTicket path the real webhook/verify flow calls.
 */
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { UserModel } from './src/models/user.model';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { fulfilTicket, getTicketQuote, getTicketCommissionPercent } from './src/services/event/event-ticket.service';

async function main() {
  await mongoose.connect(config.mongoUri);
  const event = await EventModel.findOne({ slug: 'tech-week-summit-demo' });
  const user = await UserModel.findOne({ email: 'livetest2@guildos.local' });
  if (!event || !user) throw new Error('event or buyer not found');

  const quote = await getTicketQuote(String(event._id));
  const commissionPercent = await getTicketCommissionPercent();
  const commissionNgn = Math.round((quote.price * commissionPercent) / 100);

  const reference = `TKT-${String(event._id).slice(-6)}-${randomBytes(6).toString('hex')}`;
  const payment = await TicketPaymentModel.create({
    eventId: event._id,
    communityId: event.communityId,
    userId: user._id,
    provider: 'PAYSTACK',
    reference,
    amount: quote.total * 100,
    baseAmount: quote.price * 100,
    feeAmount: quote.fee * 100,
    commissionAmount: commissionNgn * 100,
    organizerAmount: (quote.price - commissionNgn) * 100,
    currency: 'NGN',
    status: 'PENDING',
  });
  console.log('created PENDING payment', reference, `total ₦${quote.total}`);

  // — buyer "pays" on the gateway here —

  const registration = await fulfilTicket(payment);
  payment.status = 'PAID';
  payment.paidAt = new Date();
  payment.registrationId = registration._id as never;
  await payment.save();
  console.log('payment PAID + fulfilled → registration', String(registration._id), registration.status);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
