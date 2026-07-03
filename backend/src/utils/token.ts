import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { AuthTokenPayload, AuthTokenPurpose } from '../types';

export function createToken(payload: Omit<AuthTokenPayload, 'exp'>, ttlMs: number) {
  return jwt.sign({ ...payload }, config.jwtSecret, {
    expiresIn: Math.max(1, Math.floor(ttlMs / 1000)),
  });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function createRandomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function isTokenPurpose(value: string, purpose: AuthTokenPurpose): boolean {
  return value === purpose;
}
