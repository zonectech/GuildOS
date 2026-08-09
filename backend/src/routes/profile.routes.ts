import { Router } from 'express';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { upload, persistUploads } from '../middleware/upload';
import { uploadLimiter, dataExportLimiter } from '../middleware/rate-limit';
import { authStore } from '../store/auth-store';
import { verifyPassword } from '../utils/password';
import { listUserCertificates } from '../services/event.service';
import { recordProfileView } from '../services/profile-view.service';
import { exportUserData } from '../services/data-export.service';
import { sanitizeSocialLinks, SocialLinksValidationError } from '../utils/social-links';

export const profileRouter = Router();

profileRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await authStore.getPublicUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to load profile',
    });
  }
});

profileRouter.patch('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fullName, username, phoneNumber, showPhoneNumber, bio, location, showLocation, socialLinks, showSocialLinks, graduationYear, profileVisibility, showEmail, showUniversity, showLeadership, showCertificates, showTimeline, university, faculty, department, level, interests, skills, avatar, coverImage } = req.body as {
      fullName?: string;
      username?: string;
      phoneNumber?: string;
      showPhoneNumber?: boolean;
      bio?: string;
      location?: string;
      showLocation?: boolean;
      socialLinks?: string[];
      showSocialLinks?: boolean;
      graduationYear?: number | null;
      profileVisibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
      showEmail?: boolean;
      showUniversity?: boolean;
      showLeadership?: boolean;
      showCertificates?: boolean;
      showTimeline?: boolean;
      university?: string;
      faculty?: string;
      department?: string;
      level?: string;
      interests?: string[];
      skills?: string[];
      avatar?: string;
      coverImage?: string;
    };

    const normalizedUsername = (username ?? '').trim();
    if (normalizedUsername) {
      const duplicateUser = await authStore.getUserByUsername(normalizedUsername);
      if (duplicateUser && duplicateUser.id !== req.userId) {
        return res.status(409).json({ error: 'Username is already taken' });
      }
    }

    const existingUser = await authStore.getUserById(req.userId);
    const normalizedSocialLinks = socialLinks === undefined
      ? existingUser?.profile.socialLinks ?? []
      : sanitizeSocialLinks(socialLinks);
    const updatedUser = await authStore.updateProfile(req.userId, {
      fullName: fullName?.trim() || existingUser?.fullName || '',
      username: normalizedUsername,
      phoneNumber: phoneNumber ?? existingUser?.profile.phoneNumber ?? '',
      showPhoneNumber: showPhoneNumber ?? existingUser?.profile.showPhoneNumber ?? false,
      bio: bio ?? existingUser?.profile.bio ?? '',
      location: location ?? existingUser?.profile.location ?? '',
      showLocation: showLocation ?? existingUser?.profile.showLocation ?? true,
      socialLinks: normalizedSocialLinks,
      showSocialLinks: showSocialLinks ?? existingUser?.profile.showSocialLinks ?? true,
      graduationYear: graduationYear ?? existingUser?.profile.graduationYear ?? null,
      profileVisibility: profileVisibility ?? existingUser?.profile.profileVisibility ?? 'PUBLIC',
      showEmail: showEmail ?? existingUser?.profile.showEmail ?? false,
      showUniversity: showUniversity ?? existingUser?.profile.showUniversity ?? true,
      showLeadership: showLeadership ?? existingUser?.profile.showLeadership ?? true,
      showCertificates: showCertificates ?? existingUser?.profile.showCertificates ?? true,
      showTimeline: showTimeline ?? existingUser?.profile.showTimeline ?? true,
      availability: existingUser?.profile.availability ?? 'CLOSED',
      jobSeeking: existingUser?.profile.jobSeeking ?? false,
      internshipSeeking: existingUser?.profile.internshipSeeking ?? false,
      openToRelocation: existingUser?.profile.openToRelocation ?? false,
      preferredIndustries: existingUser?.profile.preferredIndustries ?? [],
      university: university ?? existingUser?.profile.university ?? '',
      faculty: faculty ?? existingUser?.profile.faculty ?? '',
      department: department ?? existingUser?.profile.department ?? '',
      level: level ?? existingUser?.profile.level ?? '',
      interests: Array.isArray(interests) ? interests.filter(Boolean) : (existingUser?.profile.interests ?? []),
      skills: Array.isArray(skills) ? skills.filter(Boolean) : (existingUser?.profile.skills ?? []),
      avatar: avatar ?? existingUser?.profile.avatar ?? '',
      coverImage: coverImage ?? existingUser?.profile.coverImage ?? '',
    });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: authStore.toPublicUser(updatedUser),
      message: 'Profile updated',
    });
  } catch (error) {
    if (error instanceof SocialLinksValidationError) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to update profile',
    });
  }
});

