import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
(async () => {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const community = await db.collection('communities').findOne({ slug: 'robotics-guild-demo' }, { projection: { _id: 1 } });
  const payouts = await db.collection('walletpayouts').find({ communityId: community!._id }).project({ amount: 1, status: 1, bankName: 1, createdAt: 1, note: 1 }).toArray();
  console.log('payouts:', JSON.stringify(payouts, null, 1));
  const payments = await db.collection('ticketpayments').aggregate([
    { $match: { communityId: community!._id, status: 'PAID' } },
    { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
    { $project: { reference: 1, organizerAmount: 1, event: { $first: '$event.title' }, eventStatus: { $first: '$event.status' } } },
  ]).toArray();
  console.log('PAID payments:', JSON.stringify(payments, null, 1));
  await mongoose.disconnect();
})();
