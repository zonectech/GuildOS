// One-off migration: replace the old strict unique index eventId_1_userId_1 with the new
// partial ones defined on certificate.model (leadership certs carry null eventId/userId,
// which the old index would treat as colliding values).
import { config as loadEnv } from 'dotenv';
loadEnv();
import mongoose from 'mongoose';
import { config } from './src/config';
import { CertificateModel } from './src/models/certificate.model';

async function main() {
  await mongoose.connect(config.mongoUri);
  const indexes = await CertificateModel.collection.indexes();
  console.log('Before:', indexes.map((i) => i.name));
  const old = indexes.find((i) => i.name === 'eventId_1_userId_1' && !i.partialFilterExpression);
  if (old) {
    await CertificateModel.collection.dropIndex('eventId_1_userId_1');
    console.log('Dropped strict eventId_1_userId_1');
  }
  await CertificateModel.syncIndexes();
  console.log('After:', (await CertificateModel.collection.indexes()).map((i) => `${i.name}${i.partialFilterExpression ? ' (partial)' : ''}`));
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
