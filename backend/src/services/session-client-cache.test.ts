import { afterEach, describe, expect, it, vi } from 'vitest';
const user = { id: 'sample', fullName: 'Sample User', role: 'STUDENT', profile: { username: 'sample', avatar: '/uploads/photo.jpg' } };
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('shared browser user data', () => {
 it('deduplicates concurrent requests for an uncached user', async () => {
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ user }) }));
  vi.stubGlobal('fetch', fetcher);
  const api = await import('../../../frontend/components/guildos/auth-api');
  const results = await Promise.all([api.getCurrentUser(), api.getCurrentUser(), api.getCurrentUser()]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(results.every(value => value?.id === user.id)).toBe(true);
 });
 it('notifies mounted navigation when an avatar changes', async () => {
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ user }) }));
  vi.stubGlobal('fetch', fetcher);
  const api = await import('../../../frontend/components/guildos/auth-api');
  await api.getCurrentUser();
  const listener = vi.fn();
  const stop = api.subscribeCurrentUser(listener);
  fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ user: { ...user, profile: { ...user.profile, avatar: '/uploads/new.jpg' } } }) });
  await api.uploadAvatar(new FormData());
  expect(api.readCachedCurrentUser()?.profile.avatar).toBe('/uploads/new.jpg');
  expect(listener).toHaveBeenCalledOnce();
  stop();
 });
 it('does not overwrite a newly uploaded avatar with an older background response', async () => {
  let release!: (value: any) => void;
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ user }) }));
  vi.stubGlobal('fetch', fetcher);
  const api = await import('../../../frontend/components/guildos/auth-api');
  await api.getCurrentUser();
  fetcher.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const oldRequest = api.getProfile();
  fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ user: { ...user, profile: { ...user.profile, avatar: '/uploads/new.jpg' } } }) });
  await api.uploadAvatar(new FormData());
  release({ ok: true, json: async () => ({ user }) });
  await oldRequest;
  expect(api.readCachedCurrentUser()?.profile.avatar).toBe('/uploads/new.jpg');
 });

 it('saves the frontend session marker before first Google onboarding navigation', async () => {
  const storage = new Map<string,string>();
  vi.stubGlobal('window', { location: { protocol: 'https:' }, sessionStorage: { setItem: (key: string, value: string) => storage.set(key,value), getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => storage.delete(key) } });
  vi.stubGlobal('document', { cookie: '' });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ user: { ...user, profileComplete: false }, nextRoute: '/profile-setup' }) })));
  const api = await import('../../../frontend/components/guildos/auth-api');
  const result = await api.completeGoogleSignIn('code', 'state');
  expect(result.nextRoute).toBe('/profile-setup');
  expect(document.cookie).toContain('guildos_session=STUDENT');
  expect(api.readCachedCurrentUser()?.id).toBe(user.id);
 });
 it('does not establish a session from an unsuccessful Google callback', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Invalid Google response', nextRoute: '/profile-setup' }) })));
  const api = await import('../../../frontend/components/guildos/auth-api');
  await expect(api.completeGoogleSignIn('bad', 'bad')).rejects.toThrow('Invalid Google response');
  expect(api.readCachedCurrentUser()).toBeNull();
 });

});
