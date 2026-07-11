import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { sendAdminMessage } from '../services/notification.service';
import { recordAdminAction } from '../services/admin-audit.service';

export const adminBroadcastRouter = Router();

adminBroadcastRouter.post('/', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { title, body, link, role, category, channels, target } = req.body as {
      title?: string;
      body?: string;
      link?: string;
      role?: string; // legacy field — treated as a ROLE/ALL target
      category?: 'INFO' | 'CONGRATS' | 'WARNING' | 'CONFIRMATION';
      channels?: { notification?: boolean; email?: boolean };
      target?: { scope?: 'ALL' | 'ROLE' | 'USER'; role?: string; userId?: string; email?: string };
    };

    const resolvedTarget = target ?? (role ? { scope: 'ROLE' as const, role } : { scope: 'ALL' as const });

    const result = await sendAdminMessage({
      actorId: req.userId as string,
      title: title ?? '',
      body,
      link,
      category,
      channels,
      target: resolvedTarget,
    });

    const scopeLabel =
      resolvedTarget.scope === 'USER'
        ? `user ${resolvedTarget.email ?? resolvedTarget.userId ?? ''}`
        : resolvedTarget.scope === 'ROLE'
          ? `role ${resolvedTarget.role}`
          : 'everyone';
    await recordAdminAction({
      adminId: req.userId as string,
      action: 'BROADCAST',
      targetType: 'NOTIFICATION',
      note: `${category ?? 'INFO'} → ${scopeLabel} · ${result.notified} notified, ${result.emailed} emailed: ${(title ?? '').slice(0, 60)}`,
    });
    return res.json({ ...result, count: result.notified });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to send message' });
  }
});
