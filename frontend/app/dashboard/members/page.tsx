'use client';

import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../components/guildos/ui/loading';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, UserPlus } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/api/auth-api';
import {
  approveCommunityJoinRequest,
  getManagedCommunities,
  getCommunity,
  getCommunityActivity,
  getCommunityMembersPage,
  inviteMembersByEmail,
  rejectCommunityJoinRequest,
  resolveAvatarUrl,
  transferCommunityOwnership,
  updateCommunityMemberRole,
  updateMembershipStatus,
  type CommunityActivityEntry,
  type CommunityJoinRequest,
  type CommunitySummary,
  type MembershipStatus,
} from '../../../components/guildos/api/community-list-api';
import { DashboardShell } from '../../../components/guildos/dashboard/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard/dashboard-topbar';
import { Badge } from '../../../components/guildos/ui/badge';
import { Button } from '../../../components/guildos/ui/button';
import { CommunityPicker } from '../../../components/guildos/dashboard/community-picker';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { SelectMenu } from '../../../components/guildos/ui/select-menu';

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

const ACTIVITY_LABEL: Record<string, string> = {
  MEMBER_JOINED: 'Joined',
  MEMBER_LEFT: 'Left',
  MEMBER_REMOVED: 'Removed',
  ROLE_ASSIGNED: 'Role changed',
  ROLE_REMOVED: 'Role removed',
  STATUS_CHANGED: 'Status changed',
};

function prettyRole(role: string) {
  return role.replace(/_/g, ' ').toLowerCase();
}

