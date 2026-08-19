import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { getPlatformAnalytics } from '../services/analytics.service';
import { getLoginTrafficSummary } from '../services/login-traffic.service';

export const adminAnalyticsRouter = Router();

adminAnalyticsRouter.get('/overview', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const months = req.query.months ? Math.min(Math.max(Number(req.query.months), 3), 12) : 8;
    const analytics = await getPlatformAnalytics(Number.isFinite(months) ? months : 8);
    return res.json({ analytics });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load analytics' });
  }
});

adminAnalyticsRouter.get('/login-traffic', requireAuth, requireRole('ADMIN'), async (_req: AuthenticatedRequest, res) => {
  try {
    const summary = await getLoginTrafficSummary();
    return res.json({ summary });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load login traffic' });
  }
});
