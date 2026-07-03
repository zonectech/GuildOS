import { createHash, randomUUID } from 'node:crypto';
import { config } from '../config';

export type GoogleUserInfo = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
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

  return response.json() as Promise<GoogleUserInfo>;
}

export function createGoogleState() {
  return randomUUID();
}

export function hashOAuthIdentity(provider: string, providerUserId: string) {
  return createHash('sha256').update(`${provider}:${providerUserId}:${config.jwtSecret}`).digest('hex');
}