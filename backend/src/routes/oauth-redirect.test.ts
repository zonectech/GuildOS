import { describe, expect, it } from 'vitest';
import { pickGoogleRedirectUri } from './oauth.routes';

const allowed = ['http://localhost:3000/oauth/google/callback', 'http://localhost:3002/oauth/google/callback'];

describe('pickGoogleRedirectUri', () => {
  it('sends people back to the site that started sign-in', () => {
    expect(pickGoogleRedirectUri(allowed[1], allowed)).toBe(allowed[1]);
  });

  it('falls back to the default for anything not on the list', () => {
    expect(pickGoogleRedirectUri('https://evil.example/oauth/google/callback', allowed)).toBe(allowed[0]);
    expect(pickGoogleRedirectUri(undefined, allowed)).toBe(allowed[0]);
    expect(pickGoogleRedirectUri(['x'], allowed)).toBe(allowed[0]);
  });

  it('is unset when no callback is configured', () => {
    expect(pickGoogleRedirectUri(allowed[0], [])).toBeUndefined();
  });
});
