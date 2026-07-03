import mongoose from 'mongoose';
import { NotificationModel, type NotificationType } from '../models/notification.model';
import { authStore } from '../store/auth-store';

function normalizeAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http') || avatar.startsWith('/')) return avatar;
  return `/uploads/${avatar}`;
}

/**
 * Creates a notification. No-ops when the recipient is the actor (don't notify yourself)
 * or when the recipient id is missing/invalid. Never throws into the caller's flow.
 */
export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  actorId?: string | null;
  body?: string;
  link?: string;
}) {
  try {
    const { userId, actorId } = input;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;
    if (actorId && actorId === userId) return;
    await NotificationModel.create({
      userId,
      actorId: actorId && mongoose.Types.ObjectId.isValid(actorId) ? actorId : null,
      type: input.type,
      title: input.title,
      body: input.body ?? '',
      link: input.link ?? '',
    });
  } catch (error) {
    console.warn('[GuildOS] notification create failed', error instanceof Error ? error.message : error);
  }
}

export async function listNotifications(userId: string, options: { limit?: number; before?: string } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const query: Record<string, unknown> = { userId };
  if (options.before) {
    const beforeDate = new Date(options.before);
    if (!Number.isNaN(beforeDate.getTime())) query.createdAt = { $lt: beforeDate };
  }
  const rows = await NotificationModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  const actorIds = [...new Set(rows.filter((r) => r.actorId).map((r) => r.actorId!.toString()))];
  const actors = await Promise.all(actorIds.map((id) => authStore.getPublicUserById(id).catch(() => null)));
  const actorById = new Map(
    actors
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => [a.id, { id: a.id, fullName: a.fullName, avatar: normalizeAvatar(a.profile?.avatar), username: a.profile?.username ?? '' }]),
  );
  const notifications = rows.map((r) => ({
    id: r._id.toString(),
    type: r.type,
    title: r.title,
    body: r.body,
    link: r.link,
    read: r.read,
    createdAt: r.createdAt,
    actor: r.actorId ? actorById.get(r.actorId.toString()) ?? null : null,
  }));
  return { notifications, nextCursor: notifications.length === limit ? notifications[notifications.length - 1].createdAt : null };
}

export async function getUnreadCount(userId: string) {
  return NotificationModel.countDocuments({ userId, read: false });
}

export async function markRead(userId: string, id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await NotificationModel.updateOne({ _id: id, userId }, { $set: { read: true } });
}

export async function markAllRead(userId: string) {
  await NotificationModel.updateMany({ userId, read: false }, { $set: { read: true } });
}
