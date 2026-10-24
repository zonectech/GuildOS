import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { seedDemoData } from '../services/demo-seed.service';
import { config } from '../config';

export const adminSeedRouter = Router();

adminSeedRouter.post('/demo', requireAuth, requireRole('ADMIN'), async (_req: AuthenticatedRequest, res) => {
  // Demo data is made-up people and companies with a shared password; it never belongs on the live site.
  // Only local databases qualify, so it stays off even if NODE_ENV is missing on the server.
  const localDb = /\/\/(localhost|127\.0\.0\.1)[:/]/.test(process.env.MONGODB_URI ?? '');
  if (process.env.ALLOW_DEMO_SEED !== 'true' && (config.isProduction || !localDb)) {
    return res.status(403).json({ error: 'Demo data is turned off on the live site.' });
  }
  try {
    const summary = await seedDemoData();
    return res.json({ summary });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to seed demo data' });
  }
});
