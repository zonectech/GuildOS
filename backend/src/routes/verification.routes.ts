import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { getVerificationCenter } from '../services/profile-view.service';

export const verificationRouter = Router();

verificationRouter.get('/center', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const data = await getVerificationCenter(req.userId as string);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load verification center' });
  }
});
