const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function resolveAvatarUrl(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}

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
    const errorMessage = typeof payload === 'object' && payload && 'error' in payload && payload.error ? payload.error : 'Request failed';
    throw new Error(errorMessage);
  }

  return payload;
}

export type CommunitySummary = {
  _id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  logo: string;
  coverImage: string;
  category: string;
  university: string;
  faculty: string;
  department: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  autoApprove?: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationMethod?: 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL' | null;
  verificationNotes?: string;
  founder: string;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string;
  memberCount: number;
  eventCount: number;
  followerCount?: number;
  whatsappLink?: string;
  channelLink?: string;
  rules?: string[];
  createdAt: string;
  updatedAt: string;
};

export type CommunityJoinRequest = {
  _id: string;
  userId: string;
  communityId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string;
  user?: { id: string; fullName: string } | null;
};

export type CommunityEndorsement = {
  endorsement: {
    _id: string;
    communityId: string;
    endorserId: string;
    note: string;
    createdAt: string;
  };
  user: {
    id: string;
    fullName: string;
    profile?: { avatar?: string };
  };
};

export async function getCommunities() {
  return requestJson<{ communities: CommunitySummary[] }>('/api/communities');
}

export type SuggestedCommunity = CommunitySummary & { reason: string };

export async function getSuggestedCommunities() {
  return requestJson<{ communities: SuggestedCommunity[] }>('/api/communities/suggested');
}

export async function getManagedCommunities() {
  return requestJson<{ communities: CommunitySummary[] }>('/api/communities/managed');
}

export async function getManagedCommunityHistory() {
  return requestJson<{ communities: CommunitySummary[] }>('/api/communities/managed/history');
}

export async function getCommunity(slug: string) {
  return requestJson<{
    community: CommunitySummary;
    viewerMembership?: { role: string } | null;
    viewerJoinRequest?: CommunityJoinRequest | null;
    leadership?: unknown[];
    endorsements?: CommunityEndorsement[];
    members?: unknown[];
    joinRequests?: CommunityJoinRequest[];
  }>(
    '/api/communities/' + encodeURIComponent(slug),
  );
}

export async function joinCommunity(id: string) {
  return requestJson<{ community: CommunitySummary; message: string; alreadyRequested?: boolean }>('/api/communities/' + encodeURIComponent(id) + '/join', {
    method: 'POST',
  });
}

export async function leaveCommunity(id: string) {
  return requestJson<{ message: string }>('/api/communities/' + encodeURIComponent(id) + '/leave', {
    method: 'POST',
  });
}

export async function joinCommunityByInviteToken(token: string) {
  return requestJson<{ community: CommunitySummary; message: string }>('/api/communities/join/' + encodeURIComponent(token), {
    method: 'POST',
  });
}

