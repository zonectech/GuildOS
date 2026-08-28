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

  console.log('C. Reply / edit / delete');
  const replyMsg = await sendMessage(bobId, convoId, 'Replying to your first message', m1.id);
  ok(replyMsg.replyTo?.id === m1.id, 'reply carries the quoted message reference');
  const editRes = await messaging.editMessage(aliceId, m1.id, 'Hey Bob — edited version!');
  ok(editRes.content === 'Hey Bob — edited version!', 'edit returns the new content');
  const { MessageModel } = await import('./src/models/message.model');
  const editedDoc = await MessageModel.findById(m1.id).lean();
  ok(editedDoc?.history.length === 1 && editedDoc.history[0].content.includes('testing GuildOS DMs'), 'original content preserved in history');
  await expectThrow(() => messaging.editMessage(bobId, m1.id, 'hijack!'), /own messages/i, "can't edit someone else's message");
  await messaging.deleteMessage(aliceId, m1.id);
  const deletedDoc = await MessageModel.findById(m1.id).lean();
  ok(Boolean(deletedDoc?.deletedAt) && deletedDoc!.content.length > 0, 'soft delete keeps the content in the DB');
  const threadAfter = await messaging.getConversation(bobId, convoId);
  const deletedRow = threadAfter.messages.find((m) => m.id === m1.id);
  ok(deletedRow?.deleted === true && deletedRow.content === '', 'readers see a placeholder, never the words');
  await expectThrow(() => messaging.deleteMessage(aliceId, replyMsg.id), /own messages|not found/i, "can't delete someone else's message");

  console.log('E. Settings: delete-for-me / disappearing / recruiter gate');
  const m3 = await sendMessage(bobId, convoId, 'only bob will lose sight of this');
  await messaging.deleteMessageForMe(bobId, m3.id);
  const bobView = await messaging.getConversation(bobId, convoId);
  const aliceView = await messaging.getConversation(aliceId, convoId);
  ok(!bobView.messages.some((m) => m.id === m3.id), 'delete-for-me hides it from the deleter');
  ok(aliceView.messages.some((m) => m.id === m3.id && !m.deleted), 'the other person still sees it untouched');

  await messaging.setDisappearingMessages(aliceId, convoId, 24);
  const withSetting = await messaging.getConversation(aliceId, convoId);
  ok(withSetting.disappearAfterHours === 24, 'disappearing window saved (24h)');
  await expectThrow(() => messaging.setDisappearingMessages(aliceId, convoId, 5), /valid disappearing/i, 'arbitrary windows rejected');
  // Backdate a message past the window and sweep.
  const { MessageModel: MM } = await import('./src/models/message.model');
  await MM.updateOne({ _id: m3.id }, { $set: { createdAt: new Date(Date.now() - 25 * 3600_000) } });
  const sweep = await messaging.sweepDisappearingMessages();
  ok(sweep.swept >= 1, `sweep soft-deleted expired messages (${sweep.swept})`);
  const sweptDoc = await MM.findById(m3.id).lean();
  ok(Boolean(sweptDoc?.deletedAt) && sweptDoc!.content.length > 0, 'disappeared message still intact in the DB');
  await messaging.setDisappearingMessages(aliceId, convoId, 0);

  const recruiter = await UserModel.create({
    email: `msg-rec-${suffix}@test.local`, fullName: 'Msg Recruiter', username: `msgrec${suffix}`,
    role: 'RECRUITER', passwordHash: 'x', passwordSalt: 'x', emailVerified: true,
  });
  await UserModel.updateOne({ _id: bob._id }, { $set: { 'profile.allowRecruiterMessages': false } });
  await expectThrow(() => startConversation(String(recruiter._id), bobId), /not accepting recruiter/i, 'recruiter blocked when student opted out');
  await UserModel.updateOne({ _id: bob._id }, { $set: { 'profile.allowRecruiterMessages': true } });
  const recConvo = await startConversation(String(recruiter._id), bobId);
  ok(Boolean(recConvo.conversationId), 'recruiter can DM once allowed');

  console.log('F. Blocking stops DMs');
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
  const { NotificationModel } = await import('./src/models/notification.model');
  const recruiterUser = await UserModel.findOne({ email: `msg-rec-${suffix}@test.local` }).select('_id').lean();
  const allIds = [alice._id, bob._id, ...(recruiterUser ? [recruiterUser._id] : [])];
  const convos = await ConversationModel.find({ participants: { $in: allIds } }).select('_id').lean();
  await MessageModel.deleteMany({ conversationId: { $in: convos.map((c) => c._id) } });
  await ConversationModel.deleteMany({ _id: { $in: convos.map((c) => c._id) } });
  await NotificationModel.deleteMany({ userId: { $in: allIds } });
  await UserModel.deleteMany({ _id: { $in: allIds } });

  console.log(`\n${process.exitCode ? 'FAILED' : 'ALL PASS'} — ${checks} checks`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Test crashed:', err);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => undefined);
});
