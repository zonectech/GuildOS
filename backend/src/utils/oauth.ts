import { createHash, randomUUID } from 'node:crypto';
import { config } from '../config';

export type GoogleUserInfo = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
  verified_email?: boolean;
};

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Unable to verify Google account');
  }

  const profile = await response.json() as GoogleUserInfo;
  if (!profile || typeof profile.email !== 'string' || !profile.email.trim()) throw new Error('Google did not return an account email');
  // The v2 endpoint uses verified_email; normalize to the claim consumed by our callback.
  return { ...profile, email_verified: typeof profile.verified_email === 'boolean' ? profile.verified_email : profile.email_verified === true };
}

export function createGoogleState() {
  return randomUUID();
}

export function hashOAuthIdentity(provider: string, providerUserId: string) {
  return createHash('sha256').update(`${provider}:${providerUserId}:${config.jwtSecret}`).digest('hex');
}