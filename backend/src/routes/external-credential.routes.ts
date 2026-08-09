import { Router } from 'express';
import multer from 'multer';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rate-limit';
import { putUpload } from '../services/storage.service';
import { authStore } from '../store/auth-store';
import {
  listMyCredentials,
  listCredentialsForUser,
  createCredential,
  updateCredential,
  deleteCredential,
} from '../services/external-credential.service';

export const credentialRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/private/i.test(message)) return 403;
  if (/up to \d+/i.test(message) || /required/i.test(message)) return 400;
  return 400;
}

// Uploaded credential files (screenshots/scans/PDFs of external certificates) — documents +
// images, same MIME whitelist as the Knowledge Hub's attachment upload.
const CREDENTIAL_MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const credentialUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!CREDENTIAL_MIME_EXTENSIONS[file.mimetype]) {
      return cb(new Error('Invalid file type. Only PDF, JPG, PNG, and WEBP are allowed.'));
    }
    cb(null, true);
  },
});

credentialRouter.post('/upload', requireAuth, uploadLimiter, credentialUpload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'A file is required' });
    }
    const ext = CREDENTIAL_MIME_EXTENSIONS[req.file.mimetype] ?? '.bin';
    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    await putUpload(key, req.file.buffer, req.file.mimetype);
    return res.json({ file: `/uploads/${key}`, fileName: req.file.originalname?.slice(0, 140) ?? '' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to upload file' });
  }
});

credentialRouter.get('/mine', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const credentials = await listMyCredentials(req.userId!);
    return res.json({ credentials });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load credentials' });
  }
});

credentialRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const credential = await createCredential(req.userId!, req.body);
    return res.status(201).json({ credential });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add credential';
    return res.status(statusFor(message)).json({ error: message });
  }
});

credentialRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const credential = await updateCredential(req.userId!, req.params.id, req.body);
    return res.json({ credential });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update credential';
    return res.status(statusFor(message)).json({ error: message });
  }
});

credentialRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await deleteCredential(req.userId!, req.params.id);
    return res.json({ message: 'Credential removed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to remove credential';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Public read for another user's profile — mirrors the /:username/certificates pattern in
// profile.routes.ts but lives here to keep this router self-contained.
credentialRouter.get('/user/:username', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUser = await authStore.getUserByUsername(req.params.username);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    const isOwner = Boolean(req.userId && targetUser.id === req.userId);
    const isAdmin = req.user?.role === 'ADMIN';
    if (targetUser.profile.profileVisibility === 'PRIVATE' && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'This profile is private' });
    }
    const credentials = await listCredentialsForUser(targetUser.id);
    return res.json({ credentials });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load credentials' });
  }
});
