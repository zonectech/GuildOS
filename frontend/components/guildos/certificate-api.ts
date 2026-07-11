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

export async function issueCertificate(payload: {
  userId: string;
  communityId?: string;
  title?: string;
  description?: string;
}) {
  return requestJson<{ certificate: { id: string; title: string; description: string; userId: string; occurredAt: string } }>('/api/certificates', {
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
}) {
  return requestJson<{
    certificates: Array<{ id: string; title: string; description: string; userId: string; occurredAt: string }>;
    skipped: string[];
    issued: number;
  }>('/api/certificates/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}