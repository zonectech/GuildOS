import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { authStore } from '../store/auth-store';
import type { UserRole } from '../types';

export const adminUsersRouter = Router();

const ROLES: UserRole[] = ['STUDENT', 'COMMUNITY_LEADER', 'RECRUITER', 'ADMIN'];

adminUsersRouter.get('/', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const users = await authStore.searchUsersForAdmin(search);
    return res.json({ users });
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
    return res.json({ user: authStore.toPublicUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to update role' });
  }
});
