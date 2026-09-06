/* One-off: flip the NovaTech demo inquiry feeStatus to test the paid-revoke guard. Usage: npx tsx --env-file=.env flip-fee-status.ts PAID|PENDING */
import mongoose from 'mongoose';
import { SponsorshipInquiryModel } from './src/models/sponsorship-inquiry.model';

async function main() {
  const status = process.argv[2] as 'PAID' | 'PENDING';
  if (!['PAID', 'PENDING'].includes(status)) throw new Error('pass PAID or PENDING');
  await mongoose.connect(process.env.MONGODB_URI as string);
  const inquiry = await SponsorshipInquiryModel.findOne({ companyName: 'NovaTech Systems', status: 'WON' });
  if (!inquiry) throw new Error('NovaTech WON inquiry not found');
  inquiry.feeStatus = status;
  await inquiry.save();
  console.log('inquiry', inquiry._id.toString(), 'feeStatus →', status);
  await mongoose.disconnect();
}
void main();
