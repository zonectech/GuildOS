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

export type RecruiterVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export type RecruiterProfile = {
  company: string;
  position: string;
  website: string;
  about: string;
  verified: boolean;
  verificationStatus: RecruiterVerificationStatus;
  verificationNote: string;
};

export type RecruiterReputation = {
  company: string;
  verified: boolean;
  tier: 'Unverified' | 'Verified Recruiter' | 'Trusted Employer' | 'Top Campus Employer';
  successfulHires: number;
  totalApplicants: number;
  responseRate: number;
  activeSince: string | null;
};

export type RecruiterDashboard = {
  recruiter: RecruiterProfile | null;
  stats: { opportunities: number; openOpportunities: number; totalApplicants: number };
  reputation: RecruiterReputation;
};

export type RecruiterOpportunity = {
  id: string;
  title: string;
  category: string;
  organization: string;
  location: string;
  deadline: string | null;
  tags: string[];
  applicationUrl: string;
  saveCount: number;
  applyCount: number;
  status: string;
  moderationStatus?: string;
  createdAt: string;
};

export type ApplicantReviewStatus = 'NEW' | 'SHORTLISTED' | 'CONTACTED' | 'REJECTED' | 'HIRED';

export type Applicant = {
  userId: string;
  fullName: string;
  username: string;
  university: string;
  department: string;
  guildScore: number;
  level: string;
  availability: 'OPEN' | 'CASUAL' | 'CLOSED';
  action: 'SAVED' | 'INTERESTED' | 'APPLIED';
  actedAt: string;
  reviewStatus: ApplicantReviewStatus;
  reviewNote: string;
  matchScore: number;
  reasons: string[];
};

export type Candidate = {
  userId: string;
  fullName: string;
  username: string;
  university: string;
  faculty: string;
  department: string;
  guildScore: number;
  level: string;
  leadershipScore: number;
  badges: string[];
  availability: 'OPEN' | 'CASUAL' | 'CLOSED';
};

export async function registerRecruiter(payload: { company: string; position?: string; website?: string; about?: string }) {
  return requestJson<{ recruiter: RecruiterProfile }>('/api/recruiter/register', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getRecruiterDashboard() {
  return requestJson<RecruiterDashboard>('/api/recruiter/me');
}

export async function requestRecruiterVerification() {
  return requestJson<{ recruiter: RecruiterProfile }>('/api/recruiter/verify/request', { method: 'POST' });
}

export type RecruiterAnalytics = {
  summary: { opportunities: number; totalViews: number; applied: number; saved: number; interested: number; hires: number };
  byUniversity: Array<{ university: string; count: number }>;
  byScoreBand: Array<{ band: string; count: number }>;
  byCommunity: Array<{ community: string; count: number }>;
  perOpportunity: Array<{ id: string; title: string; views: number; applyCount: number; saveCount: number }>;
};

export async function getRecruiterAnalytics() {
  return requestJson<RecruiterAnalytics>('/api/recruiter/analytics');
}

export type PublicRecruiter = {
  company: string;
  verified: boolean;
  tier: string;
  successfulHires: number;
  responseRate: number;
  activeSince: string | null;
};

export async function getPublicRecruiter(userId: string) {
  return requestJson<{ recruiter: PublicRecruiter }>(`/api/recruiter/public/${encodeURIComponent(userId)}`);
}

export async function getRecruiterOpportunities() {
  return requestJson<{ opportunities: RecruiterOpportunity[] }>('/api/recruiter/opportunities');
}

export async function createRecruiterOpportunity(payload: {
  title: string;
  category: string;
  description?: string;
  organization?: string;
  location?: string;
  deadline?: string | null;
  tags?: string[];
  applicationUrl?: string;
  eligibility?: { minGuildScore?: number; minLeadershipRoles?: number; minCertificates?: number };
}) {
  return requestJson<{ id: string; title: string }>('/api/recruiter/opportunities', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateRecruiterOpportunity(id: string, patch: Record<string, unknown>) {
  return requestJson<{ opportunity: RecruiterOpportunity }>(`/api/recruiter/opportunities/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function getOpportunityApplicants(id: string) {
  return requestJson<{ opportunity: { id: string; title: string; category: string }; applicants: Applicant[] }>(`/api/recruiter/opportunities/${encodeURIComponent(id)}/applicants`);
}

export async function setApplicantStatus(opportunityId: string, candidateId: string, status: ApplicantReviewStatus, note?: string) {
  return requestJson<{ opportunityId: string; candidateId: string; status: ApplicantReviewStatus }>(
    `/api/recruiter/opportunities/${encodeURIComponent(opportunityId)}/applicants/${encodeURIComponent(candidateId)}/status`,
    { method: 'POST', body: JSON.stringify({ status, note }) },
  );
}

export async function searchCandidates(params: { university?: string; faculty?: string; department?: string; minGuildScore?: number; requireLeadership?: boolean; openToWork?: boolean } = {}) {
  const query = new URLSearchParams();
  if (params.university) query.set('university', params.university);
  if (params.faculty) query.set('faculty', params.faculty);
  if (params.department) query.set('department', params.department);
  if (params.minGuildScore) query.set('minGuildScore', String(params.minGuildScore));
  if (params.requireLeadership) query.set('requireLeadership', 'true');
  if (params.openToWork) query.set('openToWork', 'true');
  const qs = query.toString();
  return requestJson<{ candidates: Candidate[] }>(`/api/recruiter/candidates${qs ? `?${qs}` : ''}`);
}

export const OPPORTUNITY_CATEGORIES = ['INTERNSHIP', 'SCHOLARSHIP', 'FELLOWSHIP', 'CAMPUS_ROLE', 'COMPETITION', 'CONFERENCE', 'OPEN_SOURCE'] as const;

export type PendingRecruiter = {
  userId: string;
  fullName: string;
  email: string;
  company: string;
  position: string;
  website: string;
  about: string;
  requestedAt: string;
};

export async function getPendingRecruiters() {
  return requestJson<{ recruiters: PendingRecruiter[] }>('/api/admin/recruiters/pending');
}

export async function verifyRecruiter(userId: string, note?: string) {
  return requestJson<{ recruiter: { userId: string; verificationStatus: string } }>(`/api/admin/recruiters/${encodeURIComponent(userId)}/verify`, {
    method: 'PATCH',
    body: JSON.stringify({ note: note ?? '' }),
  });
}

export async function rejectRecruiter(userId: string, note?: string) {
  return requestJson<{ recruiter: { userId: string; verificationStatus: string } }>(`/api/admin/recruiters/${encodeURIComponent(userId)}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ note: note ?? '' }),
  });
}
