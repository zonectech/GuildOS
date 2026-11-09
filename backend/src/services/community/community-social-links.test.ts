import { describe, expect, it } from 'vitest';
import { normalizeSocialLink } from './community-core.service';
import { COMMUNITY_ACCENTS, CommunityModel } from '../../models/community.model';

describe('community social links', () => {
  it('turns a handle into a profile URL', () => {
    expect(normalizeSocialLink('@aibuilders', 'instagram')).toBe('https://instagram.com/aibuilders');
    expect(normalizeSocialLink('ai.builders_abu', 'x')).toBe('https://x.com/ai.builders_abu');
  });
  it('keeps a profile URL on the right site and tidies it', () => {
    expect(normalizeSocialLink('https://www.instagram.com/aibuilders/', 'instagram')).toBe('https://instagram.com/aibuilders');
    expect(normalizeSocialLink('twitter.com/aibuilders', 'x')).toBe('https://x.com/aibuilders');
  });
  it('empty clears the link', () => {
    expect(normalizeSocialLink('  ', 'x')).toBe('');
    expect(normalizeSocialLink(undefined, 'instagram')).toBe('');
  });
  it('refuses links to other sites', () => {
    expect(() => normalizeSocialLink('https://evil.example.com/aibuilders', 'instagram')).toThrow(/Instagram/);
    expect(() => normalizeSocialLink('https://instagram.com/x', 'x')).toThrow(/X handle/);
    expect(() => normalizeSocialLink('https://x.com/', 'x')).toThrow(/X handle/);
  });
});

describe('community accent colour', () => {
  it('defaults to green and only accepts the presets', () => {
    const c = new CommunityModel({});
    expect(c.accentColor).toBe('green');
    expect(c.socialLinks).toMatchObject({ instagram: '', x: '' });
    c.accentColor = 'hotpink' as never;
    expect(c.validateSync()?.errors.accentColor).toBeTruthy();
    expect(COMMUNITY_ACCENTS).toContain('coral');
  });
});
