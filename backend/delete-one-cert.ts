// One-off: delete Muhammed Aliyu's existing leadership certificate so the CUSTOM-template
// dissolve demo can issue him a fresh one (idempotency is keyed on leaderId).
import { config as loadEnv } from 'dotenv';
loadEnv();
import mongoose from 'mongoose';
import { config } from './src/config';
import { CertificateModel } from './src/models/certificate.model';

async function main() {
  await mongoose.connect(config.mongoUri);
  const r = await CertificateModel.deleteOne({ serial: 'GLD-2026-000022' });
  console.log('deleted', r.deletedCount, 'certificate');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
