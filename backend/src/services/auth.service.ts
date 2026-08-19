import { randomUUID } from 'node:crypto';
import { authStore, toPublicUser } from '../store/auth-store';
import { config } from '../config';
import { sendEmail, passwordResetEmailTemplate, verificationEmailTemplate } from '../utils/email';
import type {
  LoginInput,
  ProfileSetupInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  SignupInput,
  VerifyEmailInput,
} from '../types';
import { verifyPassword } from '../utils/password';
import { createToken } from '../utils/token';
import { RecruiterProfileModel } from '../models/recruiter-profile.model';
import { sanitizeSocialLinks } from '../utils/social-links';
import { recordLoginAudit } from './login-traffic.service';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function ensurePassword(password: string) {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    throw new Error('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    throw new Error('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    throw new Error('Password must contain at least one number');
  }
}

function ensureNonEmpty(value: string, label: string) {
  if (!value.trim()) {
    throw new Error(`${label} is required`);
  }
}

function ensureFullName(fullName: string) {
  const value = fullName.trim();
  if (value.length < 2 || value.length > 100) {
    throw new Error('Full name must be between 2 and 100 characters');
  }
}

function ensureUsername(username: string) {
  const value = username.trim().toLowerCase();
  if (value.length < 3 || value.length > 30) {
    throw new Error('Username must be between 3 and 30 characters');
  }
  if (!/^[a-z0-9_]+$/.test(value)) {
    throw new Error('Username may only contain letters, numbers, and underscores');
  }
}

function ensureBio(bio: string) {
  if (bio.trim().length > 300) {
    throw new Error('Bio must be 300 characters or less');
  }
}

function ensureLocation(location: string) {
  if (location.trim().length > 120) {
    throw new Error('Location must be 120 characters or less');
  }
}

function ensurePhoneNumber(phoneNumber: string) {
  const value = phoneNumber.trim();
  if (value && !/^\+?[0-9 ()-]{7,20}$/.test(value)) {
    throw new Error('Phone number is invalid');
  }
}

function ensureGraduationYear(graduationYear: number | null | undefined) {
  if (graduationYear == null) return;
  const year = Number(graduationYear);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1900 || year > currentYear + 10) {
    throw new Error('Graduation year is invalid');
  }
}

function ensureAvatarFileName(avatar: string) {
  const value = avatar.trim();
  if (!value) return;
  if (!/\.(jpg|jpeg|png|webp)$/i.test(value)) {
    throw new Error('Avatar must be JPG, PNG, or WEBP');
  }
}

function ensureInterestLimits(interests: string[]) {
  if (interests.length < 1) {
    throw new Error('Select at least 1 interest');
  }

  if (interests.length > 10) {
    throw new Error('Select no more than 10 interests');
  }
}

async function buildSession(userId: string) {
  const accessToken = createToken({ sub: userId, purpose: 'access', jti: randomUUID() }, config.accessTokenTtlMs);
  const refreshToken = await authStore.issueRefreshToken(userId, config.refreshTokenTtlMs);

  return { accessToken, refreshToken };
}

export async function signup(input: SignupInput) {
  ensureFullName(input.fullName);
  ensureNonEmpty(input.email, 'Email');
  ensurePassword(input.password);

  const user = await authStore.createUser({
    fullName: input.fullName,
    email: normalizeEmail(input.email),
    password: input.password,
    profile: {
      university: input.university ?? '',
      faculty: input.faculty ?? '',
      department: input.department ?? '',
      level: input.level ?? '',
      interests: [],
      avatar: '',
    },
  });

  const verificationToken = await authStore.issueOpaqueToken(user.id, 'email-verification', config.verificationTokenTtlMs);
  const session = await buildSession(user.id);
  const verificationUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  await sendEmail(user.email, verificationEmailTemplate(user.fullName, verificationUrl));

  return {
    user: toPublicUser(user),
    ...session,
    message: 'Account created. Please verify your email to finish onboarding.',
  };
}

