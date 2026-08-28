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
    // Spam control: students can switch off unsolicited recruiter DMs entirely.
    const target = await UserModel.findById(otherId).select('profile.allowRecruiterMessages').lean();
    if (me?.role === 'RECRUITER' && target?.profile?.allowRecruiterMessages === false) {
      throw new Error('This student is not accepting recruiter messages');
    }
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

export async function sendMessage(userId: string, conversationId: string, content: string, replyToId?: string) {
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

  // Replies must point at a live message in the SAME conversation.
  let replyTo: mongoose.Types.ObjectId | null = null;
  let replySnapshot: { id: string; content: string; senderId: string } | null = null;
  if (replyToId && mongoose.Types.ObjectId.isValid(replyToId)) {
    const target = await MessageModel.findOne({ _id: replyToId, conversationId }).lean();
    if (target && !target.deletedAt) {
      replyTo = target._id;
      replySnapshot = { id: target._id.toString(), content: target.content.slice(0, 160), senderId: target.senderId.toString() };
    }
  }

  const message = await MessageModel.create({ conversationId, senderId: userId, content: clean.slice(0, 4000), replyTo });
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
      replyTo: replySnapshot,
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
    replyTo: replySnapshot,
  };
}

/**
 * Edit an own message. The previous content is APPENDED to `history` — nothing
 * is destroyed — but readers only ever see the newest version (+ an "edited" mark).
 */
export async function editMessage(userId: string, messageId: string, content: string) {
  const clean = (content ?? '').trim();
  if (!clean) throw new Error('Message is required');
  if (!mongoose.Types.ObjectId.isValid(messageId)) throw new Error('Message not found');
  const message = await MessageModel.findById(messageId);
  if (!message || message.deletedAt) throw new Error('Message not found');
  if (message.senderId.toString() !== userId) throw new Error('You can only edit your own messages');
  const conv = await ConversationModel.findById(message.conversationId);
  if (!conv || !isParticipant(conv, userId)) throw new Error('Message not found');

  message.history.push({ content: message.content, replacedAt: new Date() });
  message.content = clean.slice(0, 4000);
  message.editedAt = new Date();
  await message.save();

  // Keep the sidebar preview honest when the edited message is the latest one.
  const newest = await MessageModel.findOne({ conversationId: conv._id, deletedAt: null }).sort({ createdAt: -1 }).select('_id').lean();
  if (newest && newest._id.toString() === messageId) {
    conv.lastMessage = message.content.slice(0, 200);
    await conv.save();
  }

  const evt = {
    type: 'message:edit' as const,
    conversationId: conv._id.toString(),
    message: { id: messageId, content: message.content, editedAt: message.editedAt },
  };
  for (const p of conv.participants) emitToUser(p.toString(), evt);
  return { id: messageId, content: message.content, editedAt: message.editedAt };
}

/**
 * Soft-delete an own message: users see a "deleted" placeholder, but the content
 * (and its edit history) stays intact in the database.
 */
export async function deleteMessage(userId: string, messageId: string) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) throw new Error('Message not found');
  const message = await MessageModel.findById(messageId);
  if (!message || message.deletedAt) throw new Error('Message not found');
  if (message.senderId.toString() !== userId) throw new Error('You can only delete your own messages');
  const conv = await ConversationModel.findById(message.conversationId);
  if (!conv || !isParticipant(conv, userId)) throw new Error('Message not found');

  message.deletedAt = new Date();
  await message.save();

  // The sidebar preview may have been showing this message — recompute from the newest live one.
  const newest = await MessageModel.findOne({ conversationId: conv._id, deletedAt: null }).sort({ createdAt: -1 }).lean();
  conv.lastMessage = newest ? newest.content.slice(0, 200) : '';
  await conv.save();

  const evt = { type: 'message:delete' as const, conversationId: conv._id.toString(), messageId };
  for (const p of conv.participants) emitToUser(p.toString(), evt);
  return { id: messageId, deleted: true as const };
}

/**
 * "Delete for me": hides ANY message (yours or theirs) from the caller's view only.
 * The other person keeps seeing it — nothing changes in the shared record.
 */
export async function deleteMessageForMe(userId: string, messageId: string) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) throw new Error('Message not found');
  const message = await MessageModel.findById(messageId);
  if (!message) throw new Error('Message not found');
  const conv = await ConversationModel.findById(message.conversationId);
  if (!conv || !isParticipant(conv, userId)) throw new Error('Message not found');
  await MessageModel.updateOne({ _id: messageId }, { $addToSet: { hiddenFor: new mongoose.Types.ObjectId(userId) } });
  return { id: messageId, hidden: true as const };
}

export const DISAPPEAR_CHOICES_HOURS = [0, 24, 168] as const; // off / 24h / 7 days