profileRouter.patch('/avatar', requireAuth, uploadLimiter, upload.single('avatar'), persistUploads, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileAvatar = req.file ? `/uploads/${req.file.filename}` : undefined;
    const { avatar: bodyAvatar } = req.body as { avatar?: string };
    const avatar = fileAvatar ?? bodyAvatar;
    if (!avatar) {
      return res.status(400).json({ error: 'Avatar is required' });
    }

    const existingUser = await authStore.getUserById(req.userId);
    const updatedUser = await authStore.updateProfile(req.userId, {
      username: existingUser?.profile.username ?? '',
      phoneNumber: existingUser?.profile.phoneNumber ?? '',
      showPhoneNumber: existingUser?.profile.showPhoneNumber ?? false,
      bio: existingUser?.profile.bio ?? '',
      location: existingUser?.profile.location ?? '',
      showLocation: existingUser?.profile.showLocation ?? true,
      socialLinks: existingUser?.profile.socialLinks ?? [],
      showSocialLinks: existingUser?.profile.showSocialLinks ?? true,
      graduationYear: existingUser?.profile.graduationYear ?? null,
      profileVisibility: existingUser?.profile.profileVisibility ?? 'PUBLIC',
      showEmail: existingUser?.profile.showEmail ?? false,
      showUniversity: existingUser?.profile.showUniversity ?? true,
      showLeadership: existingUser?.profile.showLeadership ?? true,
      showCertificates: existingUser?.profile.showCertificates ?? true,
      showTimeline: existingUser?.profile.showTimeline ?? true,
      availability: existingUser?.profile.availability ?? 'CLOSED',
      jobSeeking: existingUser?.profile.jobSeeking ?? false,
      internshipSeeking: existingUser?.profile.internshipSeeking ?? false,
      openToRelocation: existingUser?.profile.openToRelocation ?? false,
      preferredIndustries: existingUser?.profile.preferredIndustries ?? [],
      university: existingUser?.profile.university ?? '',
      faculty: existingUser?.profile.faculty ?? '',
      department: existingUser?.profile.department ?? '',
      level: existingUser?.profile.level ?? '',
      interests: existingUser?.profile.interests ?? [],
      skills: existingUser?.profile.skills ?? [],
      avatar: avatar ?? existingUser?.profile.avatar ?? '',
      coverImage: existingUser?.profile.coverImage ?? '',
    });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: authStore.toPublicUser(updatedUser),
      message: 'Avatar updated',
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to upload avatar',
    });
  }
});

