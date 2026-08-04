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

export type MessagePerson = { id: string; fullName: string; username: string; avatar: string; headline: string };

export type ConversationSummary = {
  id: string;
  other: MessagePerson;
  lastMessage: string;
  lastMessageAt: string | null;
  unread: number;
  kind: 'RECRUITER' | 'PEER';
};

export type ChatMessage = { id: string; senderId: string; content: string; createdAt: string; mine: boolean };

export type ConversationDetail = { id: string; other: MessagePerson; messages: ChatMessage[]; blockedByMe?: boolean };

export async function getConversations() {
  return requestJson<{ conversations: ConversationSummary[] }>('/api/messages');
}

export async function getUnreadMessageCount() {
  return requestJson<{ count: number }>('/api/messages/unread-count');
}

export async function getConversation(id: string) {
  return requestJson<{ conversation: ConversationDetail }>(`/api/messages/${encodeURIComponent(id)}`);
}

export async function sendMessage(id: string, content: string) {
  return requestJson<{ message: ChatMessage }>(`/api/messages/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function startConversation(candidateId: string) {
  return requestJson<{ conversationId: string }>('/api/messages/start', {
    method: 'POST',
    body: JSON.stringify({ candidateId }),
  });
}

/** Block severs messages + connection requests BOTH ways; silent to the blocked person. */
export async function blockUser(userId: string) {
  return requestJson<{ blocked: boolean }>(`/api/messages/block/${encodeURIComponent(userId)}`, { method: 'POST' });
}

export async function unblockUser(userId: string) {
  return requestJson<{ blocked: boolean }>(`/api/messages/block/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

/** Report a user to the platform admins (reason required). */
export async function reportUser(userId: string, reason: string) {
  return requestJson<{ reported: boolean }>(`/api/messages/report/${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function resolveMessageAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}
