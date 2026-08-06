'use client';

import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../components/guildos/ui/loading';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import {
  approveCommunityJoinRequest,
  getManagedCommunities,
  getCommunity,
  getCommunityActivity,
  getCommunityMembersPage,
  rejectCommunityJoinRequest,
  resolveAvatarUrl,
  transferCommunityOwnership,
  updateCommunityMemberRole,
  updateMembershipStatus,
  type CommunityActivityEntry,
  type CommunityJoinRequest,
  type CommunitySummary,
  type MembershipStatus,
} from '../../../components/guildos/community-list-api';
import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { Badge } from '../../../components/guildos/ui/badge';
import { Button } from '../../../components/guildos/ui/button';
import { Table } from '../../../components/guildos/ui/table';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { SelectMenu } from '../../../components/guildos/ui/select-menu';
import { TableShell } from '../../../components/guildos/ui/table-shell';

type MemberEntry = {
  membership: { _id: string; role: string; status?: MembershipStatus; joinedAt?: string; assignedBy?: string | null };
  user: { id: string; fullName: string; profile?: { avatar?: string } };
};

type CommunityContext = {
  community: CommunitySummary;
  viewerMembership?: { role: string } | null;
  members?: MemberEntry[];
  membersTotal?: number;
  membersNextCursor?: string | null;
  joinRequests?: CommunityJoinRequest[];
};

