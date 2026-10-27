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

});
