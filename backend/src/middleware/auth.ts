import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../types';
import { authStore } from '../store/auth-store';
import { UserModel } from '../models/user.model';
import { verifyToken } from '../utils/token';

export type AuthenticatedRequest = Request & {
  user?: Awaited<ReturnType<typeof authStore.getPublicUserById>>;
  userId?: string;
  file?: Express.Multer.File;
};

function getBearerToken(req: Request) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

function getAccessToken(req: Request) {
  return req.cookies?.guildos_access_token as string | undefined ?? getBearerToken(req) ?? null;
}

async function attachUser(req: AuthenticatedRequest, token: string) {
  const payload = verifyToken(token);
  if (!payload || payload.purpose !== 'access') {
    return null;
  }

  const user = await authStore.getActivePublicUserById(payload.sub);
  if (!user) {
    return null;
  }

  req.userId = user.id;
  req.user = user;
  touchLastActive(user.id);
  return user;
}

/** Throttled activity stamp (~hourly per user, fire-and-forget) — powers active-user metrics. */
const ACTIVE_STAMP_MS = 60 * 60 * 1000;
const lastStamped = new Map<string, number>();
function touchLastActive(userId: string) {
  const now = Date.now();
  if ((lastStamped.get(userId) ?? 0) > now - ACTIVE_STAMP_MS) return;
  lastStamped.set(userId, now);
  // Bounded memory: reset the throttle map if it somehow grows huge.
  if (lastStamped.size > 50_000) lastStamped.clear();
  void UserModel.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date() } }).catch(() => undefined);
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = getAccessToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const user = await attachUser(req, token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  return next();
}

export async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = getAccessToken(req);
  if (token) {
    await attachUser(req, token);
  }
  return next();
}

export async function requireDashboardAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = getAccessToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const user = await attachUser(req, token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (!user.emailVerified) {
    return res.status(403).json({ error: 'Email verification required' });
  }

  if (!user.profileComplete) {
    return res.status(403).json({ error: 'Complete your profile first' });
  }

  return next();
}

export function requireRole(allowedRoles: UserRole | UserRole[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    return next();
  };
}
