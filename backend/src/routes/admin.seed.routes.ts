import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { seedDemoData } from '../services/demo-seed.service';

export const adminSeedRouter = Router();

adminSeedRouter.post('/demo', requireAuth, requireRole('ADMIN'), async (_req: AuthenticatedRequest, res) => {
  // Demo data is made-up people and companies; it never belongs on the live site. Only a database on
  // this machine qualifies, with no override (the same rule as npm run demo and the seed scripts).
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env.MONGODB_URI ?? '')) {
    return res.status(403).json({ error: 'Demo data is turned off on the live site.' });
  }
  try {
    const summary = await seedDemoData();
    return res.json({ summary });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to seed demo data' });
  }
});
