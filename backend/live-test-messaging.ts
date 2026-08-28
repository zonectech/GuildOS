/**
 * Messaging live test — exercises the REAL service call paths end-to-end:
 * connection gate, startConversation, sendMessage both directions, unread
 * counts, blocked-sender guard, unblock recovery, and disconnect stopping DMs.
 *   npx tsx --env-file=.env live-test-messaging.ts
 */
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { config } from './src/config';
import { UserModel } from './src/models/user.model';
import { sendConnectionRequest, respondToRequest } from './src/services/connection.service';
import { startConversation, sendMessage } from './src/services/messaging.service';
import * as messaging from './src/services/messaging.service';
import { blockUser, unblockUser } from './src/services/user-safety.service';

let checks = 0;
function ok(cond: boolean, label: string) {
  checks += 1;
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ FAIL: ${label}`); process.exitCode = 1; }
}
async function expectThrow(fn: () => Promise<unknown>, pattern: RegExp, label: string) {
  try {
    await fn();
    ok(false, `${label} (did not throw)`);
  } catch (err) {
    ok(pattern.test(err instanceof Error ? err.message : String(err)), `${label} — "${err instanceof Error ? err.message : err}"`);
  }
}

async function main() {
  await mongoose.connect(config.mongoUri);
  const suffix = randomUUID().slice(0, 6);
  const mk = async (tag: string) =>
    UserModel.create({
      email: `msg-${tag}-${suffix}@test.local`, fullName: `Msg ${tag}`, username: `msg${tag}${suffix}`,
      role: 'STUDENT', passwordHash: 'x', passwordSalt: 'x', emailVerified: true,
    });
  const alice = await mk('alice');
  const bob = await mk('bob');
  const aliceId = String(alice._id);
  const bobId = String(bob._id);

  console.log('A. Connection gate');
  await expectThrow(() => startConversation(aliceId, bobId), /connect/i, 'DM before connecting → rejected');
  await sendConnectionRequest(aliceId, bobId);
  await respondToRequest(bobId, aliceId, true);
  const convo = await startConversation(aliceId, bobId);
  ok(Boolean(convo.conversationId), 'conversation starts once connected');
  const convoId = convo.conversationId;

  console.log('B. Send + receive');
  const m1 = await sendMessage(aliceId, convoId, 'Hey Bob — testing GuildOS DMs!');
  ok(Boolean(m1), 'alice sends');
  const unreadAfterSend = await messaging.getUnreadMessageCount(bobId);
  ok(unreadAfterSend >= 1, `bob's unread count incremented (${unreadAfterSend})`);
  const m2 = await sendMessage(bobId, convoId, 'Loud and clear, Alice.');
  ok(Boolean(m2), 'bob replies');
  const thread = await messaging.getConversation(aliceId, convoId);
  ok(thread.messages.some((m) => m.content.includes('Loud and clear')), "alice sees bob's reply in the thread");
  const bobConvos = await messaging.listConversations(bobId);
  ok(bobConvos.some((c) => c.id === convoId), "thread appears in bob's conversation list");
  const unreadAfterRead = await messaging.getUnreadMessageCount(aliceId);
  ok(unreadAfterRead === 0, 'opening the thread clears unread');

  console.log('C. Blocking stops DMs');
  await blockUser(bobId, aliceId); // bob blocks alice
  await expectThrow(() => sendMessage(aliceId, convoId, 'can you still hear me?'), /no longer reachable|not found|blocked/i, 'blocked sender cannot message');
  await unblockUser(bobId, aliceId);
  const afterUnblock = await sendMessage(aliceId, convoId, 'we are back!');
  ok(Boolean(afterUnblock), 'unblock restores messaging');

  console.log('D. Disconnect stops PEER DMs');
  const { ConnectionModel } = await import('./src/models/connection.model');
  await ConnectionModel.deleteMany({ $or: [{ requesterId: alice._id }, { requesterId: bob._id }, { recipientId: alice._id }, { recipientId: bob._id }] });
  await expectThrow(() => sendMessage(aliceId, convoId, 'still there?'), /connect|not found|no longer/i, 'disconnected peers cannot keep messaging');

  // Cleanup
  const { ConversationModel } = await import('./src/models/conversation.model');
  const { MessageModel } = await import('./src/models/message.model');
  const { NotificationModel } = await import('./src/models/notification.model');
  await MessageModel.deleteMany({ conversationId: convoId });
  await ConversationModel.deleteOne({ _id: convoId });
  await NotificationModel.deleteMany({ userId: { $in: [alice._id, bob._id] } });
  await UserModel.deleteMany({ _id: { $in: [alice._id, bob._id] } });

  console.log(`\n${process.exitCode ? 'FAILED' : 'ALL PASS'} — ${checks} checks`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Test crashed:', err);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => undefined);
});
