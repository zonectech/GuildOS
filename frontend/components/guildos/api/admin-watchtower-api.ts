const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
    ...init,
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(typeof payload === 'object' && payload && 'error' in payload && payload.error ? payload.error : 'Request failed');
  }
  return payload;
}

export type WatchSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type WatchType = 'COMMUNITY' | 'ENDORSEMENT' | 'MEMBERSHIP' | 'CERTIFICATE' | 'OPPORTUNITY';
export type WatchEntityType = 'COMMUNITY' | 'USER' | 'OPPORTUNITY' | 'NONE';
export type WatchAction = 'VERIFY_COMMUNITY' | 'REJECT_COMMUNITY' | 'FLAG_OPPORTUNITY' | 'ARCHIVE_OPPORTUNITY';

export type WatchAlert = {
  id: string;
  type: WatchType;
  severity: WatchSeverity;
  title: string;
  detail: string;
  entityType: WatchEntityType;
  entityId: string;
  entityLabel: string;
  link: string;
  signals: string[];
  actions: WatchAction[];
  occurredAt: string;
  status: 'OPEN' | 'SNOOZED';
};

export type WatchtowerSummary = {
  total: number;
  high: number;
  medium: number;
  low: number;
  dismissed: number;
  byType: Record<WatchType, number>;
};

export type WatchtowerResponse = {
  alerts: WatchAlert[];
  summary: WatchtowerSummary;
};

export async function getWatchtower(includeResolved = false) {
  return requestJson<WatchtowerResponse>(`/api/admin/watchtower${includeResolved ? '?includeResolved=true' : ''}`);
}

export async function getWatchtowerSummary() {
  return requestJson<{ summary: WatchtowerSummary }>('/api/admin/watchtower/summary');
}

export async function dismissWatchAlert(alertKey: string) {
  return requestJson<{ alertKey: string; status: string }>(`/api/admin/watchtower/${encodeURIComponent(alertKey)}/dismiss`, { method: 'POST' });
}

export async function snoozeWatchAlert(alertKey: string, days = 7) {
  return requestJson<{ alertKey: string; status: string }>(`/api/admin/watchtower/${encodeURIComponent(alertKey)}/snooze`, {
    method: 'POST',
    body: JSON.stringify({ days }),
  });
}

export async function reopenWatchAlert(alertKey: string) {
  return requestJson<{ alertKey: string; status: string }>(`/api/admin/watchtower/${encodeURIComponent(alertKey)}/reopen`, { method: 'POST' });
}

export async function runWatchAction(payload: { action: WatchAction; entityId: string; alertKey?: string; notes?: string }) {
  return requestJson<{ ok: boolean }>('/api/admin/watchtower/action', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export const ACTION_LABEL: Record<WatchAction, string> = {
  VERIFY_COMMUNITY: 'Verify',
  REJECT_COMMUNITY: 'Reject',
  FLAG_OPPORTUNITY: 'Flag',
  ARCHIVE_OPPORTUNITY: 'Archive',
};
