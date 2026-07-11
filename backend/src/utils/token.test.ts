import { describe, it, expect } from 'vitest';
import { createToken, verifyToken, hashToken, createRandomToken } from './token';

const payload = { sub: 'user-123', purpose: 'access', jti: 'jti-1' } as const;

describe('auth tokens', () => {
  it('round-trips a signed token', () => {
    const token = createToken({ ...payload }, 60_000);
    const decoded = verifyToken(token);
    expect(decoded?.sub).toBe('user-123');
    expect(decoded?.purpose).toBe('access');
    expect(decoded?.jti).toBe('jti-1');
  });

  it('returns null for a tampered token', () => {
    const token = createToken({ ...payload }, 60_000);
    expect(verifyToken(`${token}tampered`)).toBeNull();
  });

  it('returns null for an expired token', async () => {
    // ttl clamps to a 1s minimum, so wait just over a second for expiry.
    const token = createToken({ ...payload }, 1);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(verifyToken(token)).toBeNull();
  });

  it('hashToken is deterministic and collision-sensitive', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });

  it('createRandomToken returns unique values', () => {
    expect(createRandomToken()).not.toBe(createRandomToken());
  });
});
