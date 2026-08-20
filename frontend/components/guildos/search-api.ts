const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type SearchPerson = {
  id: string;
  fullName: string;
  username: string;
  avatar: string;
  headline: string;
};

export type SearchCommunity = {
  _id: string;
  slug: string;
  name: string;
  logo: string;
  description: string;
};

export type SearchEvent = {
  _id: string;
  slug: string;
  title: string;
  shortDescription: string;
  startDate: string | null;
  status: string;
  mode: string;
};

export type SearchOpportunity = {
  id: string;
  title: string;
  organization?: string;
  location?: string;
};

export type SearchKnowledge = {
  _id: string;
  type: string;
  category: string;
  title: string;
  summary: string;
  communityName: string;
  communitySlug: string;
};

export type UnifiedSearchResults = {
  people: SearchPerson[];
  communities: SearchCommunity[];
  events: SearchEvent[];
  opportunities: SearchOpportunity[];
  knowledge: SearchKnowledge[];
};

export async function unifiedSearch(q: string): Promise<UnifiedSearchResults> {
  const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(q)}`, {
    credentials: 'include',
  });
  const payload = (await response.json().catch(() => ({}))) as UnifiedSearchResults & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Search failed');
  }
  return payload;
}
