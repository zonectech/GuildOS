import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { listRecruiterVerificationRequests, reviewRecruiterVerification } from '../services/recruiter.service';

export const adminRecruitersRouter = Router();

adminRecruitersRouter.get('/pending', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const recruiters = await listRecruiterVerificationRequests();
    return res.json({ recruiters });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load pending recruiters' });
  }
});

adminRecruitersRouter.patch('/:userId/verify', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { note } = req.body as { note?: string };
    const result = await reviewRecruiterVerification(req.params.userId, req.userId as string, true, note ?? '');
    return res.json({ recruiter: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify recruiter';
    return res.status(message === 'Recruiter profile not found' ? 404 : 400).json({ error: message });
  }
});

adminRecruitersRouter.patch('/:userId/reject', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { note } = req.body as { note?: string };
    const result = await reviewRecruiterVerification(req.params.userId, req.userId as string, false, note ?? '');
    return res.json({ recruiter: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reject recruiter';
    return res.status(message === 'Recruiter profile not found' ? 404 : 400).json({ error: message });
  }
});
