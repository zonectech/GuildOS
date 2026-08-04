import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { messageSendLimiter } from '../middleware/rate-limit';
import { blockUser, unblockUser, reportUser } from '../services/user-safety.service';
import {
  getConversation,
  getUnreadMessageCount,
  listConversations,
  sendMessage,
  startConversation,
} from '../services/messaging.service';

export const messageRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/only.*message|only recruiters|yourself|connections/i.test(message)) return 403;
  return 400;
}

// Recruiters/admins can message any candidate; students can message their connections.
messageRouter.post('/start', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { candidateId, userId } = req.body as { candidateId?: string; userId?: string };
    const target = candidateId ?? userId;
    if (!target) return res.status(400).json({ error: 'A target user id is required' });
    const result = await startConversation(req.userId as string, target);
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start conversation';
    return res.status(statusFor(message)).json({ error: message });
  }
});

messageRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const conversations = await listConversations(req.userId as string);
    return res.json({ conversations });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load conversations' });
  }
});

messageRouter.get('/unread-count', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const count = await getUnreadMessageCount(req.userId as string);
    return res.json({ count });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load count' });
  }
});

// Block/unblock a user (severs messages + connection requests both ways; silent to them).
messageRouter.post('/block/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await blockUser(req.userId as string, req.params.userId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to block user';
    return res.status(statusFor(message)).json({ error: message });
  }
});

messageRouter.delete('/block/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await unblockUser(req.userId as string, req.params.userId));
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to unblock user' });
  }
});

// Report a user to the platform admins (reason required; admins act from the users console).
messageRouter.post('/report/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reason = typeof (req.body as { reason?: unknown })?.reason === 'string' ? (req.body as { reason: string }).reason : '';
    return res.json(await reportUser(req.userId as string, req.params.userId, reason));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to report user';
    return res.status(statusFor(message)).json({ error: message });
  }
});

messageRouter.get('/:conversationId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const conversation = await getConversation(req.userId as string, req.params.conversationId);
    return res.json({ conversation });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load conversation';
    return res.status(statusFor(message)).json({ error: message });
  }
});

messageRouter.post('/:conversationId', requireAuth, messageSendLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const { content } = req.body as { content?: string };
    const message = await sendMessage(req.userId as string, req.params.conversationId, content ?? '');
    return res.status(201).json({ message });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send message';
    return res.status(statusFor(message)).json({ error: message });
  }
});
