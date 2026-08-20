import { Router } from 'express';
import { optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { unifiedSearch } from '../services/search.service';

export const searchRouter = Router();

// Global search across people, communities, events, opportunities and knowledge.
// Auth is optional: signed-in viewers get opportunity match scores; everyone
// only ever sees public-visibility results.
searchRouter.get('/', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = await unifiedSearch(q, req.userId ?? null);
    return res.json(results);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Search failed' });
  }
});
