import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { listFollowedCommunityIds, toggleFollow, unfollowCommunity } from '../services/follow.service';

export const followRouter = Router();

followRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const communityIds = await listFollowedCommunityIds(req.userId as string);
    return res.json({ communityIds });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load follows' });
  }
});

followRouter.post('/:communityId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await toggleFollow(req.userId as string, req.params.communityId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to follow community';
    return res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
  }
});

followRouter.delete('/:communityId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await unfollowCommunity(req.userId as string, req.params.communityId);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to unfollow community' });
  }
});
