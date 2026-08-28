import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import { config } from '../config';
import { authStore } from '../store/auth-store';
import { createToken } from '../utils/token';
import { createGoogleState, getGoogleUserInfo } from '../utils/oauth';

export const oauthRouter = Router();

const googleStateStore = new Map<string, 'pending'>();
const googleCallbackResponseStore = new Map<string, { user: unknown; nextRoute: string; message: string }>();

const accessCookieOptions = {
  httpOnly: true,
  secure: config.isProduction || config.cookieSameSite === 'none',
  sameSite: config.cookieSameSite,
  path: '/',
  domain: config.cookieDomain,
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: config.isProduction || config.cookieSameSite === 'none',
  sameSite: config.cookieSameSite,
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

async function buildSession(userId: string, role?: string) {
  const accessToken = createToken(
    { sub: userId, purpose: 'access', jti: randomUUID(), ...(role ? { role: role as import('../types').UserRole } : {}) },
    config.accessTokenTtlMs,
  );
  const refreshToken = await authStore.issueRefreshToken(userId, config.refreshTokenTtlMs);
  return { accessToken, refreshToken };
}

oauthRouter.get('/google', (_req, res) => {
  if (!config.googleClientId || !config.googleRedirectUri) {
    return res.status(503).json({ error: 'Google sign-in is not configured' });
  }

  const state = createGoogleState();
  googleStateStore.set(state, 'pending');

  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  return res.json({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

oauthRouter.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state || !googleStateStore.has(state)) {
      return res.status(400).json({ error: 'Invalid Google OAuth response' });
    }

    const cachedResponse = googleCallbackResponseStore.get(state);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    googleStateStore.delete(state);

    if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
      return res.status(503).json({ error: 'Google sign-in is not configured' });
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: config.googleRedirectUri,
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!tokenResponse.ok) {
      return res.status(400).json({ error: 'Unable to exchange Google code' });
    }

    const tokenData = await tokenResponse.json() as { access_token?: string };
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'Google access token missing' });
    }

    const profile = await getGoogleUserInfo(tokenData.access_token);
    const email = profile.email.toLowerCase();
    let user = await authStore.getUserByEmail(email);

    if (!user) {
      user = await authStore.createUser({
        fullName: profile.name,
        email,
        password: crypto.randomUUID(),
        profile: {},
      });
      user.emailVerified = Boolean(profile.email_verified);
      await user.save();
    } else if (profile.email_verified && !user.emailVerified) {
      user.emailVerified = true;
      await user.save();
    }

    const publicUser = await authStore.getPublicUserById(user.id);
    if (!publicUser) {
      return res.status(500).json({ error: 'Unable to load Google user profile' });
    }

    const nextRoute = !publicUser.profileComplete
      ? '/profile-setup'
      : publicUser.role === 'RECRUITER'
        ? '/recruiter'
        : publicUser.role === 'ADMIN'
          ? '/dashboard/admin'
          : '/home';

    const session = await buildSession(user.id, publicUser.role);
    setSessionCookies(res, session.accessToken, session.refreshToken);

    const responsePayload = {
      user: publicUser,
      nextRoute,
      message: 'Google sign-in successful',
    };

    googleCallbackResponseStore.set(state, responsePayload);

    return res.json(responsePayload);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Google sign-in failed' });
  }
});