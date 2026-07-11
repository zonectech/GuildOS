import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import {
  dismissWatchAlert,
  getWatchtower,
  getWatchtowerSummary,
  reopenWatchAlert,
  runWatchAction,
  snoozeWatchAlert,
  type WatchAction,
} from '../services/watchtower.service';

export const adminWatchtowerRouter = Router();

adminWatchtowerRouter.use(requireAuth, requireRole('ADMIN'));

adminWatchtowerRouter.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const includeResolved = req.query.includeResolved === 'true';
    const result = await getWatchtower({ includeResolved });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load watchtower' });
  }
});

adminWatchtowerRouter.get('/summary', async (_req: AuthenticatedRequest, res) => {
  try {
    return res.json({ summary: await getWatchtowerSummary() });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load summary' });
  }
});

adminWatchtowerRouter.post('/:alertKey/dismiss', async (req: AuthenticatedRequest, res) => {
  try {
    const { note = '' } = req.body as { note?: string };
    return res.json(await dismissWatchAlert(req.params.alertKey, req.userId as string, note));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to dismiss alert' });
  }
});

adminWatchtowerRouter.post('/:alertKey/snooze', async (req: AuthenticatedRequest, res) => {
  try {
    const { days } = req.body as { days?: number };
    return res.json(await snoozeWatchAlert(req.params.alertKey, req.userId as string, Number(days) || 7));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to snooze alert' });
  }
});

adminWatchtowerRouter.post('/:alertKey/reopen', async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await reopenWatchAlert(req.params.alertKey));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to reopen alert' });
  }
});

adminWatchtowerRouter.post('/action', async (req: AuthenticatedRequest, res) => {
  try {
    const { action, entityId, alertKey, notes } = req.body as {
      action?: WatchAction;
      entityId?: string;
      alertKey?: string;
      notes?: string;
    };
    if (!action || !entityId) {
      return res.status(400).json({ error: 'action and entityId are required' });
    }
    const result = await runWatchAction({ actorId: req.userId as string, action, entityId, alertKey, notes });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to run action' });
  }
});
