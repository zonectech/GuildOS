// Save as: routes/status-upload.routes.ts
// Mount in server.ts next to the status router:
//   import { statusUploadRouter } from './routes/status-upload.routes';
//   app.use('/api/status/upload', statusUploadRouter);
import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rate-limit';
import { upload, persistUploads } from '../middleware/upload';

export const statusUploadRouter = Router();

/**
 * POST /api/status/upload
 *
 * A user's own ticket or certificate image for a status. Returns the /uploads
 * path, which is then attached as TICKET_UPLOAD / CERTIFICATE_UPLOAD.
 * (Same middleware as the community image uploads: images only, rate limited.)
 */
statusUploadRouter.post(
  '/',
  requireAuth,
  uploadLimiter,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  persistUploads,
  async (req: AuthenticatedRequest, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const image = files?.image?.[0];

      if (!image) {
        return res.status(400).json({ error: 'An image is required' });
      }

      return res.json({ image: `/uploads/${image.filename}` });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Unable to upload the image',
      });
    }
  },
);