import mongoose from 'mongoose';
import { UserBlockModel } from '../models/user-block.model';
import { UserModel } from '../models/user.model';
import { NotificationModel } from '../models/notification.model';
import { createNotification } from './notification.service';
import { authStore } from '../store/auth-store';

/**
 * User-to-user blocking + reporting for the chat surface.
 * - A block severs contact BOTH ways (messages + connection requests) and is
 *   deliberately silent — the blocked person is never told, their sends just
 *   fail with the same "no longer reachable" error a deleted account produces.
 * - A report bells every platform admin with the reason; admins act from
 *   /dashboard/admin/users (platform-wide account blocking already exists there).
 */

export async function blockUser(blockerId: string, targetId: string) {
  if (!mongoose.Types.ObjectId.isValid(targetId)) throw new Error('User not found');
  if (blockerId === targetId) throw new Error('You cannot block yourself');
  const target = await UserModel.findById(targetId).select('_id').lean();
  if (!target) throw new Error('User not found');
  await UserBlockModel.updateOne(
    { blockerId, blockedId: targetId },
    { $setOnInsert: { blockerId, blockedId: targetId, createdAt: new Date() } },
    { upsert: true },
  );
  return { blocked: true };
}

export async function unblockUser(blockerId: string, targetId: string) {
  await UserBlockModel.deleteOne({ blockerId, blockedId: targetId });
  return { blocked: false };
}

/** True when EITHER side has blocked the other — contact is severed both ways. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const row = await UserBlockModel.findOne({
    $or: [
      { blockerId: a, blockedId: b },
      { blockerId: b, blockedId: a },
    ],
  })
    .select('_id')
    .lean();
  return Boolean(row);
}

/** Whether THIS viewer has blocked the other person (drives the Unblock UI). */
export async function hasBlocked(blockerId: string, targetId: string): Promise<boolean> {
  const row = await UserBlockModel.findOne({ blockerId, blockedId: targetId }).select('_id').lean();
  return Boolean(row);
}

/**
 * Report a user to the platform admins (from chat or a profile). Every admin
 * gets a bell linking to the admin users console; deduped per reporter/target/day
 * so one angry evening can't flood the admin bell.
 */
export async function reportUser(reporterId: string, targetId: string, reason: string) {
  if (!mongoose.Types.ObjectId.isValid(targetId)) throw new Error('User not found');
  if (reporterId === targetId) throw new Error('You cannot report yourself');
  const cleanReason = String(reason ?? '').trim().slice(0, 300);
  if (!cleanReason) throw new Error('A reason is required');

  const [target, reporter] = await Promise.all([
    authStore.getPublicUserById(targetId).catch(() => null),
    authStore.getPublicUserById(reporterId).catch(() => null),
  ]);
  if (!target) throw new Error('User not found');

  const admins = await UserModel.find({ role: 'ADMIN', status: 'ACTIVE', deletedAt: null }).select('_id').lean();
  const title = `User report: ${target.fullName}`;
  // Dedupe: this reporter already reported this person today → don't re-bell every admin.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const already = await NotificationModel.findOne({
    title,
    body: { $regex: `^${(reporter?.fullName ?? 'A user').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: ` },
    createdAt: { $gte: dayAgo },
  })
    .select('_id')
    .lean();
  if (!already) {
    for (const admin of admins) {
      void createNotification({
        userId: admin._id.toString(),
        type: 'SYSTEM',
        title,
        body: `${reporter?.fullName ?? 'A user'}: ${cleanReason}`,
        link: '/dashboard/admin/users',
      });
    }
  }
  return { reported: true };
}
