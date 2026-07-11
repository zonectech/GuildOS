import mongoose from 'mongoose';
import { NotificationModel, type NotificationType } from '../models/notification.model';
import { UserModel } from '../models/user.model';
import { authStore } from '../store/auth-store';
import { emitToUser } from '../realtime';
import { config } from '../config';
import { sendEmail, categoryEmail, type EmailCategory } from '../utils/email';

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
    emitToUser(userId, { type: 'notification', notificationType: input.type });
  } catch (error) {
    console.warn('[GuildOS] notification create failed', error instanceof Error ? error.message : error);
  }
}

function buildGroupedTitle(actorName: string, total: number, label: string) {
  if (total <= 1) return `${actorName} ${label}`;
  const others = total - 1;
  return `${actorName} and ${others} other${others > 1 ? 's' : ''} ${label}`;
}

/**
 * Adds an actor to a grouped notification (e.g. Twitter-style "X and N others liked
 * your post"). Reuses a single notification per groupKey, keeping the most recent
 * actor first, and resurfaces it to the top as unread.
 */
export async function pushGroupedNotificationActor(input: {
  userId: string;
  actorId: string;
  actorName: string;
  type: NotificationType;
  groupKey: string;
  label: string;
  body?: string;
  link?: string;
}) {
  try {
    const { userId, actorId, groupKey } = input;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;
    if (!actorId || !mongoose.Types.ObjectId.isValid(actorId)) return;
    if (actorId === userId) return;
    const actorObjId = new mongoose.Types.ObjectId(actorId);
    const existing = await NotificationModel.findOne({ userId, groupKey, type: input.type });
    if (existing) {
      const others = (existing.actorIds ?? []).filter((id) => id.toString() !== actorId);
      existing.actorIds = [actorObjId, ...others].slice(0, 50);
      existing.actorId = actorObjId;
      existing.title = buildGroupedTitle(input.actorName, existing.actorIds.length, input.label);
      if (input.body !== undefined) existing.body = input.body;
      if (input.link !== undefined) existing.link = input.link;
      existing.read = false;
      existing.createdAt = new Date();
      await existing.save();
    } else {
      await NotificationModel.create({
        userId,
        actorId: actorObjId,
        actorIds: [actorObjId],
        groupKey,
        type: input.type,
        title: buildGroupedTitle(input.actorName, 1, input.label),
        body: input.body ?? '',
        link: input.link ?? '',
      });
    }
  } catch (error) {
    console.warn('[GuildOS] grouped notification push failed', error instanceof Error ? error.message : error);
  }
}

/**
 * Removes an actor from a grouped notification (e.g. when a like is undone).
 * Deletes the notification entirely once no actors remain.
 */