const ASSIGNABLE_ROLES = ['MEMBER', 'VOLUNTEER', 'COORDINATOR', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT'];

export default function MembersPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [context, setContext] = useState<CommunityContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const [activity, setActivity] = useState<CommunityActivityEntry[]>([]);
  // Paged roster — context ships only the first 50; search + load-more use GET /:id/members.
  const [memberRows, setMemberRows] = useState<MemberEntry[]>([]);
  const [memberCursor, setMemberCursor] = useState<string | null>(null);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberBusy, setMemberBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        setCurrentUserId(user.id);
        const response = await getManagedCommunities();
        setCommunities(response.communities);
        if (response.communities.length) {
          setSelectedSlug(response.communities[0].slug);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load communities');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [router]);

  async function loadContext(slug: string) {
    if (!slug) return;
    try {
      setContextLoading(true);
      setActionError('');
      const response = await getCommunity(slug);
      setContext(response as CommunityContext);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to load community members');
      setContext(null);
    } finally {
      setContextLoading(false);
    }
  }

  useEffect(() => {
    if (selectedSlug) {
      void loadContext(selectedSlug);
    }
  }, [selectedSlug]);

  const community = context?.community;
  const viewerRole = context?.viewerMembership?.role ?? '';
  const isFounder = Boolean(community && community.founder === currentUserId);
  const canManage = ['VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'].includes(viewerRole);
  const canReview = ['PRESIDENT', 'FOUNDER'].includes(viewerRole);
  const members = useMemo(() => context?.members ?? [], [context]);
  const joinRequests = useMemo(() => context?.joinRequests ?? [], [context]);

  useEffect(() => {
    if (memberSearch.trim()) return;
    setMemberRows(context?.members ?? []);
    setMemberCursor(context?.membersNextCursor ?? null);
    setMemberTotal(context?.membersTotal ?? context?.members?.length ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  async function runMemberSearch(q: string) {
    if (!community) return;
    try {
      setMemberBusy(true);
      const page = await getCommunityMembersPage(community._id, { q: q.trim() || undefined });
      setMemberRows(page.members as MemberEntry[]);
      setMemberCursor(page.nextCursor);
      setMemberTotal(page.total);
    } catch {
      /* keep previous rows */
    } finally {
      setMemberBusy(false);
    }
  }

  async function loadMoreMembers() {
    if (!community || !memberCursor) return;
    try {
      setMemberBusy(true);
      const page = await getCommunityMembersPage(community._id, { cursor: memberCursor, q: memberSearch.trim() || undefined });
      setMemberRows((rows) => [...rows, ...(page.members as MemberEntry[])]);
      setMemberCursor(page.nextCursor);
      setMemberTotal(page.total);
    } catch {
      /* ignore */
    } finally {
      setMemberBusy(false);
    }
  }

  useEffect(() => {
    if (!community || !canReview) {
      setActivity([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await getCommunityActivity(community._id);
        if (!cancelled) setActivity(result.activity ?? []);
      } catch {
        if (!cancelled) setActivity([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [community, canReview, context]);

  async function refresh() {
    if (selectedSlug) {
      await loadContext(selectedSlug);
      if (memberSearch.trim()) void runMemberSearch(memberSearch);
    }
  }

  async function handleChangeRole(membershipId: string, role: string) {
    if (!community) return;
    try {
      setBusyId(membershipId);
      setActionError('');
      await updateCommunityMemberRole(community._id, membershipId, role);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update role');
    } finally {
      setBusyId('');
    }
  }

  async function handleSetStatus(membershipId: string, status: MembershipStatus) {
    if (status === 'REMOVED' && !(await confirmDialog({ title: 'Remove this member?', message: 'They will be removed from the community.', confirmLabel: 'Remove', tone: 'danger' }))) return;
    try {
      setBusyId(membershipId);
      setActionError('');
      await updateMembershipStatus(membershipId, status);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update status');
    } finally {
      setBusyId('');
    }
  }

  async function handleTransferOwnership(membershipId: string) {
    if (!community) return;
    if (!(await confirmDialog({ title: 'Transfer ownership?', message: 'You will become PRESIDENT.', confirmLabel: 'Transfer' }))) return;
    try {
      setBusyId(membershipId);
      setActionError('');
      await transferCommunityOwnership(community._id, membershipId);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to transfer ownership');
    } finally {
      setBusyId('');
    }
  }

  async function handleResolveRequest(requestId: string, action: 'approve' | 'reject') {
    if (!community) return;
    try {
      setBusyId(requestId);
      setActionError('');
      if (action === 'approve') {
        await approveCommunityJoinRequest(community._id, requestId);
      } else {
        await rejectCommunityJoinRequest(community._id, requestId);
      }
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to resolve join request');
    } finally {
      setBusyId('');
    }
  }

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 shadow-sm">
          <LogoSpinner />
        </div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Members"
        title="Membership & Roles"
        subtitle="Assign roles, suspend or remove members, transfer ownership, and review join requests."
      />

      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400 sm:flex-row sm:items-center sm:gap-3">
          <span className="font-medium text-slate-900 dark:text-slate-100">Community</span>
          <SelectMenu
            aria-label="Community"
            className="sm:w-56"
            value={selectedSlug}
            onChange={setSelectedSlug}
            placeholder="No communities"
            options={communities.map((item) => ({ value: item.slug, label: item.name }))}
          />
        </label>
        {community ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="indigo">{viewerRole || 'Not a member'}</Badge>
            <Badge>{community.memberCount} members</Badge>
          </div>
        ) : null}
      </div>

      {actionError ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div> : null}

      {contextLoading ? (
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 shadow-sm">
          <LogoSpinner />
        </div>
      ) : (
        <>
          <TableShell title="Members Table" subtitle="Manage roles and membership status across your community.">
            {(memberTotal > 10 || memberSearch.trim()) && (
              <div className="px-6 pb-2 pt-4">
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(event) => {
                    const q = event.target.value;
                    setMemberSearch(q);
                    if (q.trim().length >= 2) void runMemberSearch(q);
                    else if (!q.trim()) {
                      setMemberRows(context?.members ?? []);
                      setMemberCursor(context?.membersNextCursor ?? null);
                      setMemberTotal(context?.membersTotal ?? 0);
                    }
                  }}
                  placeholder="Search members by name…"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none transition focus:border-indigo-400"
                />
              </div>
            )}
            <Table>
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Member</th>
                    <th className="px-6 py-4 font-medium">Role</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Joined</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {memberRows.length ? (
                    memberRows.map((entry) => {
                      const isFounderRow = entry.membership.role === 'FOUNDER';
                      const status = entry.membership.status ?? 'ACTIVE';
                      const rowBusy = busyId === entry.membership._id;
                      return (
                        <tr key={entry.user.id} className="align-top text-slate-700 dark:text-slate-300">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <MemberAvatar fullName={entry.user.fullName} avatar={entry.user.profile?.avatar} />
                              <div className="font-medium text-slate-950 dark:text-white">{entry.user.fullName}</div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            {canManage && !isFounderRow ? (
                              <SelectMenu
                                aria-label="Member role"
                                className="w-44"
                                size="sm"
                                value={entry.membership.role}
                                onChange={(v) => void handleChangeRole(entry.membership._id, v)}
                                disabled={rowBusy}
                                options={ASSIGNABLE_ROLES.map((role) => ({ value: role, label: role }))}
                              />
                            ) : (
                              <Badge tone={isFounderRow ? 'indigo' : 'default'}>{entry.membership.role}</Badge>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            <Badge tone={status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' ? 'warning' : 'danger'}>{status}</Badge>
                          </td>
                          <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                            {entry.membership.joinedAt ? new Date(entry.membership.joinedAt).toLocaleDateString('en-NG') : '—'}
                          </td>
                          <td className="px-6 py-5">
                            {canManage && !isFounderRow ? (
                              <div className="flex flex-wrap gap-2">
                                {status === 'SUSPENDED' ? (
                                  <Button variant="secondary" onClick={() => void handleSetStatus(entry.membership._id, 'ACTIVE')} disabled={rowBusy}>
                                    Reactivate
                                  </Button>
                                ) : (
                                  <Button variant="secondary" onClick={() => void handleSetStatus(entry.membership._id, 'SUSPENDED')} disabled={rowBusy}>
                                    Suspend
                                  </Button>
                                )}
                                <Button variant="secondary" onClick={() => void handleSetStatus(entry.membership._id, 'REMOVED')} disabled={rowBusy}>
                                  Remove
                                </Button>
                                {isFounder ? (
                                  <Button variant="secondary" onClick={() => void handleTransferOwnership(entry.membership._id)} disabled={rowBusy}>
                                    Make Owner
                                  </Button>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400" colSpan={5}>
                        {viewerRole ? 'No members visible for this community.' : 'You need a leadership role to manage members here.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Table>
            {memberCursor && (
              <div className="px-6 pb-4">
                <button
                  onClick={() => void loadMoreMembers()}
                  disabled={memberBusy}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  {memberBusy ? 'Loading…' : `Load more (${memberRows.length} of ${memberTotal})`}
                </button>
              </div>
            )}
          </TableShell>

          {canReview ? (
            <div className="mt-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Join Requests</h2>
              <div className="mt-4 space-y-3">
                {joinRequests.length ? (
                  joinRequests.map((request) => (
                    <div key={request._id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{request.user?.fullName ?? `User ${request.userId}`}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Requested {new Date(request.requestedAt).toLocaleDateString('en-NG')} · {request.status}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="primary" onClick={() => void handleResolveRequest(request._id, 'approve')} disabled={busyId === request._id}>
                          Approve
                        </Button>
                        <Button variant="secondary" onClick={() => void handleResolveRequest(request._id, 'reject')} disabled={busyId === request._id}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No pending join requests.</p>
                )}
              </div>
            </div>
          ) : null}

          {canReview ? (
            <div className="mt-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Recent Activity</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Membership and role changes are logged for accountability.</p>
              <div className="mt-4 space-y-2">
                {activity.length ? (
                  activity.map((entry) => (
                    <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 px-4 py-2 text-sm">
                      <div className="text-slate-700 dark:text-slate-300">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{entry.action.replace(/_/g, ' ')}</span>
                        {entry.member ? <span className="text-slate-500 dark:text-slate-400"> · {entry.member.fullName}</span> : null}
                        {entry.actor ? <span className="text-slate-400 dark:text-slate-500"> by {entry.actor.fullName}</span> : null}
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(entry.createdAt).toLocaleString('en-NG')}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No activity recorded yet.</p>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </DashboardShell>
  );
}

function MemberAvatar({ fullName, avatar }: { fullName: string; avatar?: string }) {
  const url = resolveAvatarUrl(avatar);
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (url) {
    return <img src={url} alt={fullName} className="h-10 w-10 rounded-full border border-slate-200 dark:border-slate-800 object-cover" />;
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-950 text-sm font-medium text-slate-500 dark:text-slate-400">
      {initials || '?'}
    </div>
  );
}