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

/** Official broadcast to all active members (VP+ only): in-app + optional branded email. */
export async function sendCommunityAnnouncement(id: string, input: { title: string; body: string; emailToo?: boolean }) {
  return requestJson<{ recipients: number; notified: number; emailed: number }>(
    '/api/communities/' + encodeURIComponent(id) + '/announce',
    { method: 'POST', body: JSON.stringify(input) },
  );
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

export type CommunityMemberAnalytics = {
  totalMembers: number;
  departedMembers: number;
  newLast30Days: number;
  followerCount: number;
  engagedLast60Days: number;
  dormantMembers: number;
  roleBreakdown: { role: string; count: number }[];
  joinsByMonth: { month: string; count: number }[];
};

/** Member analytics for managers (COORDINATOR+): growth trend, role mix, engagement split. */
export async function getCommunityMemberAnalytics(id: string) {
  return requestJson<{ analytics: CommunityMemberAnalytics }>('/api/communities/' + encodeURIComponent(id) + '/member-analytics');
}

/** Bulk member invites by email (COORDINATOR+, ≤50/batch) — branded emails carrying the join link. */
export async function inviteMembersByEmail(id: string, emails: string[]) {
  return requestJson<{ sent: number; skippedMembers: number; failed: string[] }>('/api/communities/' + encodeURIComponent(id) + '/invite-emails', {
    method: 'POST',
    body: JSON.stringify({ emails }),
  });
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

/**
 * Curated leadership roster for a community's public profile — free-text
 * name/title/session/bio entries a VP+ writes in. Independent of `Membership`
 * (the permission gate): an entry doesn't need a registered GuildOS account,
 * though `linkedUserId` can optionally tag/link one so viewers can see "On
 * GuildOS" and open their public profile.
 */
export type CommunityLeader = {
  id: string;
  name: string;
  title: string;
  session: string;
  bio: string;
  photo: string;
  phone: string;
  department: string;
  level: string;
  displayRank: number | null;
  /**
   * ACTIVE = currently serving. ARCHIVED = this one person left/was removed before their
   * session ended (an individual exception). PAST = their whole session was dissolved (the
   * normal end-of-term transition — everyone serving that session moves to PAST together).
   */
  status: 'ACTIVE' | 'ARCHIVED' | 'PAST';
  createdAt: string;
  updatedAt: string;
  /** End-of-term certificate issued for this entry, if any — lets admins copy/re-send the link later. */
  certificate: { serial: string; status: 'VERIFIED' | 'REVOKED'; verificationUrl: string } | null;
  linkedUser: { id: string; fullName: string; username: string; avatar: string } | null;
};

/**
 * By default returns every leader (active + archived + past). Pass `status` to narrow it, or
 * `session` to fetch one specific session's full roster regardless of status — how a dissolved
 * session's leaders become visible again.
 */
export async function getCommunityLeaders(communityId: string, params?: { status?: 'ACTIVE' | 'ARCHIVED' | 'PAST'; session?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.session !== undefined) query.set('session', params.session);
  const qs = query.toString();
  return requestJson<{ leaders: CommunityLeader[] }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/leaders' + (qs ? '?' + qs : ''),
  );
}

export type CommunityLeaderSession = { session: string; total: number; activeCount: number; archivedCount: number; pastCount: number };

/** Lightweight session directory (label + counts) for building session-browse chips without a full roster fetch. */
export async function getCommunityLeaderSessions(communityId: string) {
  return requestJson<{ sessions: CommunityLeaderSession[] }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/leaders/sessions',
  );
}

export type HandoverResult = {
  assigned: number;
  results: { leaderId: string; name: string; role: string; status: 'ASSIGNED' | 'FAILED'; error?: string }[];
  ownershipTransferred: boolean;
  ownershipError: string;
};

/**
 * Year-end permission bridge: turn roster entries with linked GuildOS accounts into REAL
 * Membership roles (memberships created where needed); optional ownership transfer rides along.
 */
