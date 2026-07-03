import { Router } from 'express';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { authStore } from '../store/auth-store';
import {
  getLeaderboard,
  getReputation,
  getReputationActivity,
  getReputationProfileSummary,
  recalculateReputation,
  type LeaderboardScope,
} from '../services/reputation.service';
import { getReputationInsights } from '../services/reputation-insights.service';

export const reputationRouter = Router();

reputationRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reputation = await getReputation(req.userId as string);
    return res.json({ reputation });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load reputation' });
  }
});

reputationRouter.get('/insights', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await getReputationInsights(req.userId as string);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load insights' });
  }
});

reputationRouter.get('/leaderboard', async (req, res) => {
  try {
    const scope = (String(req.query.scope ?? 'GLOBAL').toUpperCase()) as LeaderboardScope;
    const leaderboard = await getLeaderboard({
      scope,
      university: req.query.university ? String(req.query.university) : undefined,
      faculty: req.query.faculty ? String(req.query.faculty) : undefined,
      department: req.query.department ? String(req.query.department) : undefined,
      communityId: req.query.communityId ? String(req.query.communityId) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json({ leaderboard });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load leaderboard' });
  }
});

reputationRouter.get('/activity', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const activity = await getReputationActivity(req.userId as string, req.query.limit ? Number(req.query.limit) : 50);
    return res.json({ activity });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load activity' });
  }
});

reputationRouter.post('/recalculate', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Admins may recalculate any user; students may only recalculate themselves.
    const targetUserId = req.body?.userId && req.user?.role === 'ADMIN' ? String(req.body.userId) : (req.userId as string);
    await recalculateReputation(targetUserId);
    const reputation = await getReputation(targetUserId);
    return res.json({ reputation });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to recalculate reputation' });
  }
});

reputationRouter.get('/:userId', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const target = await authStore.getPublicUserById(req.params.userId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    const isOwner = req.userId === target.id;
    const isAdmin = req.user?.role === 'ADMIN';
    if (target.profile.profileVisibility === 'PRIVATE' && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'This reputation profile is private' });
    }
    const reputation = await getReputation(target.id);
    return res.json({
      reputation,
      user: { id: target.id, fullName: target.fullName, username: target.profile.username, avatar: target.profile.avatar },
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load reputation' });
  }
});

reputationRouter.get('/:userId/summary', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const target = await authStore.getPublicUserById(req.params.userId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    const isOwner = req.userId === target.id;
    const isAdmin = req.user?.role === 'ADMIN';
    if (target.profile.profileVisibility === 'PRIVATE' && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'This reputation profile is private' });
    }
    const summary = await getReputationProfileSummary(target.id);
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load reputation summary' });
  }
});

reputationRouter.get('/:userId/timeline', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const target = await authStore.getPublicUserById(req.params.userId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    const isOwner = req.userId === target.id;
    const isAdmin = req.user?.role === 'ADMIN';
    if (target.profile.profileVisibility === 'PRIVATE' && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'This profile is private' });
    }
    if (target.profile.showTimeline === false && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'This timeline is hidden' });
    }
    const activity = await getReputationActivity(target.id, req.query.limit ? Number(req.query.limit) : 30);
    return res.json({ activity });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load timeline' });
  }
});
