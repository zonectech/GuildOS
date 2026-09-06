import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
(async () => {
  await connectDatabase();
  const e = await mongoose.connection.db!.collection('events').findOne({ slug: 'tech-week-summit-demo' }, { projection: { sections: 1, ticketTiers: 1, status: 1 } });
  console.log(JSON.stringify({ sections: e?.sections, tiers: e?.ticketTiers, status: e?.status }, null, 1));
  await mongoose.disconnect();
})();
