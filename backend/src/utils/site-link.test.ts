import { describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({ config: { frontendUrl: 'https://new.example/', legacyFrontendUrl: 'https://old.example' } }));
const { siteLink } = await import('./site-link');

describe('siteLink', () => {
  it('sends pages the new website has to the new website', () => {
    for (const path of ['/events/hack-day', '/events/hack-day?checkout=123#checkout', '/events/hack-day/attendees', '/certificates/GLD-1', '/u/amina',
      '/communities', '/communities/abu-tech', '/communities/join/tok', '/verify-email?token=a', '/reset-password?token=b', '/my-events', '/notifications',
      '/dashboard/events/create?slug=hack-day&communityId=1']) {
      expect(siteLink(path)).toBe(`https://new.example${path}`);
    }
  });

  it('keeps pages only the current site has on the current site', () => {
    for (const path of ['/events/hack-day/sponsor-report', '/dashboard/admin/verification', '/dashboard/premium?communityId=1', '/hackathon/judge/t',
      '/opportunities/9', '/posts/1', '/recruiter', '/cv', '/messages', '/communities/abu-tech/leaders', '/dashboard/wallet']) {
      expect(siteLink(path)).toBe(`https://old.example${path}`);
    }
  });

  it('accepts paths without a leading slash', () => {
    expect(siteLink('events/x')).toBe('https://new.example/events/x');
  });
});
