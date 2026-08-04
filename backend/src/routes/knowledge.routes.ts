import { Router } from 'express';
import multer from 'multer';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rate-limit';
import { putUpload } from '../services/storage.service';
import {
  listCommunityKnowledge,
  getKnowledgeResource,
  createKnowledgeResource,
  createKnowledgeStarterPack,
  updateKnowledgeResource,
  deleteKnowledgeResource,
  searchKnowledge,
  trackKnowledgeDownload,
} from '../services/knowledge.service';

export const knowledgeRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/permission|private/i.test(message)) return 403;
  return 400;
}

// Knowledge attachments accept documents as well as images (unlike media uploads).
// MIME type controls the stored extension so filenames can never smuggle scripts.
const KNOWLEDGE_MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const knowledgeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!KNOWLEDGE_MIME_EXTENSIONS[file.mimetype]) {
      return cb(new Error('Invalid file type. Only PDF, JPG, PNG, and WEBP are allowed.'));
    }
    cb(null, true);
  },
});

knowledgeRouter.post('/upload', requireAuth, uploadLimiter, knowledgeUpload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'A file is required' });
    }
    const ext = KNOWLEDGE_MIME_EXTENSIONS[req.file.mimetype] ?? '.bin';
    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    await putUpload(key, req.file.buffer, req.file.mimetype);
    return res.json({ file: `/uploads/${key}`, fileName: req.file.originalname?.slice(0, 140) ?? '' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to upload file' });
  }
});

// Global knowledge search (public communities only). Registered before /:id.
knowledgeRouter.get('/search', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = await searchKnowledge(q);
    return res.json({ results });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Search failed' });
  }
});

knowledgeRouter.get('/community/:communityId', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const resources = await listCommunityKnowledge(req.params.communityId, req.userId);
    return res.json({ resources });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load Knowledge Hub';
    return res.status(statusFor(message)).json({ error: message });
  }
});

knowledgeRouter.post('/community/:communityId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const resource = await createKnowledgeResource(req.params.communityId, req.userId as string, req.body ?? {});
    return res.status(201).json({ resource });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to publish resource';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Starter pack: pre-drafted editable articles for an EMPTY hub (category-aware; COORDINATOR+).
knowledgeRouter.post('/community/:communityId/starter-pack', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await createKnowledgeStarterPack(req.params.communityId, req.userId as string);
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create starter pack';
    return res.status(statusFor(message)).json({ error: message });
  }
});

knowledgeRouter.get('/:id', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const resource = await getKnowledgeResource(req.params.id, req.userId);
    return res.json({ resource });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load resource';
    return res.status(statusFor(message)).json({ error: message });
  }
});

knowledgeRouter.post('/:id/download', async (req, res) => {
  try {
    return res.json(await trackKnowledgeDownload(req.params.id));
  } catch {
    return res.json({ tracked: false });
  }
});

knowledgeRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const resource = await updateKnowledgeResource(req.params.id, req.userId as string, req.body ?? {});
    return res.json({ resource });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update resource';
    return res.status(statusFor(message)).json({ error: message });
  }
});

knowledgeRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await deleteKnowledgeResource(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete resource';
    return res.status(statusFor(message)).json({ error: message });
  }
});