export async function handoverCommunityLeadership(
  communityId: string,
  assignments: { leaderId: string; role: string }[],
  transferOwnershipToLeaderId?: string | null,
) {
  return requestJson<HandoverResult>('/api/communities/' + encodeURIComponent(communityId) + '/leaders/handover', {
    method: 'POST',
    body: JSON.stringify({ assignments, transferOwnershipToLeaderId: transferOwnershipToLeaderId ?? null }),
  });
}

export type CommunityMemberEntry = {
  membership: { _id: string; role: string; status?: string; joinedAt?: string; assignedBy?: string | null };
  user: { id: string; fullName: string; profile?: { avatar?: string } };
};

/**
 * Paginated + searchable member roster (COORDINATOR+ only) — built for large
 * communities: 50 per page, server-side name search, cursor-based "load more".
 */
export async function getCommunityMembersPage(
  communityId: string,
  params?: { limit?: number; cursor?: string; q?: string; role?: string },
) {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', params.cursor);
  if (params?.q) query.set('q', params.q);
  if (params?.role) query.set('role', params.role);
  const qs = query.toString();
  return requestJson<{ members: CommunityMemberEntry[]; nextCursor: string | null; total: number }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/members' + (qs ? '?' + qs : ''),
  );
}

/** Dissolve-time certificate choice: GuildOS standard design or the community's own template image. */
export type LeaderCertificateChoice = {
  mode: 'STANDARD' | 'CUSTOM';
  templateImage?: string;
  /** CUSTOM templates: where the leader's name is drawn (x/y %, font size % of height, colour, align). */
  namePlacement?: { x: number; y: number; fontSize: number; color: string; align: 'left' | 'center' | 'right' };
  /** Premium customization — ignored server-side for non-premium communities. */
  theme?: { accent?: string; background?: string; font?: string };
  style?: string;
  content?: {
    title?: string;
    presentation?: string;
    message?: string;
    /** Free communities get one signature; premium up to three. */
    signatories?: { name: string; title: string; image: string }[];
  };
  /** Update certificates that were already issued for these leaders to this design (serials/links unchanged). */
  reissueExisting?: boolean;
};

export type IssuedLeaderCertificate = {
  leaderId: string;
  name: string;
  /** From the roster entry (may be '') — powers the per-row WhatsApp share. */
  phone: string;
  serial: string;
  verificationUrl: string;
  /** False = no GuildOS account; share their verification link with them manually. */
  hasAccount: boolean;
};

/**
 * "Issue anyway": per-person certificate for an ARCHIVED (left early) or skipped PAST
 * leader — the explicit exception to the archived-get-nothing dissolve default (VP+).
 */
export async function issueLeaderCertificate(communityId: string, leaderId: string) {
  return requestJson<{ certificate: IssuedLeaderCertificate }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/leaders/' + encodeURIComponent(leaderId) + '/certificate',
    { method: 'POST' },
  );
}

/**
 * Dissolves a session — every currently-ACTIVE leader tagged with it moves to PAST together
 * (the normal end-of-term transition, distinct from archiving one person who left early).
 * Pass `certificate` to also issue verifiable LEADERSHIP certificates to the outgoing set.
 */
export async function dissolveCommunityLeaderSession(communityId: string, session: string, certificate?: LeaderCertificateChoice | null, options?: { demoteOutgoing?: boolean }) {
  return requestJson<{ dissolved: number; certificates: IssuedLeaderCertificate[]; demoted: number }>('/api/communities/' + encodeURIComponent(communityId) + '/leaders/dissolve', {
    method: 'POST',
    body: JSON.stringify({ session, certificate: certificate ?? null, demoteOutgoing: options?.demoteOutgoing ?? false }),
  });
}

/**
 * PUBLIC "collect your certificate" listing for one dissolved session — one shareable
 * link for the whole outgoing executive group; no account needed to open it.
 */
export async function getLeaderSessionCertificates(slug: string, session: string) {
  return requestJson<{
    community: { name: string; slug: string; logo: string };
    session: string;
    certificates: { name: string; title: string; serial: string; verificationUrl: string }[];
  }>('/api/communities/leaders-certificates?slug=' + encodeURIComponent(slug) + '&session=' + encodeURIComponent(session));
}