export async function updateCommunity(id: string, payload: Partial<{
  name: string;
  shortDescription: string;
  description: string;
  logo: string;
  coverImage: string;
  category: string;
  university: string;
  faculty: string;
  department: string;
  whatsappLink: string;
  channelLink: string;
  rules: string[];
  visibility: 'PUBLIC' | 'PRIVATE';
  autoApprove: boolean;
}>) {
  return requestJson<{ community: CommunitySummary }>('/api/communities/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteCommunity(id: string) {
  return requestJson<{ message: string }>('/api/communities/' + encodeURIComponent(id), {
    method: 'DELETE',
  });
}

export async function createCommunityInviteLink(id: string) {
  return requestJson<{ inviteLink: string }>('/api/communities/' + encodeURIComponent(id) + '/invite-link', {
    method: 'POST',
  });
}

export async function revokeCommunityInviteLink(id: string) {
  return requestJson<{ message: string }>('/api/communities/' + encodeURIComponent(id) + '/invite-link', {
    method: 'DELETE',
  });
}

export async function archiveCommunity(id: string, reason = '') {
  return requestJson<{ community: CommunitySummary }>('/api/communities/' + encodeURIComponent(id) + '/archive', {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export async function reopenCommunity(id: string) {
  return requestJson<{ community: CommunitySummary }>('/api/communities/' + encodeURIComponent(id) + '/reopen', {
    method: 'PATCH',
  });
}

export async function transferCommunityOwnership(id: string, memberId: string) {
  return requestJson<{ community: CommunitySummary }>('/api/communities/' + encodeURIComponent(id) + '/ownership', {
    method: 'PATCH',
    body: JSON.stringify({ memberId }),
  });
}

export async function getCommunityJoinRequests(id: string) {
  return requestJson<{ joinRequests: CommunityJoinRequest[] }>('/api/communities/' + encodeURIComponent(id) + '/join-requests');
}

export async function approveCommunityJoinRequest(id: string, requestId: string) {
  return requestJson<{ request: CommunityJoinRequest }>(
    '/api/communities/' + encodeURIComponent(id) + '/join-requests/' + encodeURIComponent(requestId) + '/approve',
    {
      method: 'PATCH',
    },
  );
}

export async function rejectCommunityJoinRequest(id: string, requestId: string) {
  return requestJson<{ request: CommunityJoinRequest }>(
    '/api/communities/' + encodeURIComponent(id) + '/join-requests/' + encodeURIComponent(requestId) + '/reject',
    {
      method: 'PATCH',
    },
  );
}

export async function updateCommunityMemberRole(communityId: string, memberId: string, role: string) {
  return requestJson<{ membership: { _id: string; role: string; joinedAt: string; assignedBy: string | null } }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/members/' + encodeURIComponent(memberId) + '/role',
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
  );
}

export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED' | 'LEFT';

export type CommunityRoleInfo = {
  role: string;
  rank: number;
  isLeadership: boolean;
  description: string;
};

export type LeadershipHistoryEntry = {
  id: string;
  role: string;
  startDate: string;
  endDate: string | null;
  current: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED';
  assignedBy: string | null;
  community: {
    id: string;
    name: string;
    slug: string;
    logo: string;
    verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  } | null;
};

export async function getCommunityRoles() {
  return requestJson<{ roles: CommunityRoleInfo[] }>('/api/communities/roles');
}

export async function createCommunityEndorsement(communityId: string, note = '') {
  return requestJson<{ endorsement: CommunityEndorsement['endorsement'] }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/endorsements',
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
  );
}

export async function getCommunityEndorsements(communityId: string) {
  return requestJson<{ endorsements: CommunityEndorsement[] }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/endorsements',
  );
}

export async function updateMembershipStatus(membershipId: string, status: MembershipStatus) {
  return requestJson<{ membership?: { _id: string; status: MembershipStatus }; removed?: boolean }>(
    '/api/memberships/' + encodeURIComponent(membershipId) + '/status',
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
}

export async function assignMembershipRole(membershipId: string, role: string) {
  return requestJson<{ membership: { _id: string; role: string } }>(
    '/api/memberships/' + encodeURIComponent(membershipId) + '/roles',
    {
      method: 'POST',
      body: JSON.stringify({ role }),
    },
  );
}

export async function getUserLeadershipHistory(userId: string) {
  return requestJson<{ leadershipHistory: LeadershipHistoryEntry[] }>(
    '/api/users/' + encodeURIComponent(userId) + '/leadership-history',
  );
}

export type UserMembershipEntry = {
  membershipId: string;
  role: string;
  status: MembershipStatus;
  joinedAt: string;
  community: {
    id: string;
    name: string;
    slug: string;
    logo: string;
    verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  } | null;
};

export async function getUserMemberships(userId: string) {
  return requestJson<{ memberships: UserMembershipEntry[] }>(
    '/api/users/' + encodeURIComponent(userId) + '/memberships',
  );
}

export type CommunityActivityEntry = {
  id: string;
  action: 'MEMBER_JOINED' | 'MEMBER_LEFT' | 'MEMBER_REMOVED' | 'ROLE_ASSIGNED' | 'ROLE_REMOVED' | 'STATUS_CHANGED';
  createdAt: string;
  metadata: Record<string, unknown>;
  actor: { id: string; fullName: string } | null;
  member: { id: string; fullName: string } | null;
};

export async function getCommunityActivity(id: string) {
  return requestJson<{ activity: CommunityActivityEntry[] }>(
    '/api/communities/' + encodeURIComponent(id) + '/activity',
  );
}

// ── Community mod queue (delegated moderation) ──

export type ModerationAuthor = { id: string; fullName: string; username: string; avatar: string };

export type ReportedPost = {
  id: string;
  content: string;
  imageUrl?: string;
  author: ModerationAuthor;
  reportCount: number;
  reasons: string[];
  hidden: boolean;
  createdAt: string;
  lastReportedAt: string;
};

export type ReportedComment = {
  id: string;
  postId: string;
  content: string;
  author: ModerationAuthor;
  reportCount: number;
  reasons: string[];
  createdAt: string;
  lastReportedAt: string;
};

export async function getCommunityModerationReports(communityId: string) {
  return requestJson<{ posts: ReportedPost[]; comments: ReportedComment[] }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/moderation/reports',
  );
}

export async function moderateCommunityPost(communityId: string, postId: string, action: 'REMOVE' | 'DISMISS', note = '') {
  return requestJson<{ ok: boolean }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/moderation/posts/' + encodeURIComponent(postId),
    { method: 'POST', body: JSON.stringify({ action, note }) },
  );
}

export async function moderateCommunityComment(communityId: string, commentId: string, action: 'REMOVE' | 'DISMISS') {
  return requestJson<{ ok: boolean }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/moderation/comments/' + encodeURIComponent(commentId),
    { method: 'POST', body: JSON.stringify({ action }) },
  );
}
