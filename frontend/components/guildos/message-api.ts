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

/** Quoted original a message replies to (content trimmed server-side; '' when since deleted). */
export type ChatReplyRef = { id: string; content: string; senderId: string; deleted?: boolean };

export type ChatMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  mine: boolean;
  /** Soft-deleted — render a placeholder, the words are gone from view (but kept in the DB). */
  deleted?: boolean;
  /** The sender edited it — show the newest text + an "edited" mark. */
  edited?: boolean;
  replyTo?: ChatReplyRef | null;
};

export type ConversationDetail = { id: string; other: MessagePerson; messages: ChatMessage[]; blockedByMe?: boolean; disappearAfterHours?: number };

export async function getConversations() {
  return requestJson<{ conversations: ConversationSummary[] }>('/api/messages');
}

export async function getUnreadMessageCount() {
  return requestJson<{ count: number }>('/api/messages/unread-count');
}

export async function getConversation(id: string) {
  return requestJson<{ conversation: ConversationDetail }>(`/api/messages/${encodeURIComponent(id)}`);
}

export async function sendMessage(id: string, content: string, replyTo?: string) {
  return requestJson<{ message: ChatMessage }>(`/api/messages/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({ content, ...(replyTo ? { replyTo } : {}) }),
  });
}

/** Edit an own message — the server keeps every prior version, readers see the newest. */
export async function editMessage(messageId: string, content: string) {
  return requestJson<{ message: { id: string; content: string; editedAt: string } }>(`/api/messages/single/${encodeURIComponent(messageId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

/** Soft delete — scope 'everyone' shows a placeholder to both sides (own messages only);
 *  scope 'me' hides any message from YOUR view only. The record stays in the database. */
export async function deleteMessage(messageId: string, scope: 'everyone' | 'me' = 'everyone') {
  return requestJson<{ id: string; deleted?: true; hidden?: true }>(`/api/messages/single/${encodeURIComponent(messageId)}?scope=${scope}`, { method: 'DELETE' });
}

/** Disappearing messages for one conversation: 0 = off, 24 = a day, 168 = a week. */
export async function setDisappearingMessages(conversationId: string, disappearAfterHours: number) {
  return requestJson<{ conversationId: string; disappearAfterHours: number }>(`/api/messages/${encodeURIComponent(conversationId)}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({ disappearAfterHours }),
  });
}

/** Spam control: whether recruiters may DM this account without a connection. */
export async function setRecruiterDmPreference(allow: boolean) {
  return requestJson<{ user: unknown }>('/api/profile/privacy', {
    method: 'PATCH',
    body: JSON.stringify({ allowRecruiterMessages: allow }),
  });
}

/** Account-wide preference: what the delete button does ('EVERYONE' placeholder both sides / 'ME' hide for self). */
export async function setMessageDeleteScopePreference(scope: 'EVERYONE' | 'ME') {
  return requestJson<{ user: unknown }>('/api/profile/privacy', {
    method: 'PATCH',
    body: JSON.stringify({ messageDeleteScope: scope }),
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