export async function signupRecruiter(input: {
  fullName?: string;
  email?: string;
  password?: string;
  company?: string;
  position?: string;
  website?: string;
}) {
  ensureFullName(input.fullName ?? '');
  ensureNonEmpty(input.email ?? '', 'Email');
  ensurePassword(input.password ?? '');
  if (!input.company?.trim()) {
    throw new Error('Company name is required');
  }

  const user = await authStore.createUser({
    fullName: input.fullName as string,
    email: normalizeEmail(input.email as string),
    password: input.password as string,
    role: 'RECRUITER',
  });

  await RecruiterProfileModel.create({
    userId: user.id,
    company: input.company.trim(),
    position: input.position?.trim() ?? '',
    website: input.website?.trim() ?? '',
  });

  const verificationToken = await authStore.issueOpaqueToken(user.id, 'email-verification', config.verificationTokenTtlMs);
  const session = await buildSession(user.id);
  const verificationUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  await sendEmail(user.email, verificationEmailTemplate(user.fullName, verificationUrl));

  return {
    user: toPublicUser(user),
    ...session,
    message: 'Recruiter account created. Please verify your email.',
  };
}

export async function login(input: LoginInput) {
  ensureNonEmpty(input.email, 'Email');
  ensureNonEmpty(input.password, 'Password');

  const user = await authStore.getUserByEmail(normalizeEmail(input.email));
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const passwordMatches = verifyPassword(input.password, user.passwordSalt, user.passwordHash);
  if (!passwordMatches) {
    throw new Error('Invalid email or password');
  }

  if (user.deletedAt) {
    throw new Error('This account no longer exists');
  }

  if (user.status === 'BLOCKED') {
    throw new Error('Your account has been blocked. Contact support for help.');
  }

  const session = await buildSession(user.id);
  await recordLoginAudit({
    userId: user.id,
    email: user.email,
    role: user.role,
    sessionId: randomUUID(),
  });

  return {
    user: toPublicUser(user),
    ...session,
    needsVerification: !user.emailVerified,
    message: user.emailVerified ? 'Login successful' : 'Email verification still required',
  };
}

export async function refreshSession(refreshToken: string) {
  const consumed = await authStore.consumeRefreshToken(refreshToken);
  if (!consumed) {
    throw new Error('Invalid or expired refresh token');
  }

  const user = await authStore.getUserById(consumed.payload.sub);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.deletedAt || user.status === 'BLOCKED') {
    await authStore.revokeTokensForUser(user.id, 'refresh');
    throw new Error('Your account is no longer active');
  }

  await authStore.revokeTokensForUser(user.id, 'refresh');
  const session = await buildSession(user.id);

  return {
    user: toPublicUser(user),
    ...session,
    message: 'Session refreshed',
  };
}

export async function logout(refreshToken?: string) {
  if (refreshToken) {
    const consumed = await authStore.consumeRefreshToken(refreshToken);
    if (consumed) {
      await authStore.revokeTokensForUser(consumed.payload.sub, 'refresh');
    }
  }

  return {
    message: 'Logged out successfully',
  };
}

export async function resendVerification(email: string) {
  ensureNonEmpty(email, 'Email');

  const user = await authStore.getUserByEmail(normalizeEmail(email));
  if (!user) {
    throw new Error('Account not found');
  }

  const verificationToken = await authStore.issueOpaqueToken(user.id, 'email-verification', config.verificationTokenTtlMs);
  const verificationUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/verify-email?token=${encodeURIComponent(verificationToken)}`;

  await sendEmail(user.email, verificationEmailTemplate(user.fullName, verificationUrl));

  return {
    message: 'Verification email queued',
  };
}

export async function requestPasswordReset(input: RequestPasswordResetInput) {
  ensureNonEmpty(input.email, 'Email');

  const user = await authStore.getUserByEmail(normalizeEmail(input.email));
  if (!user) {
    throw new Error('Account not found');
  }

  const resetToken = await authStore.issueOpaqueToken(user.id, 'password-reset', config.resetTokenTtlMs);
  const resetUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(resetToken)}`;

  await sendEmail(user.email, passwordResetEmailTemplate(user.fullName, resetUrl));

  return {
    message: 'Password reset link queued',
  };
}

