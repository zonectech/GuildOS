import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { adminArchiveEvent } from '../services/event.service';
import { recordAdminAction } from '../services/admin-audit.service';

export const adminEventsRouter = Router();

adminEventsRouter.post('/:id/takedown', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { note } = req.body as { note?: string };
    const event = await adminArchiveEvent(req.params.id);
    await recordAdminAction({ adminId: req.userId as string, action: 'EVENT_TAKEDOWN', targetType: 'EVENT', targetId: req.params.id, note: note ?? '' });
    return res.json({ event: { id: event._id.toString(), status: event.status } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to take down event';
    return res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
  }
});