profileRouter.patch('/cover', requireAuth, uploadLimiter, upload.single('coverImage'), persistUploads, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileCover = req.file ? `/uploads/${req.file.filename}` : undefined;
    const { coverImage: bodyCover } = req.body as { coverImage?: string };
    const coverImage = fileCover ?? bodyCover;
    if (!coverImage) {
      return res.status(400).json({ error: 'Cover image is required' });
    }

    const existingUser = await authStore.getUserById(req.userId);
    const updatedUser = await authStore.updateProfile(req.userId, {
      username: existingUser?.profile.username ?? '',
      phoneNumber: existingUser?.profile.phoneNumber ?? '',
      showPhoneNumber: existingUser?.profile.showPhoneNumber ?? false,
      bio: existingUser?.profile.bio ?? '',
      location: existingUser?.profile.location ?? '',
      showLocation: existingUser?.profile.showLocation ?? true,
      socialLinks: existingUser?.profile.socialLinks ?? [],
      showSocialLinks: existingUser?.profile.showSocialLinks ?? true,
      graduationYear: existingUser?.profile.graduationYear ?? null,
      profileVisibility: existingUser?.profile.profileVisibility ?? 'PUBLIC',
      showEmail: existingUser?.profile.showEmail ?? false,
      showUniversity: existingUser?.profile.showUniversity ?? true,
      showLeadership: existingUser?.profile.showLeadership ?? true,
      showCertificates: existingUser?.profile.showCertificates ?? true,
      showTimeline: existingUser?.profile.showTimeline ?? true,
      availability: existingUser?.profile.availability ?? 'CLOSED',
      jobSeeking: existingUser?.profile.jobSeeking ?? false,
      internshipSeeking: existingUser?.profile.internshipSeeking ?? false,
      openToRelocation: existingUser?.profile.openToRelocation ?? false,
      preferredIndustries: existingUser?.profile.preferredIndustries ?? [],
      university: existingUser?.profile.university ?? '',
      faculty: existingUser?.profile.faculty ?? '',
      department: existingUser?.profile.department ?? '',
      level: existingUser?.profile.level ?? '',
      interests: existingUser?.profile.interests ?? [],
      skills: existingUser?.profile.skills ?? [],
      avatar: existingUser?.profile.avatar ?? '',
      coverImage: coverImage ?? existingUser?.profile.coverImage ?? '',
    });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: authStore.toPublicUser(updatedUser),
      message: 'Cover updated',
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to upload cover image',
    });
  }
});

profileRouter.patch('/availability', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { availability, jobSeeking, internshipSeeking, openToRelocation, preferredIndustries } = req.body as {
      availability?: 'OPEN' | 'CASUAL' | 'CLOSED';
      jobSeeking?: boolean;
      internshipSeeking?: boolean;
      openToRelocation?: boolean;
      preferredIndustries?: string[];
    };
    const user = await authStore.updateCareerPreferences(req.userId, { availability, jobSeeking, internshipSeeking, openToRelocation, preferredIndustries });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: authStore.toPublicUser(user), message: 'Availability updated' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to update availability' });
  }
});