/** Either participant can set (or clear) the conversation's disappearing-message window. */
export async function setDisappearingMessages(userId: string, conversationId: string, hours: number) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) throw new Error('Conversation not found');
  const conv = await ConversationModel.findById(conversationId);
  if (!conv || !isParticipant(conv, userId)) throw new Error('Conversation not found');
  if (!DISAPPEAR_CHOICES_HOURS.includes(hours as (typeof DISAPPEAR_CHOICES_HOURS)[number])) {
    throw new Error('Pick a valid disappearing-messages window');
  }
  conv.disappearAfterHours = hours;
  await conv.save();
  const evt = { type: 'conversation:settings' as const, conversationId, disappearAfterHours: hours };
  for (const p of conv.participants) emitToUser(p.toString(), evt);
  return { conversationId, disappearAfterHours: hours };
}

/**
 * Scheduler sweep: soft-delete messages older than their conversation's
 * disappearing window. Uses the same soft delete as manual deletion — the
 * record survives, users see the placeholder.
 */
export async function sweepDisappearingMessages() {
  const convs = await ConversationModel.find({ disappearAfterHours: { $gt: 0 } }).select('_id disappearAfterHours').lean();
  let swept = 0;
  for (const conv of convs) {
    const cutoff = new Date(Date.now() - conv.disappearAfterHours * 3600_000);
    const result = await MessageModel.updateMany(
      { conversationId: conv._id, deletedAt: null, createdAt: { $lt: cutoff } },
      { $set: { deletedAt: new Date() } },
    );
    swept += result.modifiedCount ?? 0;
  }
  return { swept };
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
  const byId = new Map(rows.map((m) => [m._id.toString(), m]));
  const messages = rows
    .reverse()
    // "Deleted for me" rows vanish from this viewer's thread entirely.
    .filter((m) => !(m.hiddenFor ?? []).some((id) => id.toString() === userId))
    .map((m) => {
      const target = m.replyTo ? byId.get(m.replyTo.toString()) : null;
      return {
        id: m._id.toString(),
        senderId: m.senderId.toString(),
        // Deleted messages keep their slot but never their words.
        content: m.deletedAt ? '' : m.content,
        createdAt: m.createdAt,
        mine: m.senderId.toString() === userId,
        deleted: Boolean(m.deletedAt),
        edited: Boolean(m.editedAt),
        replyTo: target
          ? { id: target._id.toString(), content: target.deletedAt ? '' : target.content.slice(0, 160), senderId: target.senderId.toString(), deleted: Boolean(target.deletedAt) }
          : null,
      };
    });
  const other = await personBrief(otherId);
  // Drives the Block/Unblock menu + the disabled composer in the thread view.
  const blockedByMe = await hasBlocked(userId, otherId);
  return { id: conversationId, other, messages, blockedByMe, disappearAfterHours: conv.disappearAfterHours ?? 0 };
}

export async function getUnreadMessageCount(userId: string) {
  const convs = await ConversationModel.find({ participants: userId }).select('unread').lean();
  return convs.reduce((sum, c) => sum + unreadFor(c, userId), 0);
}

/**
 * Full-text-ish search across the caller's conversations. Deleted and
 * "hidden for me" messages never surface. Returns newest hits first with
 * enough context (other person + snippet) to render a result row.
 */
export async function searchMessages(userId: string, query: string, limit = 20) {
  const q = query.trim();
  if (q.length < 2) return [];
  const convs = await ConversationModel.find({ participants: userId }).select('_id participants').lean();
  if (!convs.length) return [];
  const otherByConv = new Map(
    convs.map((c) => [c._id.toString(), c.participants.map((p) => p.toString()).find((id) => id !== userId) ?? userId]),
  );
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const rows = await MessageModel.find({
    conversationId: { $in: convs.map((c) => c._id) },
    deletedAt: null,
    hiddenFor: { $ne: new mongoose.Types.ObjectId(userId) },
    content: rx,
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 50))
    .lean();

  const briefCache = new Map<string, Awaited<ReturnType<typeof personBrief>>>();
  return Promise.all(
    rows.map(async (m) => {
      const convId = m.conversationId.toString();
      const otherId = otherByConv.get(convId) ?? userId;
      if (!briefCache.has(otherId)) briefCache.set(otherId, await personBrief(otherId));
      // Trim long messages to a window around the first hit so the row stays readable.
      const idx = m.content.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, idx - 40);
      const snippet = (start > 0 ? '…' : '') + m.content.slice(start, start + 140) + (m.content.length > start + 140 ? '…' : '');
      return {
        messageId: m._id.toString(),
        conversationId: convId,
        snippet,
        mine: m.senderId.toString() === userId,
        createdAt: m.createdAt,
        other: briefCache.get(otherId)!,
      };
    }),
  );
}
