import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { endLeadershipRole, updateLeadershipRole } from '../services/community.service';

export const rolesRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/permission|rank|founder/i.test(message)) return 403;
  return 400;
}

rolesRouter.patch('/:roleId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { endDate, verificationStatus } = req.body as {
      endDate?: string | null;
      verificationStatus?: 'PENDING' | 'VERIFIED';
    };

    const role = await updateLeadershipRole(req.params.roleId, req.userId as string, { endDate, verificationStatus });
    return res.json({ role });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update leadership role';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Leadership history is never hard-deleted; DELETE archives the record by ending it.
rolesRouter.delete('/:roleId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const role = await endLeadershipRole(req.params.roleId, req.userId as string);
    return res.json({ role, message: 'Leadership role archived' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to archive leadership role';
    return res.status(statusFor(message)).json({ error: message });
  }
});
