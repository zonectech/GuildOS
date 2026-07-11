import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { listContentReports, moderatePost, moderateComment } from '../services/admin-moderation.service';
import { recordAdminAction } from '../services/admin-audit.service';

export const adminContentRouter = Router();

adminContentRouter.get('/reports', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const result = await listContentReports();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load reports' });
  }
});

adminContentRouter.post('/post/:id/:action', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const action = req.params.action === 'remove' ? 'REMOVE' : req.params.action === 'dismiss' ? 'DISMISS' : null;
    if (!action) return res.status(400).json({ error: 'Invalid action' });
    const { note } = req.body as { note?: string };
    const result = await moderatePost(req.params.id, action, note ?? '');
    await recordAdminAction({ adminId: req.userId as string, action: `POST_${action}`, targetType: 'POST', targetId: req.params.id, note: note ?? '' });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to moderate post';
    return res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
  }
});

adminContentRouter.post('/comment/:id/:action', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const action = req.params.action === 'remove' ? 'REMOVE' : req.params.action === 'dismiss' ? 'DISMISS' : null;
    if (!action) return res.status(400).json({ error: 'Invalid action' });
    const result = await moderateComment(req.params.id, action);
    await recordAdminAction({ adminId: req.userId as string, action: `COMMENT_${action}`, targetType: 'COMMENT', targetId: req.params.id });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to moderate comment';
    return res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
  }
});
