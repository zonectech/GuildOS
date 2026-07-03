import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authStore } from '../store/auth-store';
import { buildPublicPortfolioData } from '../services/profile-propagation.service';

export const portfolioRouter = Router();

portfolioRouter.get('/:username', async (req: AuthenticatedRequest, res) => {
  try {
    const { username } = req.params;
    const user = await authStore.getUserByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const requesterRole = req.user?.role;
    const isOwner = req.userId && user.id === req.userId;

    if (user.profile.profileVisibility === 'PRIVATE' && !isOwner && requesterRole !== 'ADMIN') {
      return res.status(403).json({ error: 'This portfolio is private' });
    }

    const portfolio = await buildPublicPortfolioData(user.id);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    if (requesterRole === 'ADMIN' || isOwner) {
      return res.json({ portfolio, user: authStore.toPublicUser(user) });
    }

    if (!portfolio.visible) {
      return res.status(403).json({ error: 'This portfolio is not public' });
    }

    return res.json({ portfolio });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load portfolio' });
  }
});
