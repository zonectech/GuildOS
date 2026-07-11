import { AdminAuditModel } from '../models/admin-audit.model';
import { authStore } from '../store/auth-store';

/**
 * Records an administrator action for the audit trail. Never throws into the
 * caller's flow — auditing must not break the operation it records.
 */
export async function recordAdminAction(input: {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  note?: string;
}) {
  try {
    await AdminAuditModel.create({
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType ?? '',
      targetId: input.targetId ?? '',
      note: (input.note ?? '').slice(0, 500),
    });
  } catch (error) {
    console.warn('[GuildOS] admin audit failed', error instanceof Error ? error.message : error);
  }
}

export async function listAdminAudit(options: { page?: number; limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    AdminAuditModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AdminAuditModel.countDocuments(),
  ]);

  const adminIds = [...new Set(rows.map((r) => r.adminId.toString()))];
  const admins = await Promise.all(adminIds.map((id) => authStore.getPublicUserById(id).catch(() => null)));
  const nameById = new Map(admins.filter(Boolean).map((a) => [a!.id, a!.fullName]));

  const entries = rows.map((r) => ({
    id: r._id.toString(),
    admin: nameById.get(r.adminId.toString()) ?? 'Unknown admin',
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    note: r.note,
    createdAt: r.createdAt,
  }));

  return { entries, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
