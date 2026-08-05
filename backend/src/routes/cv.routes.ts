import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { aiLimiter } from '../middleware/rate-limit';
import {
  deleteCv,
  generateCv,
  getCvForOwner,
  listCvProjects,
  listMyCvs,
  saveCvProjects,
  updateCvCustomization,
  verifyCv,
} from '../services/cv.service';

export const cvRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/permission|private/i.test(message)) return 403;
  return 400;
}

cvRouter.post('/generate', requireAuth, aiLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await generateCv(req.userId as string, req.body ?? {});
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate CV';
    return res.status(statusFor(message)).json({ error: message });
  }
});

cvRouter.get('/my-cvs', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const cvs = await listMyCvs(req.userId as string);
    return res.json({ cvs });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load CVs' });
  }
});

// Persistent projects collection — registered before /:cvId so "projects" is never treated as an id.
cvRouter.get('/projects', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const projects = await listCvProjects(req.userId as string);
    return res.json({ projects });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load projects' });
  }
});

cvRouter.put('/projects', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await saveCvProjects(req.userId as string, req.body?.projects ?? []);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save projects' });
  }
});

cvRouter.get('/verify/:verificationId', async (req, res) => {
  try {
    const cv = await verifyCv(req.params.verificationId);
    return res.json({ cv });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify CV';
    return res.status(statusFor(message)).json({ error: message });
  }
});

cvRouter.get('/:cvId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const cv = await getCvForOwner(req.params.cvId, req.userId as string);
    return res.json({ cv });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load CV';
    return res.status(statusFor(message)).json({ error: message });
  }
});

cvRouter.delete('/:cvId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await deleteCv(req.params.cvId, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete CV';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Drag-to-reorder sections + hide flags on an existing CV.
cvRouter.patch('/:cvId/customization', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await updateCvCustomization(req.params.cvId, req.userId as string, req.body ?? {});
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update CV';
    return res.status(statusFor(message)).json({ error: message });
  }
});
