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

export type ConnectionState = 'NONE' | 'PENDING_OUTGOING' | 'PENDING_INCOMING' | 'CONNECTED' | 'SELF';

export type ConnectionPerson = { id: string; fullName: string; username: string; avatar: string; headline: string };
export type SuggestedPerson = ConnectionPerson & { reason: string };
export type PendingRequest = { requester: ConnectionPerson; createdAt: string };

export async function getConnections() {
  return requestJson<{ connections: ConnectionPerson[]; count: number }>('/api/connections');
}

export async function getConnectionRequests() {
  return requestJson<{ requests: PendingRequest[] }>('/api/connections/requests');
}

export async function getPeopleYouMayKnow(limit = 12) {
  return requestJson<{ suggestions: SuggestedPerson[] }>(`/api/connections/suggestions?limit=${limit}`);
}

export async function getConnectionState(userId: string) {
  return requestJson<{ state: ConnectionState; mutual: number }>(`/api/connections/state/${encodeURIComponent(userId)}`);
}

export async function sendConnectionRequest(userId: string) {
  return requestJson<{ state: ConnectionState }>(`/api/connections/${encodeURIComponent(userId)}/request`, { method: 'POST' });
}

export async function respondToConnection(userId: string, accept: boolean) {
  return requestJson<{ state: ConnectionState }>(`/api/connections/${encodeURIComponent(userId)}/respond`, {
    method: 'POST',
    body: JSON.stringify({ accept }),
  });
}

export async function removeConnection(userId: string) {
  return requestJson<{ state: ConnectionState }>(`/api/connections/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export function resolvePersonAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}
