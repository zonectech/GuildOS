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

export async function getFollowedCommunityIds() {
  return requestJson<{ communityIds: string[] }>('/api/follow');
}

export async function toggleCommunityFollow(communityId: string) {
  return requestJson<{ following: boolean }>(`/api/follow/${encodeURIComponent(communityId)}`, { method: 'POST' });
}
