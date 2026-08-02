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

export type AdminSponsorshipInquiry = {
  _id: string;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  communityName: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  packageName: string;
  message: string;
  dealNote: string;
  packageWon: string;
  dealAmount: number;
  feeStatus: 'NONE' | 'PENDING' | 'PAID';
  status: 'NEW' | 'CONTACTED' | 'WON' | 'CLOSED';
  createdAt: string;
};

export type SponsorshipFeeSettings = {
  sponsorshipFeePercent: number;
  feeBankName: string;
  feeAccountNumber: string;
  feeAccountName: string;
  packageTemplates: { name: string; price: string; perks: string[]; benefits: string }[];
};

export async function getAdminSponsorshipInquiries() {
  return requestJson<{ inquiries: AdminSponsorshipInquiry[] }>('/api/admin/sponsorship/inquiries');
}

export async function getAdminSponsorshipSettings() {
  return requestJson<{ settings: SponsorshipFeeSettings }>('/api/admin/sponsorship/settings');
}

export async function updateAdminSponsorshipSettings(input: Partial<SponsorshipFeeSettings>) {
  return requestJson<{ settings: SponsorshipFeeSettings }>('/api/admin/sponsorship/settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function setAdminInquiryFeeStatus(inquiryId: string, feeStatus: 'NONE' | 'PENDING' | 'PAID') {
  return requestJson<{ inquiry: AdminSponsorshipInquiry }>(`/api/admin/sponsorship/inquiries/${encodeURIComponent(inquiryId)}/fee`, {
    method: 'PATCH',
    body: JSON.stringify({ feeStatus }),
  });
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
  status: 'ACTIVE' | 'BLOCKED';
  blocked: boolean;
  blockReason: string;
  deleted: boolean;
  createdAt: string;
};

export async function searchAdminUsers(search = '', page = 1) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return requestJson<{ users: AdminUser[]; total: number; page: number; pages: number }>(`/api/admin/users${qs}`);
}

