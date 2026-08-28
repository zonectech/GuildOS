import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { messageSendLimiter } from '../middleware/rate-limit';
import { blockUser, unblockUser, reportUser } from '../services/user-safety.service';
import {
  deleteMessage,
  deleteMessageForMe,
  editMessage,
  getConversation,
  getUnreadMessageCount,
  listConversations,
  searchMessages,
  sendMessage,
  setDisappearingMessages,
  startConversation,
} from '../services/messaging.service';
import { getLinkPreview } from '../services/link-preview.service';

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

// OpenGraph preview for external links shared in chats/posts (SSRF-guarded server-side).
// MUST stay above GET /:conversationId or 'link-preview' gets captured as an id.
messageRouter.get('/link-preview', requireAuth, messageSendLimiter, async (req: AuthenticatedRequest, res) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  if (!url) return res.status(400).json({ error: 'A url is required' });
  const preview = await getLinkPreview(url);
  return res.json({ preview });
});

// Search the caller's own messages (also must stay above /:conversationId).
messageRouter.get('/search', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = await searchMessages(req.userId as string, q);
    return res.json({ results });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to search messages' });
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
    const { content, replyTo } = req.body as { content?: string; replyTo?: string };
    const message = await sendMessage(req.userId as string, req.params.conversationId, content ?? '', typeof replyTo === 'string' ? replyTo : undefined);
    return res.status(201).json({ message });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send message';
    return res.status(statusFor(message)).json({ error: message });
  }
});

messageRouter.patch('/single/:messageId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { content } = req.body as { content?: string };
    const message = await editMessage(req.userId as string, req.params.messageId, content ?? '');
    return res.json({ message });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to edit message';
    return res.status(statusFor(message)).json({ error: message });
  }
});

messageRouter.delete('/single/:messageId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // ?scope=me hides it from the caller only; default deletes for everyone (own messages).
    const scope = req.query.scope === 'me' ? 'me' : 'everyone';
    const result =
      scope === 'me'
        ? await deleteMessageForMe(req.userId as string, req.params.messageId)
        : await deleteMessage(req.userId as string, req.params.messageId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete message';
    return res.status(statusFor(message)).json({ error: message });
  }
});

messageRouter.patch('/:conversationId/settings', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { disappearAfterHours } = req.body as { disappearAfterHours?: number };
    const result = await setDisappearingMessages(req.userId as string, req.params.conversationId, Number(disappearAfterHours ?? 0));
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update settings';
    return res.status(statusFor(message)).json({ error: message });
  }
});
