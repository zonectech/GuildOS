import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies a correct password', () => {
    const { salt, hash } = hashPassword('S3cret!pass');
    expect(verifyPassword('S3cret!pass', salt, hash)).toBe(true);
  });

  it('rejects an incorrect password', () => {
    const { salt, hash } = hashPassword('S3cret!pass');
    expect(verifyPassword('wrong-password', salt, hash)).toBe(false);
  });

  it('rejects verification when the salt is missing', () => {
    const { hash } = hashPassword('S3cret!pass');
    expect(verifyPassword('S3cret!pass', null, hash)).toBe(false);
    expect(verifyPassword('S3cret!pass', undefined, hash)).toBe(false);
  });

  it('produces a unique salt and hash per call for the same password', () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('rejects a malformed / wrong-length hash without throwing', () => {
    const { salt } = hashPassword('S3cret!pass');
    expect(verifyPassword('S3cret!pass', salt, 'deadbeef')).toBe(false);
  });
});
