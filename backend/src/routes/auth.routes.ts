import { Router, type Response } from 'express';
import { config } from '../config';
import {
  confirmEmailVerification,
  login,
  logout,
  refreshSession,
  requestPasswordReset,
  resetPassword,
  resendVerification,
  saveProfile,
  signup,
  signupRecruiter,
} from '../services/auth.service';
import { requireAuth, requireDashboardAuth, type AuthenticatedRequest } from '../middleware/auth';
import { authAttemptLimiter, emailSenderLimiter } from '../middleware/rate-limit';

export const authRouter = Router();

const accessCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax' as const,
  path: '/',
  domain: config.cookieDomain,
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax' as const,
  path: '/api/auth',
  domain: config.cookieDomain,
};

function setSessionCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('guildos_access_token', accessToken, {
    ...accessCookieOptions,
    maxAge: config.accessTokenTtlMs,
  });
  res.cookie('guildos_refresh_token', refreshToken, {
    ...refreshCookieOptions,
    maxAge: config.refreshTokenTtlMs,
  });
}

function clearSessionCookies(res: Response) {
  res.clearCookie('guildos_access_token', accessCookieOptions);
  res.clearCookie('guildos_refresh_token', refreshCookieOptions);
}

function handleError(res: Response, error: unknown, fallbackMessage: string, status = 400) {
  return res.status(status).json({ error: error instanceof Error ? error.message : fallbackMessage });
}

authRouter.post('/signup', authAttemptLimiter, async (req, res) => {
  try {
    const result = await signup(req.body);
    setSessionCookies(res, result.accessToken, result.refreshToken);
    return res.status(201).json({
      user: result.user,
      message: result.message,
    });
  } catch (error) {
    return handleError(res, error, 'Signup failed');
  }
});

authRouter.post('/recruiter-signup', authAttemptLimiter, async (req, res) => {
  try {
    const result = await signupRecruiter(req.body);
    setSessionCookies(res, result.accessToken, result.refreshToken);
    return res.status(201).json({
      user: result.user,
      message: result.message,
    });
  } catch (error) {
    return handleError(res, error, 'Recruiter signup failed');
  }
});

authRouter.post('/login', authAttemptLimiter, async (req, res) => {
  try {
    const result = await login(req.body);
    setSessionCookies(res, result.accessToken, result.refreshToken);
    return res.json({
      user: result.user,
      needsVerification: result.needsVerification,
      message: result.message,
    });
  } catch (error) {
    return handleError(res, error, 'Login failed', 401);
  }
});

authRouter.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.guildos_refresh_token as string | undefined;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Missing refresh token' });
    }

    const result = await refreshSession(refreshToken);
    setSessionCookies(res, result.accessToken, result.refreshToken);
    return res.json({ user: result.user, message: result.message });
  } catch (error) {
    clearSessionCookies(res);
    return handleError(res, error, 'Unable to refresh session', 401);
  }
});

authRouter.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.guildos_refresh_token as string | undefined;
    const result = await logout(refreshToken);
    clearSessionCookies(res);
    return res.json(result);
  } catch (error) {
    clearSessionCookies(res);
    return handleError(res, error, 'Unable to log out');
  }
});

authRouter.post('/resend-verification', emailSenderLimiter, async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await resendVerification(email);
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to resend verification');
  }
});

authRouter.post('/verify-email', async (req, res) => {
  try {
    const { token, verificationToken } = req.body as { token?: string; verificationToken?: string };
    const payloadToken = token ?? verificationToken;
    if (!payloadToken) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const result = await confirmEmailVerification({ token: payloadToken });
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to verify email');
  }
});

authRouter.post('/forgot-password', emailSenderLimiter, async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await requestPasswordReset({ email });
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to request reset link');
  }
});

authRouter.post('/reset-password', authAttemptLimiter, async (req, res) => {
  try {
    const { token, resetToken, password } = req.body as { token?: string; resetToken?: string; password?: string };
    const payloadToken = token ?? resetToken;
    if (!payloadToken || !password) {
      return res.status(400).json({ error: 'Reset token and password are required' });
    }

    const result = await resetPassword({ token: payloadToken, password });
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to reset password');
  }
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.user });
});

authRouter.post('/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      username,
      university,
      faculty,
      department,
      level,
      interests = [],
      avatar = '',
      phoneNumber,
      bio,
      location,
      socialLinks,
      graduationYear,
      profileVisibility,
      showUniversity,
      showLeadership,
      showCertificates,
    } = req.body as {
      username?: string;
      university?: string;
      faculty?: string;
      department?: string;
      level?: string;
      interests?: string[];
      avatar?: string;
      phoneNumber?: string;
      bio?: string;
      location?: string;
      socialLinks?: string[];
      graduationYear?: number | null;
      profileVisibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
      showUniversity?: boolean;
      showLeadership?: boolean;
      showCertificates?: boolean;
    };

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await saveProfile(req.userId, {
      username: username ?? '',
      university: university ?? '',
      faculty: faculty ?? '',
      department: department ?? '',
      level: level ?? '',
      interests,
      avatar,
      phoneNumber,
      bio,
      location,
      socialLinks,
      graduationYear,
      profileVisibility,
      showUniversity,
      showLeadership,
      showCertificates,
    });

    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to save profile');
  }
});

authRouter.get('/dashboard', requireDashboardAuth, (req: AuthenticatedRequest, res) => {
  return res.json({
    user: req.user,
    message: 'Dashboard access granted',
  });
});
