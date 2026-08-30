import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from './src/config';
import { setPaymentGateway, getPaymentGateway } from './src/services/premium.service';
async function main() {
  await mongoose.connect(config.mongoUri);
  const set = await setPaymentGateway(process.argv[2] ?? 'FLUTTERWAVE');
  console.log('platform gateway is now:', await getPaymentGateway(), '(set:', set + ')');
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
