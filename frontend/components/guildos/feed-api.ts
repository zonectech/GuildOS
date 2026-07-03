const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(init?.headers ?? {}) },
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

export function resolveFeedAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}

export type FeedAuthor = { id: string; fullName: string; username: string; avatar: string; headline: string; isCommunity?: boolean };
export type FeedComment = { id: string; content: string; author: FeedAuthor; createdAt: string };

export type FeedPost = {
  id: string;
  kind: 'TEXT' | 'MILESTONE';
  content: string;
  milestone: { type: string; label: string; refId: string } | null;
  communityId: string | null;
  communityName: string | null;
  author: FeedAuthor;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  createdAt: string;
};

export type FeedScope = 'FORYOU' | 'COMMUNITIES';

export async function getFeed(before?: string, scope: FeedScope = 'FORYOU') {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  if (scope === 'COMMUNITIES') params.set('scope', 'COMMUNITIES');
  const qs = params.toString();
  return requestJson<{ posts: FeedPost[]; nextCursor: string | null }>(`/api/feed${qs ? `?${qs}` : ''}`);
}

export async function createPost(content: string, communityId?: string | null) {
  return requestJson<{ post: FeedPost }>('/api/feed', { method: 'POST', body: JSON.stringify({ content, communityId }) });
}

export async function createCommunityPost(communityId: string, content: string) {
  return requestJson<{ post: FeedPost }>(`/api/feed/community/${encodeURIComponent(communityId)}`, { method: 'POST', body: JSON.stringify({ content }) });
}

export async function getCommunityPosts(communityId: string) {
  return requestJson<{ posts: FeedPost[] }>(`/api/feed/community/${encodeURIComponent(communityId)}`);
}

export async function getUserPosts(userId: string) {
  return requestJson<{ posts: FeedPost[] }>(`/api/feed/user/${encodeURIComponent(userId)}`);
}

export async function togglePostLike(id: string) {
  return requestJson<{ liked: boolean; likeCount: number }>(`/api/feed/${encodeURIComponent(id)}/like`, { method: 'POST' });
}

export async function getPostComments(id: string) {
  return requestJson<{ comments: FeedComment[] }>(`/api/feed/${encodeURIComponent(id)}/comments`);
}

export async function addPostComment(id: string, content: string) {
  return requestJson<{ comment: FeedComment }>(`/api/feed/${encodeURIComponent(id)}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
}

export async function deletePost(id: string) {
  return requestJson<{ message: string }>(`/api/feed/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
