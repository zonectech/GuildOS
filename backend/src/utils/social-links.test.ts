import { describe, expect, it } from 'vitest';
import {
  MAX_SOCIAL_LINKS,
  SocialLinksValidationError,
  sanitizeSocialLinks,
} from './social-links';

describe('social link sanitization', () => {
  it('trims links, removes blanks, and de-duplicates case-insensitively', () => {
    expect(sanitizeSocialLinks(['  github.com/user  ', '', 'GITHUB.COM/USER/'])).toEqual([
      'github.com/user',
    ]);
  });

  it('accepts safe HTTP links, domain links, and bare handles', () => {
    expect(sanitizeSocialLinks([
      'https://linkedin.com/in/student',
      'x.com/student',
      '@student_name',
    ])).toHaveLength(3);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,bad',
    'ftp://example.com/file',
    'https://user:password@example.com',
    '/relative/path',
    'not-a-link',
    '@bad handle',
  ])('rejects unsafe or malformed value %s', (value) => {
    expect(() => sanitizeSocialLinks([value])).toThrow(SocialLinksValidationError);
  });

  it('rejects non-array and non-string input', () => {
    expect(() => sanitizeSocialLinks('github.com/user')).toThrow('must be a list');
    expect(() => sanitizeSocialLinks([42])).toThrow('must be text');
  });

  it('enforces the maximum number of links', () => {
    const links = Array.from({ length: MAX_SOCIAL_LINKS + 1 }, (_, index) => `example${index}.com`);
    expect(() => sanitizeSocialLinks(links)).toThrow(`No more than ${MAX_SOCIAL_LINKS}`);
  });
});
