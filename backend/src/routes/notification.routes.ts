import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { getUnreadCount, listNotifications, markAllRead, markRead } from '../services/notification.service';
import { getVapidPublicKey, isPushConfigured, removePushSubscription, savePushSubscription } from '../services/push.service';

export const notificationRouter = Router();

// --- Web push (PWA device notifications) ---
notificationRouter.get('/push/public-key', (_req, res) => {
  return res.json({ enabled: isPushConfigured(), publicKey: getVapidPublicKey() });
});

notificationRouter.post('/push/subscribe', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!isPushConfigured()) return res.status(503).json({ error: 'Push notifications are not configured' });
    await savePushSubscription(req.userId as string, req.body?.subscription, String(req.headers['user-agent'] ?? ''));
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save subscription' });
  }
});

notificationRouter.post('/push/unsubscribe', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await removePushSubscription(req.userId as string, String(req.body?.endpoint ?? ''));
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to remove subscription' });
  }
});

notificationRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await listNotifications(req.userId as string, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      before: req.query.before ? String(req.query.before) : undefined,
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load notifications' });
  }
});

notificationRouter.get('/unread-count', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const count = await getUnreadCount(req.userId as string);
    return res.json({ count });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load count' });
  }
});

notificationRouter.post('/read-all', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await markAllRead(req.userId as string);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to update notifications' });
  }
});

notificationRouter.post('/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await markRead(req.userId as string, req.params.id);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to update notification' });
  }
});
