import { UserModel } from '../models/user.model';
import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { getUnreadCount, listNotifications, markAllRead, markRead } from '../services/notification.service';
import { getVapidPublicKey, isPushConfigured, removePushSubscription, savePushSubscription } from '../services/push.service';
import { validRecommendationToken } from '../utils/recommendation-token';

export const notificationRouter = Router();

// A GET only confirms intent: mail security scanners must not unsubscribe people.
notificationRouter.get('/recommendations/unsubscribe', (req, res) => {
  const id=String(req.query.id ?? ''), token=String(req.query.token ?? '');
  res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer');
  if(!validRecommendationToken(id,token)) return res.status(400).send('This unsubscribe link is invalid. Change email preferences in your account.');
  return res.type('html').send(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Email preferences</title><body style="font:16px/1.6 Arial,sans-serif;background:#F6F7F3;color:#173D38;padding:24px;"><main style="max-width:480px;margin:48px auto;background:white;padding:28px;border-radius:16px;"><h1>Pause recommendations?</h1><p>You’ll stop receiving event and community recommendations. Your booking and account emails will continue.</p><form method="post"><button type="submit" style="background:#173D38;color:white;border:0;border-radius:8px;padding:15px 20px;font:inherit;">Unsubscribe from recommendations</button></form></main></body></html>`);
});
// Also supports the List-Unsubscribe one-click POST; signed query values scope it to this preference only.
notificationRouter.post('/recommendations/unsubscribe', async (req,res) => {
  const id=String(req.query.id ?? ''), token=String(req.query.token ?? '');
  res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer');
  if(!validRecommendationToken(id,token)) return res.status(400).send('Invalid unsubscribe link');
  try {
    await UserModel.updateOne({_id:id},{$set:{recommendationEmailEnabled:false}});
    return res.type('html').send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribed</title><body style="font:16px/1.6 Arial,sans-serif;padding:32px;color:#173D38;"><h1>You’re unsubscribed</h1><p>Event and community recommendations are off. You can turn them back on in Notification settings.</p></body></html>');
  } catch {return res.status(503).send('Unable to update your preference. Please try again.');}
});

notificationRouter.get('/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await UserModel.findById(req.userId).select('newEventEmailEnabled recommendationEmailEnabled').lean();
    if (!user) return res.status(404).json({ error: 'Account not found' });
    return res.json({ newEventEmailEnabled: user.newEventEmailEnabled !== false, recommendationEmailEnabled: user.recommendationEmailEnabled === true });
  } catch { return res.status(500).json({ error: 'Unable to load notification preferences' }); }
});
notificationRouter.patch('/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
  const fields=['newEventEmailEnabled','recommendationEmailEnabled'] as const;
  const updates: Record<string,boolean>={};
  for(const field of fields) if(req.body?.[field] !== undefined) {
    if(typeof req.body[field] !== 'boolean') return res.status(400).json({error:'Email preferences must be true or false'});
    updates[field]=req.body[field];
  }
  if(!Object.keys(updates).length) return res.status(400).json({error:'Choose an email preference'});
  try {
    const user = await UserModel.findByIdAndUpdate(req.userId, { $set: updates }, { new: true }).select('newEventEmailEnabled recommendationEmailEnabled').lean();
    if (!user) return res.status(404).json({ error: 'Account not found' });
    return res.json({ newEventEmailEnabled: user.newEventEmailEnabled !== false, recommendationEmailEnabled: user.recommendationEmailEnabled === true });
  } catch { return res.status(500).json({ error: 'Unable to save notification preferences' }); }
});

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
    const found = await markRead(req.userId as string, req.params.id);
    if (!found) return res.status(404).json({ error: 'Notification not found' });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to update notification' });
  }
});
