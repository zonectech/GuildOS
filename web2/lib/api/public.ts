// Public data for the pages the server renders (events, communities, profiles, certificates). Plain
// functions, not client code, so server components can call them; the browser can use them too.
import { api, ApiError, enc } from './client';
import { certificatesOf, publicProfile, stampsOf } from './profile';
import type { PassportData } from '@/components/profile/passport';

/** What a public profile page starts with: what a visitor sees, or why they can't see it. */
export type PassportInitial = { data: PassportData | null; blocked: string };

/** Someone's profile as a visitor sees it: only what they chose to share. A 403 (private) is an answer. */
export async function loadPublicPassport(username: string): Promise<PassportInitial> {
  try {
    const profile = await publicProfile(username);
    const [stamps, certificates] = await Promise.all([
      profile.showHistory ? stampsOf(username).catch(() => []) : Promise.resolve([]),
      profile.showCertificates ? certificatesOf(username).catch(() => []) : Promise.resolve([]),
    ]);
    return { data: { profile, stamps, certificates, communities: null }, blocked: '' };
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return { data: null, blocked: e.message };
    throw e;
  }
}

export type Cert = { verified: boolean; status: string; serial: string; attendeeName: string; eventTitle: string; communityName: string; university: string; type: string; issuedAt?: string };

/** Checks a certificate: who it was issued to, for which event, and whether it is still valid. */
export const verifyCertificate = (serial: string) => api<{ certificate: Cert }>(`/api/certificates/verify/${enc(serial)}`).then((r) => r.certificate);

/** A verified CV's public summary: who it belongs to and what it was built from (the full CV is the PDF). */
export type CvCheck = {
  verified: boolean; status: string; verificationId: string; ownerName: string; profileUrl?: string;
  generatedAt: string; refreshedAt: string | null; certificateCount: number; leadershipCount: number; eventCount: number;
};
export const verifyCvDocument = (id: string) => api<{ cv: CvCheck }>(`/api/cv/verify/${enc(id)}`).then((r) => r.cv);
