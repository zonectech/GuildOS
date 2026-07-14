const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
    const message = typeof payload === 'object' && payload && 'error' in payload && payload.error ? payload.error : 'Request failed';
    throw new Error(message);
  }
  return payload;
}

export type KnowledgeType = 'ARTICLE' | 'LINK' | 'FILE';
export type KnowledgeCategory =
  | 'GETTING_STARTED'
  | 'TUTORIAL'
  | 'DOCUMENTATION'
  | 'ROADMAP'
  | 'OPPORTUNITY'
  | 'PAST_QUESTIONS'
  | 'OTHER';

export const KNOWLEDGE_CATEGORIES: { value: KnowledgeCategory; label: string }[] = [
  { value: 'GETTING_STARTED', label: 'Getting Started' },
  { value: 'TUTORIAL', label: 'Tutorials' },
  { value: 'DOCUMENTATION', label: 'Documentation' },
  { value: 'ROADMAP', label: 'Roadmaps' },
  { value: 'OPPORTUNITY', label: 'Opportunities' },
  { value: 'PAST_QUESTIONS', label: 'Past Questions' },
  { value: 'OTHER', label: 'Other' },
];

export type KnowledgeResource = {
  _id: string;
  communityId: string;
  type: KnowledgeType;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  content: string;
  url: string;
  file: string;
  fileName: string;
  viewCount: number;
  downloadCount: number;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeInput = Partial<
  Pick<KnowledgeResource, 'type' | 'category' | 'title' | 'summary' | 'content' | 'url' | 'file' | 'fileName'>
>;

export async function listCommunityKnowledge(communityId: string) {
  return requestJson<{ resources: KnowledgeResource[] }>(`/api/knowledge/community/${encodeURIComponent(communityId)}`);
}

export async function getKnowledgeResource(id: string) {
  return requestJson<{ resource: KnowledgeResource }>(`/api/knowledge/${encodeURIComponent(id)}`);
}

export async function createKnowledgeResource(communityId: string, input: KnowledgeInput) {
  return requestJson<{ resource: KnowledgeResource }>(`/api/knowledge/community/${encodeURIComponent(communityId)}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateKnowledgeResource(id: string, input: KnowledgeInput) {
  return requestJson<{ resource: KnowledgeResource }>(`/api/knowledge/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteKnowledgeResource(id: string) {
  return requestJson<{ removed: boolean }>(`/api/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function uploadKnowledgeFile(file: File) {
  const data = new FormData();
  data.append('file', file);
  return requestJson<{ file: string; fileName: string }>('/api/knowledge/upload', { method: 'POST', body: data });
}

export type KnowledgeSearchResult = {
  _id: string;
  type: KnowledgeType;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  viewCount: number;
  updatedAt: string;
  communityName: string;
  communitySlug: string;
};

export async function searchKnowledge(query: string) {
  return requestJson<{ results: KnowledgeSearchResult[] }>(`/api/knowledge/search?q=${encodeURIComponent(query)}`);
}

export async function trackKnowledgeDownload(id: string) {
  return requestJson<{ tracked: boolean }>(`/api/knowledge/${encodeURIComponent(id)}/download`, { method: 'POST' });
}

export function resolveKnowledgeFileUrl(path?: string) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
