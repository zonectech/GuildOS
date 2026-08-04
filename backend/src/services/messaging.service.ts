import mongoose from 'mongoose';
import { ConversationModel, conversationPairKey } from '../models/conversation.model';
import { MessageModel } from '../models/message.model';
import { UserModel } from '../models/user.model';
import { authStore } from '../store/auth-store';
import { createNotification } from './notification.service';
import { getConnectionState } from './connection.service';
import { isBlockedBetween, hasBlocked } from './user-safety.service';
import { emitToUser } from '../realtime';

function normalizeAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http') || avatar.startsWith('/')) return avatar;
  return `/uploads/${avatar}`;
}

async function personBrief(userId: string) {
  const u = await authStore.getPublicUserById(userId).catch(() => null);
  return {
    id: userId,
    fullName: u?.fullName ?? 'User',
    username: u?.profile?.username ?? '',
    avatar: normalizeAvatar(u?.profile?.avatar),
    headline: [u?.profile?.department, u?.profile?.university].filter(Boolean).join(' · '),
  };
}

function unreadFor(conv: { unread: Map<string, number> | Record<string, number> }, userId: string): number {
  const u = conv.unread as unknown;
  if (u instanceof Map) return u.get(userId) ?? 0;
  return (u as Record<string, number>)?.[userId] ?? 0;
}

/**
 * Opens (or returns) a conversation. Allowed when:
 * - the initiator is a RECRUITER/ADMIN (they may message any candidate), or
 * - the two users are connected (mutual, ACCEPTED).
 */
export async function startConversation(userId: string, otherId: string) {
  if (!mongoose.Types.ObjectId.isValid(otherId)) throw new Error('User not found');
  if (userId === otherId) throw new Error('You cannot message yourself');

  const [me, other] = await Promise.all([
    UserModel.findById(userId).select('role status').lean(),
    UserModel.findById(otherId).select('_id status deletedAt').lean(),
  ]);
  // Blocked/deleted accounts can neither be messaged nor start conversations.
  if (!other || other.deletedAt || other.status === 'BLOCKED') throw new Error('User not found');
  if (me?.status === 'BLOCKED') throw new Error('Your account is restricted');
  // A user-level block (either direction) severs contact — same opaque error as a
  // missing account so the blocked person can't probe who blocked them.
  if (await isBlockedBetween(userId, otherId)) throw new Error('User not found');

  const isRecruiter = me?.role === 'RECRUITER' || me?.role === 'ADMIN';
  let kind: 'RECRUITER' | 'PEER' = 'PEER';
  if (isRecruiter) {
    kind = 'RECRUITER';
  } else {
    const state = await getConnectionState(userId, otherId);
    if (state !== 'CONNECTED') throw new Error('You can only message your connections');
  }

  const pairKey = conversationPairKey(userId, otherId);
  const conversation = await ConversationModel.findOneAndUpdate(
    { pairKey },
    {
      $setOnInsert: {
        pairKey,
        participants: [new mongoose.Types.ObjectId(userId), new mongoose.Types.ObjectId(otherId)],
        kind,
        unread: {},
      },
    },
    { new: true, upsert: true },
  );
  return { conversationId: conversation._id.toString() };
}

function isParticipant(conv: { participants: mongoose.Types.ObjectId[] }, userId: string) {
  return conv.participants.some((p) => p.toString() === userId);
}

