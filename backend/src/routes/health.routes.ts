import { Router } from 'express';
import { activeAiProvider } from '../services/ai-provider';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'backend',
    security: 'enabled',
    // Which AI provider is active (or null if no key is set). Handy for confirming a switch.
    ai: activeAiProvider(),
  });
});
