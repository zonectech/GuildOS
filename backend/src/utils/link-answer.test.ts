import { describe, expect, it } from 'vitest';
import { normalizeLinkAnswer, profileLinkFor } from './link-answer';

describe('normalizeLinkAnswer', () => {
  it('turns handles into profile links', () => {
    expect(normalizeLinkAnswer('GITHUB', '@ada-dev', 'GitHub')).toBe('https://github.com/ada-dev');
    expect(normalizeLinkAnswer('X', 'ada_codes', 'X')).toBe('https://x.com/ada_codes');
    expect(normalizeLinkAnswer('LINKEDIN', 'ada-obi', 'LinkedIn')).toBe('https://www.linkedin.com/in/ada-obi');
  });

  it('accepts bare and full URLs on the right site, upgrading to https', () => {
    expect(normalizeLinkAnswer('LINKEDIN', 'linkedin.com/in/ada-obi/', 'LinkedIn')).toBe('https://linkedin.com/in/ada-obi');
    expect(normalizeLinkAnswer('LINKEDIN', 'http://ng.linkedin.com/in/ada', 'LinkedIn')).toBe('https://ng.linkedin.com/in/ada');
    expect(normalizeLinkAnswer('X', 'https://twitter.com/ada', 'X')).toBe('https://twitter.com/ada');
    expect(normalizeLinkAnswer('WEBSITE', 'ada.dev', 'Portfolio')).toBe('https://ada.dev');
  });

  it('rejects the wrong site, non-profile paths and unsafe schemes', () => {
    expect(() => normalizeLinkAnswer('GITHUB', 'https://gitlab.com/ada', 'GitHub')).toThrow(/GitHub profile link/);
    expect(() => normalizeLinkAnswer('LINKEDIN', 'https://linkedin.com/feed', 'LinkedIn')).toThrow(/LinkedIn/);
    expect(() => normalizeLinkAnswer('LINKEDIN', 'https://evil-linkedin.com/in/ada', 'LinkedIn')).toThrow();
    expect(() => normalizeLinkAnswer('WEBSITE', 'javascript:alert(1)', 'Portfolio')).toThrow(/valid website/);
    expect(() => normalizeLinkAnswer('WEBSITE', 'not a link', 'Portfolio')).toThrow();
  });

  it('leaves blank answers blank', () => {
    expect(normalizeLinkAnswer('GITHUB', '   ', 'GitHub')).toBe('');
  });
});

describe('profileLinkFor', () => {
  it('finds the matching platform link in a profile', () => {
    const links = ['@ada', 'https://x.com/ada', 'github.com/ada-dev', 'https://linkedin.com/posts/123'];
    expect(profileLinkFor('GITHUB', links)).toBe('https://github.com/ada-dev');
    expect(profileLinkFor('X', links)).toBe('https://x.com/ada');
    expect(profileLinkFor('LINKEDIN', links)).toBe(''); // a post, not a profile
    expect(profileLinkFor('WEBSITE', links)).toBe('');
  });
});
