import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { putUpload } from '../services/storage.service';

/** Thrown by fileFilter for a rejected file — safe to show verbatim to the client
 * (unlike arbitrary internal errors, which the global handler must not leak). */
export class UploadValidationError extends Error {}

// Photos only: JPG, PNG and WEBP. SVG is not accepted (it is a document that can carry scripts and links).
// Map the validated MIME type to a safe extension so a malicious filename
// (e.g. payload.svg / payload.html) can never control the stored object key
// and later served from /uploads.
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// Files are buffered in memory (max 5MB) then persisted to R2 or local disk by
// persistUploads. This keeps a single code path for both storage backends.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!MIME_EXTENSIONS[file.mimetype]) {
      return cb(new UploadValidationError('Invalid file type. Only JPG, PNG and WEBP images are allowed.'));
    }
    cb(null, true);
  },
});

/** The first bytes of a real JPEG, PNG or WebP. A file that only claims the type is refused. */
function looksLike(mime: string, b: Buffer) {
  if (mime === 'image/jpeg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === 'image/png') return b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === 'image/webp') return b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  return true;
}

function collectFiles(req: Request): Express.Multer.File[] {
  const files: Express.Multer.File[] = [];
  if (req.file) files.push(req.file);
  if (req.files) {
    if (Array.isArray(req.files)) files.push(...req.files);
    else for (const arr of Object.values(req.files)) files.push(...arr);
  }
  return files;
}

/**
 * Middleware to run AFTER a multer upload handler. Writes each buffered file to
 * storage under a safe generated key and sets file.filename to that key, so
 * routes keep building `/uploads/${file.filename}` references unchanged.
 */
export async function persistUploads(req: Request, _res: Response, next: NextFunction) {
  try {
    for (const file of collectFiles(req)) {
      if (!looksLike(file.mimetype, file.buffer)) throw new UploadValidationError('That file is not a valid image. Upload a JPG, PNG or WEBP.');
      const ext = MIME_EXTENSIONS[file.mimetype] ?? '.bin';
      const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      await putUpload(key, file.buffer, file.mimetype);
      file.filename = key;
    }
    next();
  } catch (error) {
    next(error);
  }
}