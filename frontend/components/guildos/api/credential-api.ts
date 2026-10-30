const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type ExternalCredential = {
  id: string;
  title: string;
  issuer: string;
  issueDate: string | null;
  fileUrl: string;
  fileName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

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

export async function getMyCredentials() {
  return requestJson<{ credentials: ExternalCredential[] }>('/api/credentials/mine');
}

export async function getUserCredentials(username: string) {
  return requestJson<{ credentials: ExternalCredential[] }>('/api/credentials/user/' + encodeURIComponent(username));
}

export async function uploadCredentialFile(payload: FormData) {
  return requestJson<{ file: string; fileName: string }>('/api/credentials/upload', {
    method: 'POST',
    body: payload,
  });
}

export async function createCredential(payload: {
  title: string;
  issuer?: string;
  issueDate?: string | null;
  fileUrl?: string;
  fileName?: string;
  description?: string;
}) {
  return requestJson<{ credential: ExternalCredential }>('/api/credentials', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCredential(id: string, payload: {
  title: string;
  issuer?: string;
  issueDate?: string | null;
  fileUrl?: string;
  fileName?: string;
  description?: string;
}) {
  return requestJson<{ credential: ExternalCredential }>('/api/credentials/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteCredential(id: string) {
  return requestJson<{ message: string }>('/api/credentials/' + encodeURIComponent(id), {
    method: 'DELETE',
  });
}

export function resolveCredentialFileUrl(fileUrl: string) {
  if (!fileUrl) return '';
  if (fileUrl.startsWith('http')) return fileUrl;
  return `${API_BASE_URL}${fileUrl}`;
}
