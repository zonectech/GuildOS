import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { rejectCommunity, listPendingCommunities, verifyCommunity } from '../services/community.service';

export const adminCommunitiesRouter = Router();

adminCommunitiesRouter.get('/pending', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const communities = await listPendingCommunities();
    return res.json({ communities });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch pending communities' });
  }
});

adminCommunitiesRouter.patch('/:id/verify', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { notes } = req.body as { notes?: string };
    const community = await verifyCommunity(req.params.id, req.userId as string, notes ?? '');
    return res.json({ community });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify community';
    const status = message === 'Community not found' ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

adminCommunitiesRouter.patch('/:id/reject', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { notes } = req.body as { notes?: string };
    const community = await rejectCommunity(req.params.id, req.userId as string, notes ?? '');
    return res.json({ community });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reject community';
    const status = message === 'Community not found' ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});