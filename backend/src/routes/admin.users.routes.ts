import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { authStore } from '../store/auth-store';
import { recordAdminAction } from '../services/admin-audit.service';
import type { UserRole } from '../types';

export const adminUsersRouter = Router();

const ROLES: UserRole[] = ['STUDENT', 'COMMUNITY_LEADER', 'RECRUITER', 'ADMIN'];

adminUsersRouter.get('/', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const page = req.query.page ? Number(req.query.page) : 1;
    const result = await authStore.searchUsersForAdmin(search, { page: Number.isFinite(page) ? page : 1 });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load users' });
  }
});

adminUsersRouter.patch('/:userId/role', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { role } = req.body as { role?: string };
    if (!role || !ROLES.includes(role as UserRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (req.params.userId === req.userId && role !== 'ADMIN') {
      return res.status(400).json({ error: 'You cannot remove your own admin role' });
    }
    const user = await authStore.setUserRole(req.params.userId, role as UserRole);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await recordAdminAction({ adminId: req.userId as string, action: 'USER_ROLE', targetType: 'USER', targetId: req.params.userId, note: role });
    return res.json({ user: authStore.toPublicUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to update role' });
  }
});

adminUsersRouter.patch('/:userId/block', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    if (req.params.userId === req.userId) {
      return res.status(400).json({ error: 'You cannot block your own account' });
    }
    const { reason } = req.body as { reason?: string };
    const user = await authStore.setUserBlocked(req.params.userId, true, (reason ?? '').trim());
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await recordAdminAction({ adminId: req.userId as string, action: 'USER_BLOCK', targetType: 'USER', targetId: req.params.userId, note: reason ?? '' });
    return res.json({ user: authStore.toPublicUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to block user' });
  }
});

adminUsersRouter.patch('/:userId/unblock', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await authStore.setUserBlocked(req.params.userId, false);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await recordAdminAction({ adminId: req.userId as string, action: 'USER_UNBLOCK', targetType: 'USER', targetId: req.params.userId });
    return res.json({ user: authStore.toPublicUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to unblock user' });
  }
});

adminUsersRouter.delete('/:userId', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    if (req.params.userId === req.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const user = await authStore.setUserDeleted(req.params.userId, true);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await recordAdminAction({ adminId: req.userId as string, action: 'USER_DELETE', targetType: 'USER', targetId: req.params.userId });
    return res.json({ user: authStore.toPublicUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to delete user' });
  }
});

adminUsersRouter.patch('/:userId/restore', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await authStore.setUserDeleted(req.params.userId, false);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await recordAdminAction({ adminId: req.userId as string, action: 'USER_RESTORE', targetType: 'USER', targetId: req.params.userId });
    return res.json({ user: authStore.toPublicUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to restore user' });
  }
});
