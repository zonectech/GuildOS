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

export type NotificationType = 'POST_LIKE' | 'POST_COMMENT' | 'COMMUNITY_FOLLOW' | 'CERTIFICATE_EARNED' | 'JOIN_APPROVED' | 'SYSTEM';

export type NotificationActor = { id: string; fullName: string; avatar: string; username: string };

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
  actor: NotificationActor | null;
};

export async function getNotifications(before?: string) {
  const qs = before ? `?before=${encodeURIComponent(before)}` : '';
  return requestJson<{ notifications: AppNotification[]; nextCursor: string | null }>(`/api/notifications${qs}`);
}

export async function getUnreadCount() {
  return requestJson<{ count: number }>('/api/notifications/unread-count');
}

export async function markNotificationRead(id: string) {
  return requestJson<{ ok: boolean }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead() {
  return requestJson<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' });
}

export function resolveNotifAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}
