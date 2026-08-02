import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { aiLimiter } from '../middleware/rate-limit';
import { deleteCv, generateCv, getCvForOwner, listMyCvs, verifyCv } from '../services/cv.service';

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