export type CommunityLeaderInput = {
  name: string;
  title?: string;
  session?: string;
  bio?: string;
  photo?: string;
  phone?: string;
  department?: string;
  level?: string;
  displayRank?: number | null;
  linkedUserId?: string | null;
  status?: 'ACTIVE' | 'ARCHIVED' | 'PAST';
  /** Handover bridge: also give the linked account this real Membership role (they must already be a member). */
  assignRole?: string;
};

export async function addCommunityLeader(communityId: string, input: CommunityLeaderInput) {
  return requestJson<{ leader: CommunityLeader }>('/api/communities/' + encodeURIComponent(communityId) + '/leaders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateCommunityLeader(communityId: string, leaderId: string, input: Partial<CommunityLeaderInput>) {
  return requestJson<{ leader: CommunityLeader }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/leaders/' + encodeURIComponent(leaderId),
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export async function removeCommunityLeader(communityId: string, leaderId: string) {
  return requestJson<{ message: string }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/leaders/' + encodeURIComponent(leaderId),
    { method: 'DELETE' },
  );
}

/** Optional photo for a leadership-roster entry. Returns a raw `/uploads/...` path — resolve with resolveAvatarUrl before displaying. */
export async function uploadLeaderPhoto(file: File) {
  const formData = new FormData();
  formData.append('photo', file);
  return requestJson<{ photo: string }>('/api/communities/upload/leader-photo', {
    method: 'POST',
    body: formData,
  });
}

export type ExtractedLeaderCandidate = { name: string; title: string; department: string; level: string; phone: string };
export type ExtractedLeaderList = { session: string; candidates: ExtractedLeaderCandidate[] };

/**
 * "Import from document" step 1 — uploads a nomination/appointment-letter PDF and gets back an
 * AI-extracted candidate list (session + rows) to review/edit before committing. Nothing is
 * created in the database yet.
 */
export async function extractLeadersFromDocument(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestJson<ExtractedLeaderList>('/api/communities/upload/leaders/extract', {
    method: 'POST',
    body: formData,
  });
}

/** "Import from document" step 2 — creates every reviewed row under one shared session. */
export async function bulkCreateCommunityLeaders(
  communityId: string,
  session: string,
  entries: Array<{ name: string; title?: string; department?: string; level?: string; phone?: string }>,
) {
  return requestJson<{ created: number; leaders: CommunityLeader[] }>(
    '/api/communities/' + encodeURIComponent(communityId) + '/leaders/bulk',
    {
      method: 'POST',
      body: JSON.stringify({ session, entries }),
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

// ── Ticket-earnings wallet ────────────────────────────────────────────────────

export type WalletSale = {
  _id: string;
  eventTitle: string;
  eventSlug: string;
  buyerName: string;
  ticketNgn: number;
  commissionNgn: number;
  earnedNgn: number;
  paidAt: string | null;
};

export type WalletPayoutEntry = {
  _id: string;
  amountNgn: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  note: string;
  requestedAt: string;
  processedAt: string | null;
};

export type CommunityWallet = {
  ticketsSold: number;
  earnedNgn: number;
  /** Earnings from events that haven't happened yet — released when the event completes. */
  heldNgn: number;
  paidOutNgn: number;
  pendingPayoutNgn: number;
  availableNgn: number;
  currency: string;
  payoutMode: 'MANUAL' | 'AUTO';
  sales: WalletSale[];
  payouts: WalletPayoutEntry[];
};

/** Treasurer+ only. */
export async function getCommunityWallet(communityId: string) {
  return requestJson<{ wallet: CommunityWallet }>('/api/communities/' + encodeURIComponent(communityId) + '/wallet');
}

export async function requestWalletPayout(
  communityId: string,
  input: { amountNgn: number; bankName: string; accountNumber: string; accountName: string },
) {
  return requestJson<{ payout: WalletPayoutEntry }>('/api/communities/' + encodeURIComponent(communityId) + '/wallet/payouts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
