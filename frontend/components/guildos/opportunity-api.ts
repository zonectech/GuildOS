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

export type OpportunityCategory = 'INTERNSHIP' | 'SCHOLARSHIP' | 'FELLOWSHIP' | 'CAMPUS_ROLE' | 'COMPETITION' | 'CONFERENCE' | 'OPEN_SOURCE';
export type OpportunityAction = 'SAVED' | 'INTERESTED' | 'APPLIED' | 'NOT_RELEVANT';

export type Opportunity = {
  id: string;
  title: string;
  description: string;
  category: OpportunityCategory;
  organization: string;
  location: string;
  deadline: string | null;
  tags: string[];
  applicationUrl: string;
  saveCount: number;
  applyCount: number;
  reportCount?: number;
  recruiterVerified?: boolean;
  matchScore: number | null;
  matchReason?: string;
  reasons: string[];
  action: OpportunityAction | null;
};

export type Recommendations = {
  recommended: Opportunity[];
  stretch: Opportunity[];
  nearDeadline: Opportunity[];
  trending: Opportunity[];
};

export const OPPORTUNITY_CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  INTERNSHIP: 'Internship',
  SCHOLARSHIP: 'Scholarship',
  FELLOWSHIP: 'Fellowship',
  CAMPUS_ROLE: 'Campus Role',
  COMPETITION: 'Competition',
  CONFERENCE: 'Conference',
  OPEN_SOURCE: 'Open Source',
};

export function matchTier(score: number | null): { label: string; tone: string } {
  if (score === null) return { label: '', tone: '' };
  if (score >= 90) return { label: 'Excellent match', tone: 'bg-emerald-100 text-emerald-700' };
  if (score >= 75) return { label: 'Strong match', tone: 'bg-teal-100 text-teal-700' };
  if (score >= 50) return { label: 'Moderate match', tone: 'bg-amber-100 text-amber-700' };
  return { label: 'Low relevance', tone: 'bg-slate-100 text-slate-600' };
}

export async function getRecommendedOpportunities() {
  return requestJson<Recommendations>('/api/opportunities/recommended');
}

export async function listOpportunities(params: { category?: string; search?: string } = {}) {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.search) query.set('search', params.search);
  const qs = query.toString();
  return requestJson<{ opportunities: Opportunity[] }>(`/api/opportunities${qs ? `?${qs}` : ''}`);
}

export async function getOpportunity(id: string) {
  return requestJson<{ opportunity: Opportunity }>(`/api/opportunities/${encodeURIComponent(id)}`);
}

export async function saveOpportunity(id: string) {
  return requestJson<{ opportunityId: string; action: OpportunityAction }>(`/api/opportunities/${encodeURIComponent(id)}/save`, { method: 'POST' });
}

export async function reportOpportunity(id: string, reason: string) {
  return requestJson<{ opportunityId: string; reportCount: number; flagged: boolean }>(`/api/opportunities/${encodeURIComponent(id)}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function setOpportunityAction(id: string, action: OpportunityAction) {
  return requestJson<{ opportunityId: string; action: OpportunityAction }>(`/api/opportunities/${encodeURIComponent(id)}/apply-status`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export async function getMyMatches() {
  return requestJson<{ matches: Opportunity[] }>('/api/opportunities/matches');
}

export async function getSavedOpportunities() {
  return requestJson<{ opportunities: Opportunity[] }>('/api/opportunities/saved');
}

export type ModerationOpportunity = Opportunity & { moderationStatus: string; source?: string; postedBy?: string | null; createdAt?: string };

export async function getModerationQueue() {
  return requestJson<{ opportunities: ModerationOpportunity[] }>('/api/opportunities/moderation/pending');
}

export async function setOpportunityModeration(id: string, status: 'PENDING_REVIEW' | 'VERIFIED' | 'FLAGGED' | 'ARCHIVED') {
  return requestJson<{ id: string; moderationStatus: string }>(`/api/opportunities/${encodeURIComponent(id)}/moderation`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export type IngestSummary = { provider: string; enabled: boolean; fetched: number; created: number; updated: number };

export async function syncOpportunities() {
  return requestJson<{ summaries: IngestSummary[]; created: number; updated: number }>('/api/opportunities/sync', { method: 'POST' });
}
