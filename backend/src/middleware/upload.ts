import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { putUpload } from '../services/storage.service';

/** Thrown by fileFilter for a rejected file — safe to show verbatim to the client
 * (unlike arbitrary internal errors, which the global handler must not leak). */
export class UploadValidationError extends Error {}

// Map the validated MIME type to a safe extension so a malicious filename
// (e.g. payload.svg / payload.html) can never control the stored object key
// and later served from /uploads.
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  // Organization/community logos are very commonly vector (SVG) files — allowed
  // everywhere images are (all consumers render it via <img>/canvas drawImage,
  // never inline-injected as DOM markup, and /uploads is served with a CSP
  // sandbox that blocks script execution on direct navigation).
  'image/svg+xml': '.svg',
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
      return cb(new UploadValidationError('Invalid file type. Only JPG, PNG, WEBP, and SVG images are allowed.'));
    }
    cb(null, true);
  },
});

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