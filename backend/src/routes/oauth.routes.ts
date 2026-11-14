import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import { config } from '../config';
import { authStore } from '../store/auth-store';
import { createToken } from '../utils/token';
import { createGoogleState, getGoogleUserInfo } from '../utils/oauth';

export const oauthRouter = Router();

// Remembers which site started each sign-in, so the code is exchanged with the same redirect URI.
const googleStateStore = new Map<string, string>();
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

/** The site's own callback page when it is on the allow list, otherwise the default one. */
export function pickGoogleRedirectUri(requested: unknown, allowed: string[] = config.googleRedirectUris) {
  return typeof requested === 'string' && allowed.includes(requested) ? requested : allowed[0];
}

oauthRouter.get('/google', (req, res) => {
  const redirectUri = pickGoogleRedirectUri(req.query.redirectUri);
  if (!config.googleClientId || !redirectUri) {
    return res.status(503).json({ error: 'Google sign-in is not configured' });
  }

  const state = createGoogleState();
  googleStateStore.set(state, redirectUri);

  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri,
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
    // A repeated call for a finished sign-in (a page reload or a double render) gets the same answer.
    const cachedResponse = state ? googleCallbackResponseStore.get(state) : undefined;
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    const redirectUri = state ? googleStateStore.get(state) : undefined;
    if (!code || !state || !redirectUri) {
      return res.status(400).json({ error: 'Invalid Google OAuth response' });
    }

    googleStateStore.delete(state);

    if (!config.googleClientId || !config.googleClientSecret) {
      return res.status(503).json({ error: 'Google sign-in is not configured' });
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: redirectUri,
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

    authStore.invalidatePublicUser(user.id);
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