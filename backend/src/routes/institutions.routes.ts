import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { createInstitution, listInstitutions, updateInstitution } from '../services/institution.service';
import { recordAdminAction } from '../services/admin-audit.service';

export const institutionsRouter = Router();
export const adminInstitutionsRouter = Router();

institutionsRouter.get('/', async (_req, res) => {
  try {
    const institutions = await listInstitutions();
    return res.json({ institutions });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to list institutions' });
  }
});

adminInstitutionsRouter.post('/', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const institution = await createInstitution({
      name: req.body.name,
      aliases: req.body.aliases,
      emailDomains: req.body.emailDomains,
      country: req.body.country,
      adminId: req.userId as string,
    });
    await recordAdminAction({ adminId: req.userId as string, action: 'INSTITUTION_CREATE', targetType: 'INSTITUTION', targetId: institution._id.toString(), note: institution.name });
    return res.status(201).json({ institution });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create institution' });
  }
});

adminInstitutionsRouter.patch('/:id', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const institution = await updateInstitution(req.params.id, req.body);
    await recordAdminAction({ adminId: req.userId as string, action: 'INSTITUTION_UPDATE', targetType: 'INSTITUTION', targetId: institution._id.toString(), note: institution.name });
    return res.json({ institution });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update institution';
    return res.status(message === 'Institution not found' ? 404 : 400).json({ error: message });
  }
});