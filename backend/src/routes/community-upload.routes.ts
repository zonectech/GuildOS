import { Router } from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { aiLimiter, uploadLimiter } from '../middleware/rate-limit';
import { upload, persistUploads } from '../middleware/upload';
import { putUpload } from '../services/storage.service';
import { extractLeadersFromDocumentText } from '../services/community/community-leader-import.service';

export const communityUploadRouter = Router();

// Endorsement letters accept documents as well as images (shared media upload is images-only).
const LETTER_MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const letterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!LETTER_MIME_EXTENSIONS[file.mimetype]) {
      return cb(new Error('Invalid file type. Only PDF, JPG, PNG, and WEBP are allowed.'));
    }
    cb(null, true);
  },
});

// Endorsement letter supporting a manual-review community submission.
communityUploadRouter.post(
  '/endorsement-letter',
  requireAuth,
  uploadLimiter,
  letterUpload.single('letter'),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'An endorsement letter file is required' });
      }
      const ext = LETTER_MIME_EXTENSIONS[req.file.mimetype] ?? '.bin';
      const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      await putUpload(key, req.file.buffer, req.file.mimetype);
      return res.json({ letter: `/uploads/${key}`, fileName: req.file.originalname?.slice(0, 140) ?? '' });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to upload the endorsement letter' });
    }
  },
);

communityUploadRouter.post(
  '/',
  requireAuth,
  uploadLimiter,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  persistUploads,
  async (req: AuthenticatedRequest, res) => {
    try {
      const files = req.files as {
        [fieldname: string]: Express.Multer.File[];
      } | undefined;

      const logoFile = files?.logo?.[0];
      const coverImageFile = files?.coverImage?.[0];

      if (!logoFile) {
        return res.status(400).json({ error: 'Logo image is required' });
      }

      return res.json({
        logo: `/uploads/${logoFile.filename}`,
        coverImage: coverImageFile ? `/uploads/${coverImageFile.filename}` : '',
      });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to upload community images' });
    }
  },
);

// Optional photo for a curated leadership-roster entry (community-leader.service).
communityUploadRouter.post(
  '/leader-photo',
  requireAuth,
  uploadLimiter,
  upload.fields([{ name: 'photo', maxCount: 1 }]),
  persistUploads,
  async (req: AuthenticatedRequest, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const photoFile = files?.photo?.[0];

      if (!photoFile) {
        return res.status(400).json({ error: 'Photo is required' });
      }

      return res.json({ photo: `/uploads/${photoFile.filename}` });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to upload leader photo' });
    }
  },
);

// Buffered in memory only — never persisted to storage. We just need the bytes long enough to
// pull text out of the PDF for AI extraction, not to keep the file itself.
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed.'));
    }
    cb(null, true);
  },
});

/**
 * "Import from document" — an admin uploads a nomination/appointment-letter PDF (e.g. a
 * university society's newly-nominated executives list) and gets back a structured candidate
 * list to review/edit before committing. Nothing is written to the database here; the actual
 * leaders are created via POST /api/communities/:id/leaders/bulk after review.
 */
communityUploadRouter.post('/leaders/extract', requireAuth, aiLimiter, pdfUpload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'A PDF file is required' });
    }

    const parser = new PDFParse({ data: new Uint8Array(req.file.buffer) });
    let text = '';
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      await parser.destroy();
    }

    const extracted = await extractLeadersFromDocumentText(text);
    if (!extracted) {
      return res.status(503).json({ error: 'Document extraction is not available right now (AI provider not configured). Add leaders manually instead.' });
    }
    if (extracted.candidates.length === 0) {
      return res.status(422).json({ error: "Couldn't find any names in that document. Try a clearer PDF, or add leaders manually." });
    }

    return res.json(extracted);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to process document' });
  }
});
