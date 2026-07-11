import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { listAdminAudit } from '../services/admin-audit.service';

export const adminAuditRouter = Router();

adminAuditRouter.get('/', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const result = await listAdminAudit({ page: Number.isFinite(page) ? page : 1 });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load audit log' });
  }
});