profileRouter.patch('/privacy', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { profileVisibility, showEmail, showPhoneNumber, showLocation, showSocialLinks, showUniversity, showLeadership, showCertificates, showTimeline } = req.body as {
      profileVisibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
      showEmail?: boolean;
      showPhoneNumber?: boolean;
      showLocation?: boolean;
      showSocialLinks?: boolean;
      showUniversity?: boolean;
      showLeadership?: boolean;
      showCertificates?: boolean;
      showTimeline?: boolean;
    };

    const existingUser = await authStore.getUserById(req.userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await authStore.updateProfile(req.userId, {
      username: existingUser.profile.username,
      phoneNumber: existingUser.profile.phoneNumber,
      showPhoneNumber: showPhoneNumber ?? existingUser.profile.showPhoneNumber,
      bio: existingUser.profile.bio,
      location: existingUser.profile.location,
      showLocation: showLocation ?? existingUser.profile.showLocation,
      socialLinks: existingUser.profile.socialLinks,
      showSocialLinks: showSocialLinks ?? existingUser.profile.showSocialLinks,
      graduationYear: existingUser.profile.graduationYear,
      profileVisibility: profileVisibility ?? existingUser.profile.profileVisibility,
      showEmail: showEmail ?? existingUser.profile.showEmail,
      showUniversity: showUniversity ?? existingUser.profile.showUniversity,
      showLeadership: showLeadership ?? existingUser.profile.showLeadership,
      showCertificates: showCertificates ?? existingUser.profile.showCertificates,
      showTimeline: showTimeline ?? existingUser.profile.showTimeline,
      availability: existingUser.profile.availability,
      jobSeeking: existingUser.profile.jobSeeking,
      internshipSeeking: existingUser.profile.internshipSeeking,
      openToRelocation: existingUser.profile.openToRelocation,
      preferredIndustries: existingUser.profile.preferredIndustries,
      university: existingUser.profile.university,
      faculty: existingUser.profile.faculty,
      department: existingUser.profile.department,
      level: existingUser.profile.level,
      interests: existingUser.profile.interests,
      skills: existingUser.profile.skills,
      avatar: existingUser.profile.avatar,
      coverImage: existingUser.profile.coverImage,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: authStore.toPublicUser(updatedUser), message: 'Privacy updated' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to update privacy' });
  }
});

profileRouter.patch('/password', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const existingUser = await authStore.getUserById(req.userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordMatches = verifyPassword(currentPassword, existingUser.passwordSalt, existingUser.passwordHash);
    if (!passwordMatches) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const updatedUser = await authStore.setPassword(req.userId, newPassword);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await authStore.revokeTokensForUser(req.userId, 'refresh');

    return res.json({ user: authStore.toPublicUser(updatedUser), message: 'Password updated' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to update password' });
  }
});

profileRouter.get('/export', requireAuth, dataExportLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const data = await exportUserData(req.userId);
    res.setHeader('Content-Disposition', `attachment; filename="guildos-data-export-${req.userId}.json"`);
    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export data';
    return res.status(message === 'User not found' ? 404 : 500).json({ error: message });
  }
});

profileRouter.delete('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await authStore.deleteUser(req.userId);
    return res.json({ message: 'Profile deleted' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to delete profile' });
  }
});

profileRouter.get('/:username', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { username } = req.params;
    const requesterRole = req.user?.role;
    const requesterId = req.userId;

    if (requesterRole === 'ADMIN') {
      const result = await authStore.getProfileByUsernameForAdmin(username);
      if (!result) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ user: authStore.toPublicUser(result.user), profile: result.publicProfile });
    }

    const targetUser = await authStore.getUserByUsername(username);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isOwner = requesterId && targetUser.id === requesterId;
    const visibility = targetUser.profile.profileVisibility;

    if (visibility === 'PRIVATE' && !isOwner) {
      return res.status(403).json({ error: 'This profile is private' });
    }

    if (visibility === 'UNLISTED' && !isOwner) {
      return res.status(403).json({ error: 'This profile is unlisted' });
    }

    if (!isOwner) {
      void recordProfileView({
        targetUserId: targetUser.id,
        viewerId: requesterId ?? null,
        viewerRole: (requesterRole as any) ?? 'ANON',
        source: 'PROFILE',
      });
    }

    return res.json({
      user: authStore.toViewerUser(targetUser, {
        includePrivateFields: Boolean(isOwner),
      }),
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load profile' });
  }
});

profileRouter.get('/:username/certificates', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUser = await authStore.getUserByUsername(req.params.username);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    const isOwner = req.userId && targetUser.id === req.userId;
    const isAdmin = req.user?.role === 'ADMIN';
    if (targetUser.profile.profileVisibility === 'PRIVATE' && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'This profile is private' });
    }
    if (targetUser.profile.showCertificates === false && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Certificates are hidden on this profile' });
    }
    const certificates = await listUserCertificates(targetUser.id);
    return res.json({ certificates });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load certificates' });
  }
});

profileRouter.post('/onboarding/complete', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await authStore.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.onboardingCompleted = true;
    await user.save();

    return res.json({
      user: authStore.toPublicUser(user),
      message: 'Onboarding completed',
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to complete onboarding',
    });
  }
});