import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGoogleUserInfo } from './oauth';
afterEach(() => vi.unstubAllGlobals());
function google(profile: Record<string, unknown>, ok = true) {
  const request = vi.fn(async () => ({ ok, json: async () => profile })); vi.stubGlobal('fetch', request); return request;
}
describe('Google account email verification', () => {
  it('normalizes the verified_email field returned by the configured v2 endpoint', async () => {
    const request = google({ id:'google-user', email:'member@gmail.com', name:'Member', verified_email:true });
    expect((await getGoogleUserInfo('sample-token')).email_verified).toBe(true);
    expect(request).toHaveBeenCalledWith('https://www.googleapis.com/oauth2/v2/userinfo', expect.any(Object));
  });
  it('does not verify missing, false, or non-boolean provider claims', async () => {
    for (const verified_email of [undefined, false, 'true']) {
      google({ email:'member@example.com', verified_email });
      expect((await getGoogleUserInfo('sample-token')).email_verified).toBe(false);
    }
  });
  it('accepts an explicit standard claim but keeps an explicit v2 false authoritative', async () => {
    google({ email:'member@example.com', email_verified:true });
    expect((await getGoogleUserInfo('sample-token')).email_verified).toBe(true);
    google({ email:'member@example.com', verified_email:false, email_verified:true });
    expect((await getGoogleUserInfo('sample-token')).email_verified).toBe(false);
  });
  it('rejects failed lookups and responses without an email', async () => {
    google({}, false); await expect(getGoogleUserInfo('sample-token')).rejects.toThrow(/verify Google/);
    google({ verified_email:true }); await expect(getGoogleUserInfo('sample-token')).rejects.toThrow(/account email/);
  });
});
