import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
(async () => {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const past = await db.collection('opportunities').countDocuments({ status: 'OPEN', deadline: { $ne: null, $lt: new Date() } });
  const noDeadline = await db.collection('opportunities').countDocuments({ status: 'OPEN', deadline: null });
  console.log('OPEN past-deadline:', past, '| OPEN no-deadline:', noDeadline);
  await mongoose.disconnect();
})();
