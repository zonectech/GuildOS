import type { NextFunction, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from './auth';
import { canRequestCommunity, hasApprovedCommunityAccess } from '../services/community-access-policy';

/** Authenticate first, then recheck current approval before uploads, AI calls or organizer operations. */
export async function requireCommunityAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    return await requireAuth(req, res, async () => {
      try {
        if (!req.userId || !await hasApprovedCommunityAccess(req.userId)) return res.status(403).json({ error: 'Community Mode approval and verified account email are required', code: 'COMMUNITY_ACCESS_REQUIRED' });
        return next();
      } catch (error) { return next(error); }
    });
  } catch (error) { return next(error); }
}

/** For sending a community for review: a verified account is enough, because that review is the approval. */
export async function requireCommunityRequester(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    return await requireAuth(req, res, async () => {
      try {
        if (!req.userId || !await canRequestCommunity(req.userId)) return res.status(403).json({ error: 'Verify your account email before creating a community' });
        return next();
      } catch (error) { return next(error); }
    });
  } catch (error) { return next(error); }
}
