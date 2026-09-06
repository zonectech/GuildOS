import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from './src/config';
import { UserModel } from './src/models/user.model';
import { ConversationModel, conversationPairKey } from './src/models/conversation.model';
import { sendMessage } from './src/services/messaging.service';

async function main() {
  await mongoose.connect(config.mongoUri);
  const [a, b] = await Promise.all([
    UserModel.findOne({ email: 'livetest@guildos.local' }).select('_id').lean(),
    UserModel.findOne({ 'profile.username': 'second_tester' }).select('_id').lean(),
  ]);
  if (!a || !b) throw new Error('fixtures missing');
  // Ensure the demo pair is connected (PEER sends re-validate the connection).
  const { ConnectionModel, connectionPairKey } = await import('./src/models/connection.model');
  const pairKey = connectionPairKey(String(a._id), String(b._id));
  const existing = await ConnectionModel.findOne({ pairKey });
  if (existing) {
    if (existing.status !== 'ACCEPTED') { existing.status = 'ACCEPTED'; await existing.save(); }
  } else {
    await ConnectionModel.create({ requesterId: b._id, addresseeId: a._id, pairKey, status: 'ACCEPTED' });
  }
  const conv =
    (await ConversationModel.findOne({ participants: { $all: [a._id, b._id] } })) ??
    (await ConversationModel.create({ participants: [a._id, b._id], pairKey: conversationPairKey(String(a._id), String(b._id)), unread: {} }));
  await sendMessage(String(b._id), String(conv._id), 'Badge test — are you seeing this in the nav?');
  console.log('sent from second_tester -> livetest, convo', String(conv._id));
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
