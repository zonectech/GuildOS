import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { seedDemoData } from '../services/demo-seed.service';

export const adminSeedRouter = Router();

adminSeedRouter.post('/demo', requireAuth, requireRole('ADMIN'), async (_req: AuthenticatedRequest, res) => {
  try {
    const summary = await seedDemoData();
    return res.json({ summary });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to seed demo data' });
  }
});