export async function confirmEmailVerification(input: VerifyEmailInput) {
  ensureNonEmpty(input.token, 'Verification token');

  const tokenRecord = await authStore.consumeToken(input.token, 'email-verification');
  if (!tokenRecord) {
    throw new Error('Invalid or expired verification token');
  }

  const updatedUser = await authStore.verifyEmail(tokenRecord.userId.toString());
  if (!updatedUser) {
    throw new Error('User not found');
  }

  return {
    user: toPublicUser(updatedUser),
    message: 'Email verified successfully',
  };
}

export async function resetPassword(input: ResetPasswordInput) {
  ensureNonEmpty(input.token, 'Reset token');
  ensurePassword(input.password);

  const tokenRecord = await authStore.consumeToken(input.token, 'password-reset');
  if (!tokenRecord) {
    throw new Error('Invalid or expired reset token');
  }

  const updatedUser = await authStore.setPassword(tokenRecord.userId.toString(), input.password);
  if (!updatedUser) {
    throw new Error('User not found');
  }

  await authStore.revokeTokensForUser(updatedUser.id.toString(), 'refresh');

  return {
    message: 'Password updated successfully',
  };
}

export async function saveProfile(userId: string, input: ProfileSetupInput) {
  ensureNonEmpty(input.university, 'University');
  ensureNonEmpty(input.level, 'Level');
  ensureUsername(input.username);
  ensureBio(input.bio ?? '');
  ensureLocation(input.location ?? '');
  const socialLinks = sanitizeSocialLinks(input.socialLinks ?? []);
  ensurePhoneNumber(input.phoneNumber ?? '');
  ensureGraduationYear(input.graduationYear ?? null);
  ensureInterestLimits(input.interests.filter(Boolean));
  ensureAvatarFileName(input.avatar ?? '');

  const existingForCover = await authStore.getUserById(userId);
  const updatedUser = await authStore.updateProfile(userId, {
    username: input.username.trim().toLowerCase(),
    phoneNumber: input.phoneNumber?.trim() ?? '',
    showPhoneNumber: input.showPhoneNumber ?? false,
    bio: input.bio?.trim() ?? '',
    location: input.location?.trim() ?? '',
    showLocation: input.showLocation ?? true,
    socialLinks,
    showSocialLinks: input.showSocialLinks ?? true,
    graduationYear: input.graduationYear ?? null,
    profileVisibility: input.profileVisibility ?? 'PUBLIC',
    showEmail: input.showEmail ?? false,
    showUniversity: input.showUniversity ?? true,
    showLeadership: input.showLeadership ?? true,
    showCertificates: input.showCertificates ?? true,
    showTimeline: input.showTimeline ?? true,
    availability: input.availability ?? 'CLOSED',
    jobSeeking: input.jobSeeking ?? false,
    internshipSeeking: input.internshipSeeking ?? false,
    openToRelocation: input.openToRelocation ?? false,
    preferredIndustries: Array.isArray(input.preferredIndustries) ? input.preferredIndustries.filter(Boolean) : [],
    university: input.university.trim(),
    faculty: input.faculty?.trim() ?? '',
    department: input.department?.trim() ?? '',
    level: input.level.trim(),
    interests: input.interests.filter(Boolean),
    skills: Array.isArray(input.skills) ? input.skills.filter(Boolean) : (existingForCover?.profile.skills ?? []),
    avatar: input.avatar?.trim() ?? '',
    coverImage: existingForCover?.profile.coverImage ?? '',
  });

  if (updatedUser) {
    updatedUser.onboardingCompleted = true;
    await updatedUser.save();
  }

  if (!updatedUser) {
    throw new Error('User not found');
  }

  return {
    user: toPublicUser(updatedUser),
    message: 'Profile saved',
  };
}
