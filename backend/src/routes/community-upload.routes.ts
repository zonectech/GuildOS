import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';

export const communityUploadRouter = Router();

communityUploadRouter.post(
  '/',
  requireAuth,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]),
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
