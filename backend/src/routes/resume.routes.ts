import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authStore } from '../store/auth-store';
import { buildResumeProfileData } from '../services/profile-propagation.service';

export const resumeRouter = Router();

resumeRouter.get('/:username', async (req: AuthenticatedRequest, res) => {
  try {
    const { username } = req.params;
    const user = await authStore.getUserByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const requesterRole = req.user?.role;
    const isOwner = req.userId && user.id === req.userId;

    if (user.profile.profileVisibility === 'PRIVATE' && !isOwner && requesterRole !== 'ADMIN') {
      return res.status(403).json({ error: 'This resume is private' });
    }

    const resume = await buildResumeProfileData(user.id);
    if (!resume) {
      return res.status(404).json({ error: 'Resume data not found' });
    }

    if (requesterRole === 'ADMIN' || isOwner || user.profile.profileVisibility === 'PUBLIC') {
      const includePrivateFields = Boolean(requesterRole === 'ADMIN' || isOwner);
      const payloadResume = includePrivateFields
        ? resume
        : {
            ...resume,
            location: user.profile.showLocation ? resume.location : '',
            socialLinks: user.profile.showSocialLinks ? resume.socialLinks : [],
          };
      return res.json({ resume: payloadResume, user: authStore.toViewerUser(user, { includePrivateFields }) });
    }

    return res.status(403).json({ error: 'This resume is not public' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load resume' });
  }
});
