import { describe, expect, it, vi } from 'vitest';
import { requireSameSiteOrigin } from './security';

const guard = requireSameSiteOrigin(['https://ontheroll.app', 'http://localhost:3003/']);
const run = (method: string, headers: Record<string, string>, cookies: Record<string, string> = { guildos_access_token: 't' }) => {
  const next = vi.fn(); const json = vi.fn(); const res = { status: vi.fn(() => ({ json })) };
  guard({ method, headers, cookies } as never, res as never, next);
  return next.mock.calls.length ? 'allowed' : `blocked ${res.status.mock.calls[0]?.[0]}`;
};

describe('cross-site request guard', () => {
  it('lets our own sites change things', () => {
    expect(run('POST', { origin: 'https://ontheroll.app' })).toBe('allowed');
    expect(run('DELETE', { origin: 'http://localhost:3003' })).toBe('allowed');
    expect(run('PATCH', { referer: 'https://ontheroll.app/me/edit' })).toBe('allowed');
  });
  it('blocks another site, a look-alike host, and a cookie request that names no source', () => {
    expect(run('POST', { origin: 'https://evil.example' })).toBe('blocked 403');
    expect(run('POST', { origin: 'https://ontheroll.app.evil.example' })).toBe('blocked 403');
    expect(run('POST', { referer: 'https://evil.example/?https://ontheroll.app' })).toBe('blocked 403');
    expect(run('POST', {})).toBe('blocked 403');
  });
  it('never gets in the way of reading, or of clients that do not use cookies', () => {
    expect(run('GET', { origin: 'https://evil.example' })).toBe('allowed');
    expect(run('POST', { origin: 'https://evil.example' }, {})).toBe('allowed');
    expect(run('POST', {}, {})).toBe('allowed');
  });
});