export async function removeGroupedNotificationActor(input: {
  userId: string;
  actorId: string;
  type: NotificationType;
  groupKey: string;
  label: string;
}) {
  try {
    const { userId, actorId, groupKey } = input;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;
    if (!actorId || !mongoose.Types.ObjectId.isValid(actorId)) return;
    const existing = await NotificationModel.findOne({ userId, groupKey, type: input.type });
    if (!existing) return;
    const remaining = (existing.actorIds ?? []).filter((id) => id.toString() !== actorId);
    if (!remaining.length) {
      await existing.deleteOne();
      return;
    }
    existing.actorIds = remaining;
    existing.actorId = remaining[0];
    const latest = await authStore.getPublicUserById(remaining[0].toString()).catch(() => null);
    existing.title = buildGroupedTitle(latest?.fullName ?? 'Someone', remaining.length, input.label);
    await existing.save();
  } catch (error) {
    console.warn('[GuildOS] grouped notification remove failed', error instanceof Error ? error.message : error);
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
  const actorIds = [
    ...new Set(
      rows.flatMap((r) => {
        const ids = (r.actorIds ?? []).map((id) => id.toString());
        if (r.actorId) ids.push(r.actorId.toString());
        return ids;
      }),
    ),
  ];
  const actors = await Promise.all(actorIds.map((id) => authStore.getPublicUserById(id).catch(() => null)));
  const actorById = new Map(
    actors
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => [a.id, { id: a.id, fullName: a.fullName, avatar: normalizeAvatar(a.profile?.avatar), username: a.profile?.username ?? '' }]),
  );
  const notifications = rows.map((r) => {
    const groupedIds = (r.actorIds ?? []).map((id) => id.toString());
    const orderedIds = groupedIds.length ? groupedIds : r.actorId ? [r.actorId.toString()] : [];
    const groupedActors = orderedIds.map((id) => actorById.get(id)).filter((a): a is NonNullable<typeof a> => Boolean(a));
    return {
      id: r._id.toString(),
      type: r.type,
      title: r.title,
      body: r.body,
      link: r.link,
      read: r.read,
      createdAt: r.createdAt,
      actor: r.actorId ? actorById.get(r.actorId.toString()) ?? null : groupedActors[0] ?? null,
      actors: groupedActors,
    };
  });
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

/**
 * Admin broadcast: sends a SYSTEM notification to every active user (optionally
 * filtered by role). Returns how many recipients were notified.
 */
export async function broadcastSystemNotification(input: {
  actorId: string;
  title: string;
  body?: string;
  link?: string;
  role?: string;
}) {
  const title = (input.title ?? '').trim();
  if (!title) throw new Error('A title is required');

  const filter: Record<string, unknown> = { status: { $ne: 'BLOCKED' }, deletedAt: null };
  if (input.role && ['STUDENT', 'COMMUNITY_LEADER', 'RECRUITER', 'ADMIN'].includes(input.role)) {
    filter.role = input.role;
  }

  const users = await UserModel.find(filter).select('_id').lean();
  const docs = users
    .filter((u) => u._id.toString() !== input.actorId)
    .map((u) => ({
      userId: u._id,
      actorId: null,
      type: 'SYSTEM' as NotificationType,
      title: title.slice(0, 140),
      body: (input.body ?? '').slice(0, 300),
      link: (input.link ?? '').slice(0, 200),
      read: false,
    }));

  if (docs.length) {
    await NotificationModel.insertMany(docs, { ordered: false }).catch(() => undefined);
  }
  return { count: docs.length };
}

const VALID_ROLES = ['STUDENT', 'COMMUNITY_LEADER', 'RECRUITER', 'ADMIN'];
const NOTIF_PREFIX: Record<EmailCategory, string> = { INFO: '', CONGRATS: '🎉 ', WARNING: '⚠️ ', CONFIRMATION: '✅ ' };

function absoluteLink(link: string): string {
  const l = (link ?? '').trim();
  if (!l) return '';
  if (/^https?:\/\//i.test(l)) return l;
  return `${config.frontendUrl.replace(/\/+$/, '')}/${l.replace(/^\/+/, '')}`;
}

/**
 * Admin messaging: send a categorised message (info / congrats / warning / confirmation)
 * to everyone, a role, or one specific user — via in-app notification and/or branded email.
 * Both channels dispatch instantly. Returns how many were notified/emailed.
 */
export async function sendAdminMessage(input: {
  actorId: string;
  category?: EmailCategory;
  title: string;
  body?: string;
  link?: string;
  channels?: { notification?: boolean; email?: boolean };
  target?: { scope?: 'ALL' | 'ROLE' | 'USER'; role?: string; userId?: string; email?: string };
}) {
  const title = (input.title ?? '').trim();
  if (!title) throw new Error('A title is required');

  const category: EmailCategory = input.category && ['INFO', 'CONGRATS', 'WARNING', 'CONFIRMATION'].includes(input.category) ? input.category : 'INFO';
  const wantNotification = input.channels?.notification ?? true;
  const wantEmail = input.channels?.email ?? false;
  if (!wantNotification && !wantEmail) throw new Error('Choose at least one channel: notification or email');

  const target = input.target ?? { scope: 'ALL' };
  const scope = target.scope ?? 'ALL';

  // Resolve recipients (id + email + name), excluding blocked/deleted and the actor.
  type Recipient = { _id: mongoose.Types.ObjectId; email: string; fullName: string };
  let recipients: Recipient[];
  if (scope === 'USER') {
    const email = (target.email ?? '').trim().toLowerCase();
    const query = target.userId && mongoose.Types.ObjectId.isValid(target.userId) ? { _id: target.userId } : email ? { email } : null;
    if (!query) throw new Error('Provide a user email or id');
    const user = await UserModel.findOne(query).select('_id email fullName').lean();
    if (!user) throw new Error('User not found');
    recipients = [user as unknown as Recipient];
  } else {
    const filter: Record<string, unknown> = { status: { $ne: 'BLOCKED' }, deletedAt: null };
    if (scope === 'ROLE' && target.role && VALID_ROLES.includes(target.role)) filter.role = target.role;
    recipients = (await UserModel.find(filter).select('_id email fullName').lean()) as unknown as Recipient[];
  }
  recipients = recipients.filter((u) => u._id.toString() !== input.actorId);

  let notified = 0;
  let emailed = 0;

  if (wantNotification && recipients.length) {
    const notifTitle = `${NOTIF_PREFIX[category]}${title}`.slice(0, 140);
    const docs = recipients.map((u) => ({
      userId: u._id,
      actorId: null,
      type: 'SYSTEM' as NotificationType,
      title: notifTitle,
      body: (input.body ?? '').slice(0, 300),
      link: (input.link ?? '').slice(0, 200),
      read: false,
    }));
    await NotificationModel.insertMany(docs, { ordered: false }).catch(() => undefined);
    notified = docs.length;
    for (const u of recipients) emitToUser(u._id.toString(), { type: 'notification', notificationType: 'SYSTEM' });
  }

  if (wantEmail) {
    const cta = input.link ? { ctaLabel: 'Open GuildOS', ctaUrl: absoluteLink(input.link) } : {};
    const withEmail = recipients.filter((u) => u.email);
    const results = await Promise.allSettled(
      withEmail.map((u) =>
        sendEmail(u.email, categoryEmail(category, { name: u.fullName, subject: title, message: input.body || title, ...cta })),
      ),
    );
    emailed = results.filter((r) => r.status === 'fulfilled').length;
  }

  return { notified, emailed, recipients: recipients.length };
}
