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

export const resolveFeedImage = resolveFeedAvatar;

export type FeedTag = { type: 'USER' | 'COMMUNITY'; id: string; label: string; handle: string };

/** Search people + public communities to tag in a post. */
export async function searchMentionTargets(q: string): Promise<FeedTag[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const [peopleRes, commRes] = await Promise.allSettled([
    requestJson<{ people: Array<{ id: string; fullName: string; username: string }> }>(`/api/users/search?q=${encodeURIComponent(query)}`),
    requestJson<{ communities: Array<{ _id: string; name: string; slug: string }> }>(`/api/communities`),
  ]);
  const tags: FeedTag[] = [];
  if (peopleRes.status === 'fulfilled') {
    for (const p of peopleRes.value.people.slice(0, 5)) {
      tags.push({ type: 'USER', id: p.id, label: p.fullName, handle: p.username });
    }
  }
  if (commRes.status === 'fulfilled') {
    const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    for (const c of commRes.value.communities.filter((c) => rx.test(c.name)).slice(0, 5)) {
      tags.push({ type: 'COMMUNITY', id: c._id, label: c.name, handle: c.slug });
    }
  }
  return tags;
}

export type GuildLevel = 'Explorer Guild' | 'Bronze Guild' | 'Silver Guild' | 'Gold Guild' | 'Platinum Guild' | 'Elite Guild';

export type FeedAuthor = { id: string; fullName: string; username: string; avatar: string; headline: string; isCommunity?: boolean; level?: GuildLevel | null };
export type FeedComment = { id: string; parentId?: string | null; content: string; author: FeedAuthor; createdAt: string; replies?: FeedComment[] };

export type FeedCertificate = {
  serial: string;
  eventTitle: string;
  communityName: string;
  attendeeName: string;
  type: string;
  style: string;
  accent: string;
  eventDate: string | null;
};

export type FeedPoll = {
  options: { text: string; count: number }[];
  totalVotes: number;
  viewerVote: number | null;
};

export type FeedPost = {
  id: string;
  kind: 'TEXT' | 'MILESTONE';
  content: string;
  imageUrl: string;
  tags: FeedTag[];
  poll?: FeedPoll | null;
  /** System-set action button (e.g. "View event" on sponsor announcements). */
  cta?: { label: string; url: string } | null;
  milestone: { type: string; label: string; refId: string } | null;
  certificate?: FeedCertificate | null;
  communityId: string | null;
  communityName: string | null;
  author: FeedAuthor;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  pinned?: boolean;
  createdAt: string;
};

export type FeedScope = 'FORYOU' | 'COMMUNITIES';
export type FeedSort = 'NEW' | 'TOP' | 'HOT';

export async function getFeed(before?: string, scope: FeedScope = 'FORYOU', sort?: FeedSort) {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  if (scope === 'COMMUNITIES') params.set('scope', 'COMMUNITIES');
  if (sort) params.set('sort', sort);
  const qs = params.toString();
  return requestJson<{ posts: FeedPost[]; nextCursor: string | null }>(`/api/feed${qs ? `?${qs}` : ''}`);
}

export async function createPost(
  content: string,
  options?: { communityId?: string | null; image?: File | null; tags?: FeedTag[]; poll?: string[] },
) {
  const form = new FormData();
  form.set('content', content);
  if (options?.communityId) form.set('communityId', options.communityId);
  if (options?.image) form.set('image', options.image);
  if (options?.tags?.length) form.set('tags', JSON.stringify(options.tags.map((t) => ({ type: t.type, id: t.id }))));
  if (options?.poll?.length) form.set('poll', JSON.stringify(options.poll));
  return requestJson<{ post: FeedPost }>('/api/feed', { method: 'POST', body: form });
}

export async function createCommunityPost(
  communityId: string,
  content: string,
  options?: { image?: File | null; tags?: FeedTag[]; poll?: string[] },
) {
  const form = new FormData();
  form.set('content', content);
  if (options?.image) form.set('image', options.image);
  if (options?.tags?.length) form.set('tags', JSON.stringify(options.tags.map((t) => ({ type: t.type, id: t.id }))));
  if (options?.poll?.length) form.set('poll', JSON.stringify(options.poll));
  return requestJson<{ post: FeedPost }>(`/api/feed/community/${encodeURIComponent(communityId)}`, { method: 'POST', body: form });
}

export async function votePoll(postId: string, optionIndex: number) {
  return requestJson<{ post: FeedPost }>(`/api/feed/${encodeURIComponent(postId)}/poll/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ optionIndex }),
  });
}

export async function getCommunityPosts(communityId: string) {
  return requestJson<{ posts: FeedPost[] }>(`/api/feed/community/${encodeURIComponent(communityId)}`);
}

export async function getUserPosts(userId: string) {
  return requestJson<{ posts: FeedPost[] }>(`/api/feed/user/${encodeURIComponent(userId)}`);
}

export async function getPost(id: string) {
  return requestJson<{ post: FeedPost }>(`/api/feed/${encodeURIComponent(id)}`);
}

export async function togglePostLike(id: string) {
  return requestJson<{ liked: boolean; likeCount: number }>(`/api/feed/${encodeURIComponent(id)}/like`, { method: 'POST' });
}

export async function setPostPinned(id: string, pinned: boolean) {
  return requestJson<{ post: FeedPost }>(`/api/feed/${encodeURIComponent(id)}/pin`, {
    method: 'PATCH',
    body: JSON.stringify({ pinned }),
  });
}

export type TrendingEvent = { id: string; title: string; slug: string; startDate: string | null; venue: string; mode: string; registrationCount: number };
export type TrendingCommunity = { id: string; name: string; slug: string; logo: string; memberCount: number; newMembers: number };

export async function getTrending() {
  return requestJson<{ events: TrendingEvent[]; communities: TrendingCommunity[] }>('/api/feed/trending');
}

export async function getPostComments(id: string) {
  return requestJson<{ comments: FeedComment[] }>(`/api/feed/${encodeURIComponent(id)}/comments`);
}

export async function addPostComment(id: string, content: string, parentId?: string | null) {
  return requestJson<{ comment: FeedComment }>(`/api/feed/${encodeURIComponent(id)}/comments`, { method: 'POST', body: JSON.stringify({ content, parentId: parentId ?? undefined }) });
}

export async function deletePost(id: string) {
  return requestJson<{ message: string }>(`/api/feed/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function editPost(id: string, content: string) {
  return requestJson<{ post: FeedPost }>(`/api/feed/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export async function reportContent(targetType: 'POST' | 'COMMENT', targetId: string, reason = '') {
  return requestJson<{ reported: boolean; already: boolean }>('/api/feed/report', {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId, reason }),
  });
}
