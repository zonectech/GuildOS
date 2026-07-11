const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
    ...init,
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload && payload.error ? payload.error : 'Request failed';
    throw new Error(message);
  }
  return payload;
}

export type CommunityAccessStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export async function getMyCommunityAccess() {
  return requestJson<{ status: CommunityAccessStatus; hasAccess: boolean; note: string; schoolEmail: string; schoolEmailVerified: boolean }>('/api/community-access/me');
}

export async function sendSchoolEmailCode(email: string) {
  return requestJson<{ sent: boolean }>('/api/community-access/email/send', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifySchoolEmailCode(code: string) {
  return requestJson<{ verified: boolean; email: string }>('/api/community-access/email/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function requestCommunityAccess(note = '') {
  return requestJson<{ status: CommunityAccessStatus }>('/api/community-access/request', {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

// Admin
export type CommunityAccessRequest = {
  userId: string;
  fullName: string;
  email: string;
  username: string;
  university: string;
  department: string;
  schoolEmail: string;
  schoolEmailVerified: boolean;
  note: string;
  requestedAt: string;
};

export async function getPendingCommunityAccess() {
  return requestJson<{ requests: CommunityAccessRequest[] }>('/api/admin/community-access/pending');
}

export async function approveCommunityAccess(userId: string, note = '') {
  return requestJson<{ userId: string; status: CommunityAccessStatus }>(`/api/admin/community-access/${encodeURIComponent(userId)}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ note }),
  });
}

export async function rejectCommunityAccess(userId: string, note = '') {
  return requestJson<{ userId: string; status: CommunityAccessStatus }>(`/api/admin/community-access/${encodeURIComponent(userId)}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ note }),
  });
}
