import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import {
  getMyCommunityAccess,
  listPendingCommunityAccess,
  requestCommunityAccess,
  sendSchoolEmailCode,
  setCommunityAccess,
  verifySchoolEmailCode,
} from '../services/community-access.service';

export const communityAccessRouter = Router();

communityAccessRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await getMyCommunityAccess(req.userId as string);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load access status' });
  }
});

communityAccessRouter.post('/email/send', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { email } = req.body as { email?: string };
    const result = await sendSchoolEmailCode(req.userId as string, email ?? '');
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to send code' });
  }
});

communityAccessRouter.post('/email/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { code } = req.body as { code?: string };
    const result = await verifySchoolEmailCode(req.userId as string, code ?? '');
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to verify code' });
  }
});

communityAccessRouter.post('/request', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { note } = req.body as { note?: string };
    const result = await requestCommunityAccess(req.userId as string, note ?? '');
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to request access' });
  }
});

// Admin
export const adminCommunityAccessRouter = Router();

adminCommunityAccessRouter.get('/pending', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const requests = await listPendingCommunityAccess();
    return res.json({ requests });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load requests' });
  }
});

adminCommunityAccessRouter.patch('/:userId/approve', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { note } = req.body as { note?: string };
    const result = await setCommunityAccess(req.userId as string, req.params.userId, true, note ?? '');
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to approve';
    return res.status(message === 'User not found' ? 404 : 400).json({ error: message });
  }
});

adminCommunityAccessRouter.patch('/:userId/reject', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { note } = req.body as { note?: string };
    const result = await setCommunityAccess(req.userId as string, req.params.userId, false, note ?? '');
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reject';
    return res.status(message === 'User not found' ? 404 : 400).json({ error: message });
  }
});
