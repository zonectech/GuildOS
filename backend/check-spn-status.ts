import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from './src/config';
import { SponsorshipPaymentModel } from './src/models/sponsorship-payment.model';
import { verifySponsorshipPayment } from './src/services/sponsorship-payment.service';

async function main() {
  await mongoose.connect(config.mongoUri);
  const payments = await SponsorshipPaymentModel.find({}).sort({ createdAt: -1 }).limit(5).lean();
  for (const p of payments) console.log(p.reference, p.status, 'total', p.amount / 100, p.companyName);
  const pending = payments.find((p) => p.status === 'PENDING');
  if (pending) {
    console.log('verifying', pending.reference, '…');
    const out = await verifySponsorshipPayment(pending.reference);
    console.log('verify result:', JSON.stringify(out));
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
