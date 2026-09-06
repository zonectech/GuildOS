import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from './src/config';
import { SponsorshipPaymentModel } from './src/models/sponsorship-payment.model';
import { NotificationModel } from './src/models/notification.model';

async function main() {
  await mongoose.connect(config.mongoUri);
  const r = await SponsorshipPaymentModel.updateOne(
    { reference: 'SPN-3d3db7-e39c5599a2cd' },
    { $set: { status: 'REFUNDED', refundRef: '4797464', refundedAt: new Date('2026-09-02T21:03:33.000Z') } },
  );
  console.log('payment restored to REFUNDED:', r.modifiedCount);
  const n = await NotificationModel.deleteMany({ title: 'Sponsorship refund needs manual settlement' });
  console.log('spurious admin bells removed:', n.deletedCount);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
