import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { messageSendLimiter } from '../middleware/rate-limit';
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
