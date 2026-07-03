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

export type GuildLevel =
  | 'Explorer Guild'
  | 'Bronze Guild'
  | 'Silver Guild'
  | 'Gold Guild'
  | 'Platinum Guild'
  | 'Elite Guild';

export type ReputationBadge = { code: string; label: string; icon: string };

export type Reputation = {
  guildScore: number;
  basePoints: number;
  attendanceScore: number;
  leadershipScore: number;
  volunteerScore: number;
  speakerScore: number;
  organizerScore: number;
  consistencyBonus: number;
  level: GuildLevel;
  nextLevelAt: number | null;
  badges: ReputationBadge[];
  lastCalculatedAt: string;
};

export type ReputationActivityEntry = {
  id: string;
  category: 'ATTENDANCE' | 'LEADERSHIP' | 'VOLUNTEER' | 'SPEAKER' | 'ORGANIZER';
  type: string;
  scoreAwarded: number;
  description: string;
  communityId: string | null;
  referenceId: string | null;
  createdAt: string;
};

export type LeaderboardScope = 'GLOBAL' | 'UNIVERSITY' | 'FACULTY' | 'DEPARTMENT' | 'COMMUNITY';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  fullName: string;
  username: string;
  avatar: string;
  university: string;
  guildScore: number;
  level: GuildLevel;
  badges: ReputationBadge[];
};

export async function getMyReputation() {
  return requestJson<{ reputation: Reputation }>('/api/reputation/me');
}

export async function getReputationActivity(limit = 50) {
  return requestJson<{ activity: ReputationActivityEntry[] }>(`/api/reputation/activity?limit=${limit}`);
}

export async function getLeaderboard(params: { scope?: LeaderboardScope; university?: string; faculty?: string; department?: string; communityId?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.scope) query.set('scope', params.scope);
  if (params.university) query.set('university', params.university);
  if (params.faculty) query.set('faculty', params.faculty);
  if (params.department) query.set('department', params.department);
  if (params.communityId) query.set('communityId', params.communityId);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return requestJson<{ leaderboard: LeaderboardEntry[] }>(`/api/reputation/leaderboard${qs ? `?${qs}` : ''}`);
}

export async function recalculateReputation() {
  return requestJson<{ reputation: Reputation }>('/api/reputation/recalculate', { method: 'POST' });
}

export type ReputationSummary = {
  reputation: Reputation;
  stats: {
    eventsCompleted: number;
    certificatesEarned: number;
    communitiesJoined: number;
    leadershipRoles: number;
  };
  rank: number | null;
};

export async function getReputationSummary(userId: string) {
  return requestJson<ReputationSummary>(`/api/reputation/${encodeURIComponent(userId)}/summary`);
}

export type ReputationInsight = { icon: string; tone: 'up' | 'info' | 'goal' | 'flat'; text: string; href?: string };

export async function getReputationInsights() {
  return requestJson<{ insights: ReputationInsight[]; guildScore: number; level: string }>('/api/reputation/insights');
}

export async function getPublicTimeline(userId: string, limit = 30) {
  return requestJson<{ activity: ReputationActivityEntry[] }>(`/api/reputation/${encodeURIComponent(userId)}/timeline?limit=${limit}`);
}

export type ProfileCertificate = {
  serial: string;
  eventTitle: string;
  communityName: string;
  type: string;
  status: 'VERIFIED' | 'REVOKED';
  verificationUrl: string;
  issuedAt: string;
};

export async function getProfileCertificates(username: string) {
  return requestJson<{ certificates: ProfileCertificate[] }>(`/api/profile/${encodeURIComponent(username)}/certificates`);
}
