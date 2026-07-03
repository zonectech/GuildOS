import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { assignRoleByMembership, updateMembershipStatus } from '../services/community.service';

export const membershipsRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/permission|rank|founder|manage a member|assign a role|ownership transfer/i.test(message)) return 403;
  return 400;
}

membershipsRouter.patch('/:membershipId/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { status } = req.body as { status?: string };
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const result = await updateMembershipStatus(req.params.membershipId, status, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update membership status';
    return res.status(statusFor(message)).json({ error: message });
  }
});

membershipsRouter.post('/:membershipId/roles', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { role } = req.body as { role?: string };
    if (!role) {
      return res.status(400).json({ error: 'role is required' });
    }

    const membership = await assignRoleByMembership(req.params.membershipId, role, req.userId as string);
    return res.status(201).json({ membership });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to assign role';
    return res.status(statusFor(message)).json({ error: message });
  }
});
