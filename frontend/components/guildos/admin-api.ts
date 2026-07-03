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

export type PendingCommunity = {
  _id: string;
  name: string;
  university: string;
  category: string;
  verificationMethod: 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL' | null;
  verificationNotes: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
};

export async function getPendingCommunities() {
  return requestJson<{ communities: PendingCommunity[] }>('/api/admin/communities/pending');
}

export async function verifyCommunity(id: string, notes = '') {
  return requestJson<{ community: PendingCommunity }>(`/api/admin/communities/${encodeURIComponent(id)}/verify`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
}

export async function rejectCommunity(id: string, notes = '') {
  return requestJson<{ community: PendingCommunity }>(`/api/admin/communities/${encodeURIComponent(id)}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
}

export type PlatformAnalytics = {
  labels: string[];
  series: {
    attendance: number[];
    events: number[];
    memberships: number[];
    certificates: number[];
  };
  totals: {
    users: number;
    communities: number;
    events: number;
    certificates: number;
    opportunities: number;
    checkIns: number;
  };
};

export async function getPlatformAnalytics(months = 8) {
  return requestJson<{ analytics: PlatformAnalytics }>(`/api/admin/analytics/overview?months=${months}`);
}

export type AdminUserRole = 'STUDENT' | 'COMMUNITY_LEADER' | 'RECRUITER' | 'ADMIN';

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: AdminUserRole;
  emailVerified: boolean;
  createdAt: string;
};

export async function searchAdminUsers(search = '') {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return requestJson<{ users: AdminUser[] }>(`/api/admin/users${qs}`);
}

export async function setUserRole(userId: string, role: AdminUserRole) {
  return requestJson<{ user: { id: string; role: AdminUserRole } }>(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export type DemoSeedSummary = {
  alreadySeeded: boolean;
  students: number;
  communities: number;
  memberships: number;
  events: number;
  recruiters: number;
  opportunities: number;
  posts: number;
};

export async function seedDemoData() {
  return requestJson<{ summary: DemoSeedSummary }>('/api/admin/seed/demo', { method: 'POST' });
}


