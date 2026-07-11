import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { getInactiveEntities } from '../services/admin-inactive.service';

export const adminInactiveRouter = Router();

adminInactiveRouter.get('/', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const entities = await getInactiveEntities();
    return res.json(entities);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load inactive items' });
  }
});