export async function setUserRole(userId: string, role: AdminUserRole) {
  return requestJson<{ user: { id: string; role: AdminUserRole } }>(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function blockUser(userId: string, reason = '') {
  return requestJson<{ user: { id: string } }>(`/api/admin/users/${encodeURIComponent(userId)}/block`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export async function unblockUser(userId: string) {
  return requestJson<{ user: { id: string } }>(`/api/admin/users/${encodeURIComponent(userId)}/unblock`, {
    method: 'PATCH',
  });
}

export async function deleteUser(userId: string) {
  return requestJson<{ user: { id: string } }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function restoreUser(userId: string) {
  return requestJson<{ user: { id: string } }>(`/api/admin/users/${encodeURIComponent(userId)}/restore`, {
    method: 'PATCH',
  });
}

export type InactiveCommunity = {
  id: string;
  name: string;
  slug: string;
  university: string;
  reason: 'REJECTED' | 'ARCHIVED';
  note: string;
  updatedAt: string;
};

export type InactiveEvent = {
  id: string;
  title: string;
  slug: string;
  community: string;
  reason: 'ARCHIVED' | 'DELETED';
  updatedAt: string;
};

export type InactiveUser = {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: AdminUserRole;
  reason: 'BLOCKED' | 'DELETED';
  note: string;
  updatedAt: string;
};

export type InactiveEntities = {
  communities: InactiveCommunity[];
  events: InactiveEvent[];
  users: InactiveUser[];
};

export async function getInactiveEntities() {
  return requestJson<InactiveEntities>('/api/admin/inactive');
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

// ---- Content moderation ----

export type ReportedAuthor = { id: string; fullName: string; username: string; avatar: string };

export type ReportedPost = {
  id: string;
  content: string;
  author: ReportedAuthor;
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
  author: ReportedAuthor;
  reportCount: number;
  reasons: string[];
  createdAt: string;
  lastReportedAt: string;
};

export async function getContentReports() {
  return requestJson<{ posts: ReportedPost[]; comments: ReportedComment[] }>('/api/admin/content/reports');
}

export async function moderatePost(id: string, action: 'remove' | 'dismiss', note = '') {
  return requestJson<{ ok: boolean }>(`/api/admin/content/post/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export async function moderateComment(id: string, action: 'remove' | 'dismiss') {
  return requestJson<{ ok: boolean }>(`/api/admin/content/comment/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
  });
}

// ---- Admin audit log ----

export type AuditEntry = {
  id: string;
  admin: string;
  action: string;
  targetType: string;
  targetId: string;
  note: string;
  createdAt: string;
};

export async function getAdminAudit(page = 1) {
  return requestJson<{ entries: AuditEntry[]; total: number; page: number; pages: number }>(`/api/admin/audit?page=${page}`);
}

// ---- Broadcast ----

export type AdminMessageCategory = 'INFO' | 'CONGRATS' | 'WARNING' | 'CONFIRMATION';

export async function sendBroadcast(input: {
  title: string;
  body?: string;
  link?: string;
  role?: string;
  category?: AdminMessageCategory;
  channels?: { notification?: boolean; email?: boolean };
  target?: { scope?: 'ALL' | 'ROLE' | 'USER'; role?: string; userId?: string; email?: string };
}) {
  return requestJson<{ count: number; notified: number; emailed: number; recipients: number }>('/api/admin/broadcast', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ---- Community moderation ----

export type AdminCommunity = {
  id: string;
  name: string;
  slug: string;
  university: string;
  category: string;
  memberCount: number;
  eventCount: number;
  suspended: boolean;
  archiveReason: string;
  isPremium: boolean;
};

export async function getAdminCommunities() {
  return requestJson<{ communities: AdminCommunity[] }>('/api/admin/communities/all');
}

export async function suspendCommunity(id: string, reason = '') {
  return requestJson<{ community: { id: string; suspended: boolean } }>(`/api/admin/communities/${encodeURIComponent(id)}/suspend`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export async function restoreCommunity(id: string) {
  return requestJson<{ community: { id: string; suspended: boolean } }>(`/api/admin/communities/${encodeURIComponent(id)}/restore`, {
    method: 'PATCH',
  });
}

export async function setCommunityPremium(id: string, isPremium: boolean) {
  return requestJson<{ community: { id: string; isPremium: boolean } }>(`/api/admin/communities/${encodeURIComponent(id)}/premium`, {
    method: 'PATCH',
    body: JSON.stringify({ isPremium }),
  });
}

export type GatewayFee = { percent: number; flat: number; cap: number; waiver: number };
export type PaymentGateway = 'PAYSTACK' | 'FLUTTERWAVE';
export type PremiumPricing = {
  price: number;
  eventPrice: number;
  gatewayFee: GatewayFee;
  gateway: PaymentGateway;
  gatewayConfigured: { PAYSTACK: boolean; FLUTTERWAVE: boolean };
};

export async function getPremiumPricing() {
  return requestJson<PremiumPricing>('/api/admin/communities/premium/price');
}

export async function setPremiumPricing(patch: Partial<{ price: number; eventPrice: number; gatewayFee: Partial<GatewayFee>; gateway: PaymentGateway }>) {
  return requestJson<PremiumPricing>('/api/admin/communities/premium/price', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function takedownEvent(id: string, note = '') {
  return requestJson<{ event: { id: string; status: string } }>(`/api/admin/events/${encodeURIComponent(id)}/takedown`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

// ── Ticket sales oversight ────────────────────────────────────────────────────

export type TicketOverviewTotals = {
  ticketsSold: number;
  grossNgn: number;
  gatewayFeesNgn: number;
  commissionNgn: number;
  organizerNgn: number;
  paidOutNgn: number;
  pendingPayoutsNgn: number;
  owedToOrganizersNgn: number;
};

export type TicketEventRow = {
  eventId: string;
  title: string;
  slug: string;
  ticketPriceNgn: number;
  communityName: string;
  sold: number;
  grossNgn: number;
  commissionNgn: number;
  organizerNgn: number;
  lastSaleAt: string | null;
};

export async function getTicketOverview() {
  return requestJson<{ totals: TicketOverviewTotals; events: TicketEventRow[] }>('/api/admin/tickets/overview');
}

export type AdminPayoutRow = {
  _id: string;
  amountNgn: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  note: string;
  requestedAt: string;
  processedAt: string | null;
  communityName: string;
  communitySlug: string;
  requestedByName: string;
};

export async function getAdminPayouts() {
  return requestJson<{ payouts: AdminPayoutRow[] }>('/api/admin/tickets/payouts');
}

export async function setAdminPayoutStatus(payoutId: string, status: 'PAID' | 'REJECTED', note = '') {
  return requestJson<{ payout: AdminPayoutRow }>(`/api/admin/tickets/payouts/${encodeURIComponent(payoutId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  });
}

export async function getTicketCommission() {
  return requestJson<{ commissionPercent: number; payoutMode: 'MANUAL' | 'AUTO'; gateway: 'PAYSTACK' | 'FLUTTERWAVE'; gatewayConfigured: boolean }>('/api/admin/tickets/settings');
}

export async function setTicketSettings(patch: { commissionPercent?: number; payoutMode?: 'MANUAL' | 'AUTO' }) {
  return requestJson<{ commissionPercent: number; payoutMode: 'MANUAL' | 'AUTO' }>('/api/admin/tickets/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function setTicketCommission(commissionPercent: number) {
  return setTicketSettings({ commissionPercent });
}


