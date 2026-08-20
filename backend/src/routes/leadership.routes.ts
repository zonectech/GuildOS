import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { buildDomainActivityRecord } from '../services/domain-activity.service';

export const leadershipRouter = Router();

leadershipRouter.post('/', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, title = 'Leadership Role', description = 'Leadership history record' } = req.body as {
      userId?: string;
      title?: string;
      description?: string;
    };

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const record = await buildDomainActivityRecord(userId, 'LEADERSHIP', title, description);
    if (!record) {
      return res.status(404).json({ error: 'Unable to build leadership record' });
    }

    return res.status(201).json({ leadership: record });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to create leadership record' });
  }
});
