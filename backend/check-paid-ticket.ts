import 'dotenv/config';
import mongoose from 'mongoose';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { EventRegistrationModel } from './src/models/event-registration.model';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/guildos');
  const p: any = await TicketPaymentModel.findOne({ reference: 'TKT-9b3c4b-8519f9f419ba' }).lean();
  console.log('payment:', p ? { status: p.status, amount: p.amount / 100, base: p.baseAmount / 100, fee: p.feeAmount / 100, commission: p.commissionAmount / 100, organizer: p.organizerAmount / 100, paidAt: p.paidAt, registrationId: String(p.registrationId ?? '') } : 'NOT FOUND');
  if (p) {
    const reg: any = await EventRegistrationModel.findOne({ eventId: p.eventId, userId: p.userId }).sort({ createdAt: -1 }).lean();
    console.log('registration:', reg ? { status: reg.status, section: reg.sectionKey, qrToken: reg.qrToken ? 'SET' : 'missing', passCode: reg.passCode } : 'NOT FOUND');
  }
  await mongoose.disconnect();
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect(); });
