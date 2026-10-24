const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
    ...init,
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const errorMessage = typeof payload === 'object' && payload && 'error' in payload && payload.error ? payload.error : 'Request failed';
    throw new Error(errorMessage);
  }

  return payload;
}

export type CommunityCertificateType = 'COMPLETION' | 'LEADERSHIP' | 'VOLUNTEER' | 'ATTENDANCE';

/** A certificate a community issued directly (saved and QR-verifiable at /certificates/<serial>). */
export type IssuedCommunityCertificate = {
  serial: string;
  userId: string | null;
  recipientName: string;
  title: string;
  description: string;
  type: CommunityCertificateType;
  issuedAt: string;
  status: 'VERIFIED' | 'REVOKED' | 'EXPIRED' | 'INVALID';
};

export async function issueCertificate(payload: { userId: string; communityId: string; title?: string; description?: string; type?: CommunityCertificateType }) {
  return requestJson<{ certificate: IssuedCommunityCertificate }>('/api/certificates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function issueCertificatesBulk(payload: {
  communityId: string;
  userIds?: string[];
  role?: string;
  title?: string;
  description?: string;
  type?: CommunityCertificateType;
}) {
  return requestJson<{ certificates: IssuedCommunityCertificate[]; skipped: string[]; issued: number }>('/api/certificates/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listCommunityCertificates(communityId: string) {
  return requestJson<{ certificates: IssuedCommunityCertificate[] }>('/api/certificates/community/' + encodeURIComponent(communityId));
}