function timeAgo(value: string) {
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ASSIGNABLE_ROLES = ['MEMBER', 'VOLUNTEER', 'COORDINATOR', 'ORGANIZER', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT'];

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

  // Errors surface as a floating toast — auto-dismiss so it never lingers stale.
  useEffect(() => {
    if (!actionError) return;
    const t = setTimeout(() => setActionError(''), 8000);
    return () => clearTimeout(t);
  }, [actionError]);
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
  const pendingRequests = joinRequests.filter((r) => r.status === 'PENDING');
  const [roleFilter, setRoleFilter] = useState('');
  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of memberRows) counts.set(m.membership.role, (counts.get(m.membership.role) ?? 0) + 1);
    return [...counts.entries()];
  }, [memberRows]);
  const visibleMembers = roleFilter ? memberRows.filter((m) => m.membership.role === roleFilter) : memberRows;
  const [inviteText, setInviteText] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResult, setInviteResult] = useState('');
  const parsedInvites = useMemo(
    () => Array.from(new Set(inviteText.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RX.test(e)))).slice(0, 50),
    [inviteText],
  );

  async function handleInvite() {
    if (!community || !parsedInvites.length) return;
    try {
      setInviteBusy(true);
      setInviteResult('');
      const result = await inviteMembersByEmail(community._id, parsedInvites);
      setInviteResult(
        `Sent ${result.sent} invite${result.sent === 1 ? '' : 's'}.` +
          (result.skippedMembers ? ` ${result.skippedMembers} already ${result.skippedMembers === 1 ? 'is a member' : 'are members'}.` : '') +
          (result.failed.length ? ` Couldn’t send to: ${result.failed.join(', ')}.` : ''),
      );
      setInviteText('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to send invites');
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleApproveAll() {
    if (!community) return;
    for (const request of pendingRequests) {
      try {
        setBusyId(request._id);
        await approveCommunityJoinRequest(community._id, request._id);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Unable to approve a request');
        break;
      }
    }
    setBusyId('');
    await refresh();
  }

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
        <div className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 shadow-sm">
          <LogoSpinner />
        </div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Community"
        title="Members"
        subtitle="Approve join requests, assign roles, and keep your member list healthy."
        toolbar={
          <>
            <CommunityPicker communities={communities} value={selectedSlug} onChange={setSelectedSlug} valueKey="slug" />
            {community ? (
              <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                <Badge tone="indigo">You: {(viewerRole || 'Not a member').replace(/_/g, ' ').toLowerCase()}</Badge>
                <Badge>{community.memberCount} members</Badge>
              </div>
            ) : null}
          </>
        }
      />

      {actionError ? (
        <div className="fixed inset-x-4 bottom-24 z-[100] mx-auto flex max-w-xl items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg dark:border-red-500/30 dark:bg-red-950 dark:text-red-300" role="alert">
          <span className="flex-1">{actionError}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setActionError('')} className="shrink-0 rounded-lg px-1.5 text-base font-semibold leading-none transition hover:bg-red-100 dark:hover:bg-red-500/20">×</button>
        </div>
      ) : null}

      {contextLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 shadow-sm">
          <LogoSpinner />
        </div>
      ) : (
        <>
          {canReview && pendingRequests.length ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-5 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">{pendingRequests.length} {pendingRequests.length === 1 ? 'person wants' : 'people want'} to join</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">They can’t see member-only posts or events until you approve them.</p>
                </div>
                {pendingRequests.length > 1 ? (
                  <Button variant="primary" size="sm" onClick={() => void handleApproveAll()} disabled={Boolean(busyId)}>Approve all</Button>
                ) : null}
              </div>
              <ul className="mt-4 space-y-2">
                {pendingRequests.map((request) => (
                  <li key={request._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200/70 bg-white px-3 py-2.5 dark:border-amber-500/20 dark:bg-slate-900">
                    <MemberAvatar fullName={request.user?.fullName ?? '?'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{request.user?.fullName ?? 'A student'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Asked {timeAgo(request.requestedAt)}{request.notes ? ` · “${request.notes}”` : ''}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={() => void handleResolveRequest(request._id, 'approve')} disabled={busyId === request._id}>Approve</Button>
                      <Button variant="secondary" size="sm" onClick={() => void handleResolveRequest(request._id, 'reject')} disabled={busyId === request._id}>Decline</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">Members <span className="text-sm font-normal text-slate-500 dark:text-slate-400">({memberTotal || memberRows.length})</span></h2>
                <div className="relative ml-auto w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                    placeholder="Search members"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>
              {roleCounts.length > 1 ? (
                <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                  {[['', memberRows.length] as const, ...roleCounts].map(([role, count]) => (
                    <button
                      key={role || 'all'}
                      type="button"
                      onClick={() => setRoleFilter(role)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${roleFilter === role ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
                    >
                      {role ? prettyRole(role) : 'Everyone'} ({count})
                    </button>
                  ))}
                </div>
              ) : null}

              {visibleMembers.length ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleMembers.map((entry) => {
                    const isFounderRow = entry.membership.role === 'FOUNDER';
                    const status = entry.membership.status ?? 'ACTIVE';
                    const rowBusy = busyId === entry.membership._id;
                    return (
                      <li key={entry.user.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <MemberAvatar fullName={entry.user.fullName} avatar={entry.user.profile?.avatar} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 truncate font-medium text-slate-950 dark:text-white">
                            {entry.user.fullName}
                            {entry.user.id === currentUserId ? <span className="text-xs font-normal text-slate-400">(you)</span> : null}
                            {status !== 'ACTIVE' ? <Badge tone={status === 'SUSPENDED' ? 'warning' : 'danger'}>{status.toLowerCase()}</Badge> : null}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Joined {entry.membership.joinedAt ? new Date(entry.membership.joinedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'date unknown'}</p>
                        </div>
                        {canManage && !isFounderRow ? (
                          <>
                            <SelectMenu
                              aria-label={`Role for ${entry.user.fullName}`}
                              className="w-40"
                              size="sm"
                              value={entry.membership.role}
                              onChange={(v) => void handleChangeRole(entry.membership._id, v)}
                              disabled={rowBusy}
                              options={ASSIGNABLE_ROLES.map((role) => ({ value: role, label: prettyRole(role) }))}
                            />
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => void handleSetStatus(entry.membership._id, status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED')} disabled={rowBusy}>
                                {status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                              </Button>
                              <Button size="sm" variant="secondary" className="whitespace-nowrap border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10" onClick={() => void handleSetStatus(entry.membership._id, 'REMOVED')} disabled={rowBusy}>
                                Remove
                              </Button>
                              {isFounder ? (
                                <Button size="sm" variant="ghost" className="whitespace-nowrap" title="Hand the community over to this member" onClick={() => void handleTransferOwnership(entry.membership._id)} disabled={rowBusy}>
                                  Make owner
                                </Button>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <Badge tone={isFounderRow ? 'indigo' : 'default'}>{prettyRole(entry.membership.role)}</Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {!viewerRole ? 'You need a leadership role to manage members here.' : memberSearch.trim() || roleFilter ? 'No members match.' : 'No members yet. Invite people with the form on the right.'}
                </p>
              )}
              {memberCursor ? (
                <div className="px-4 pb-4">
                  <button
                    onClick={() => void loadMoreMembers()}
                    disabled={memberBusy}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    {memberBusy ? 'Loading…' : `Load more (${memberRows.length} of ${memberTotal})`}
                  </button>
                </div>
              ) : null}
            </section>

            <div className="grid min-w-0 grid-cols-1 content-start gap-6">
              {canManage && community ? (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white"><UserPlus className="h-4 w-4 text-indigo-500" /> Invite people</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Paste email addresses, separated by commas or new lines. Each person gets a branded email with a join link.</p>
                  <textarea
                    value={inviteText}
                    onChange={(e) => setInviteText(e.target.value)}
                    rows={4}
                    placeholder={'ada@unilag.edu.ng\ntunde@gmail.com'}
                    className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                  {inviteResult ? <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">{inviteResult}</p> : null}
                  <Button variant="primary" className="mt-3 w-full" onClick={() => void handleInvite()} disabled={inviteBusy || !parsedInvites.length}>
                    {inviteBusy ? 'Sending…' : parsedInvites.length ? `Send ${parsedInvites.length} invite${parsedInvites.length === 1 ? '' : 's'}` : 'Add email addresses'}
                  </Button>
                </section>
              ) : null}

              {canReview ? (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">Recent changes</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Role and membership changes are logged for accountability.</p>
                  {activity.length ? (
                    <ul className="mt-3 space-y-2.5">
                      {activity.slice(0, 8).map((entry) => (
                        <li key={entry.id} className="text-sm">
                          <p className="text-slate-700 dark:text-slate-300">
                            <span className="font-medium text-slate-900 dark:text-slate-100">{ACTIVITY_LABEL[entry.action] ?? entry.action.replace(/_/g, ' ').toLowerCase()}</span>
                            {entry.member ? <span>: {entry.member.fullName}</span> : null}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{entry.actor ? `by ${entry.actor.fullName} · ` : ''}{timeAgo(entry.createdAt)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Nothing yet.</p>
                  )}
                </section>
              ) : null}
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  );
}

function MemberAvatar({ fullName, avatar }: { fullName: string; avatar?: string }) {
  const [broken, setBroken] = useState(false);
  const url = broken ? '' : resolveAvatarUrl(avatar);
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (url) {
    return <img src={url} alt="" onError={() => setBroken(true)} className="h-10 w-10 shrink-0 rounded-full border border-slate-200 dark:border-slate-800 object-cover" />;
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-950 text-sm font-medium text-slate-500 dark:text-slate-400">
      {initials || '?'}
    </div>
  );
}