export async function sendMessage(userId: string, conversationId: string, content: string) {
  const clean = (content ?? '').trim();
  if (!clean) throw new Error('Message is required');
  if (!mongoose.Types.ObjectId.isValid(conversationId)) throw new Error('Conversation not found');
  const conv = await ConversationModel.findById(conversationId);
  if (!conv || !isParticipant(conv, userId)) throw new Error('Conversation not found');

  const otherId = conv.participants.map((p) => p.toString()).find((id) => id !== userId) as string;

  // Sending re-checks account standing every time — an existing thread must not
  // outlive a block, a deletion, or (for peers) a removed connection.
  const [me, other] = await Promise.all([
    UserModel.findById(userId).select('role status').lean(),
    UserModel.findById(otherId).select('status deletedAt').lean(),
  ]);
  if (me?.status === 'BLOCKED') throw new Error('Your account is restricted');
  if (!other || other.deletedAt || other.status === 'BLOCKED') throw new Error('This person is no longer reachable');
  if (await isBlockedBetween(userId, otherId)) throw new Error('This person is no longer reachable');
  if (conv.kind === 'PEER' && me?.role !== 'RECRUITER' && me?.role !== 'ADMIN') {
    const state = await getConnectionState(userId, otherId);
    if (state !== 'CONNECTED') throw new Error('You can only message your connections');
  }

  const message = await MessageModel.create({ conversationId, senderId: userId, content: clean.slice(0, 4000) });
  conv.lastMessage = clean.slice(0, 200);
  conv.lastMessageAt = new Date();
  conv.unread.set(otherId, (conv.unread.get(otherId) ?? 0) + 1);
  await conv.save();

  const actor = await authStore.getPublicUserById(userId).catch(() => null);
  await createNotification({
    userId: otherId,
    actorId: userId,
    type: 'MESSAGE',
    title: `New message from ${actor?.fullName ?? 'someone'}`,
    body: clean.slice(0, 100),
    link: '/messages',
  });

  const realtimeEvent = {
    type: 'message' as const,
    conversationId,
    message: {
      id: message._id.toString(),
      senderId: userId,
      content: message.content,
      createdAt: message.createdAt,
    },
    actor: {
      id: userId,
      fullName: actor?.fullName ?? 'Someone',
      username: actor?.profile?.username ?? '',
      avatar: normalizeAvatar(actor?.profile?.avatar),
    },
  };
  // Push to the recipient (notify + live update) and the sender (multi-device sync).
  emitToUser(otherId, realtimeEvent);
  emitToUser(userId, realtimeEvent);

  return {
    id: message._id.toString(),
    conversationId,
    senderId: userId,
    content: message.content,
    createdAt: message.createdAt,
  };
}

export async function listConversations(userId: string) {
  const convs = await ConversationModel.find({ participants: userId })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(100)
    .lean();
  return Promise.all(
    convs.map(async (c) => {
      const otherId = c.participants.map((p) => p.toString()).find((id) => id !== userId) ?? userId;
      const other = await personBrief(otherId);
      return {
        id: c._id.toString(),
        other,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        unread: unreadFor(c, userId),
        kind: c.kind,
      };
    }),
  );
}

export async function getConversation(userId: string, conversationId: string, limit = 50) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) throw new Error('Conversation not found');
  const conv = await ConversationModel.findById(conversationId);
  if (!conv || !isParticipant(conv, userId)) throw new Error('Conversation not found');

  const otherId = conv.participants.map((p) => p.toString()).find((id) => id !== userId) as string;

  // Mark this user's side as read.
  if ((conv.unread.get(userId) ?? 0) > 0) {
    conv.unread.set(userId, 0);
    await conv.save();
  }

  const rows = await MessageModel.find({ conversationId }).sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 100)).lean();
  const messages = rows
    .reverse()
    .map((m) => ({ id: m._id.toString(), senderId: m.senderId.toString(), content: m.content, createdAt: m.createdAt, mine: m.senderId.toString() === userId }));
  const other = await personBrief(otherId);
  // Drives the Block/Unblock menu + the disabled composer in the thread view.
  const blockedByMe = await hasBlocked(userId, otherId);
  return { id: conversationId, other, messages, blockedByMe };
}

export async function getUnreadMessageCount(userId: string) {
  const convs = await ConversationModel.find({ participants: userId }).select('unread').lean();
  return convs.reduce((sum, c) => sum + unreadFor(c, userId), 0);
}
