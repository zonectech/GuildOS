import { Router } from 'express';
import { optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { authStore } from '../store/auth-store';
import { chatWithAssistant, type AssistantMessage, type AssistantMode } from '../services/assistant.service';

export const assistantRouter = Router();

assistantRouter.post('/chat', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = req.body as { messages?: AssistantMessage[]; mode?: AssistantMode };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      return res.status(400).json({ error: 'A message is required' });
    }

    const mode: AssistantMode = body.mode === 'leader' ? 'leader' : 'student';

    let name: string | undefined;
    if (req.userId) {
      const user = await authStore.getPublicUserById(req.userId).catch(() => null);
      name = user?.fullName;
    }

    const result = await chatWithAssistant(messages, { name, mode, userId: req.userId });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Assistant unavailable' });
  }
});
