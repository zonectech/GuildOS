'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, Users, CalendarDays, MessageCircle, Radio, Grid3x3, IdCard, UserPlus } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import { approveCommunityJoinRequest, archiveCommunity, createCommunityInviteLink, deleteCommunity, getCommunity, getCommunityJoinRequests, joinCommunity, leaveCommunity, rejectCommunityJoinRequest, resolveAvatarUrl, revokeCommunityInviteLink, transferCommunityOwnership, updateCommunityMemberRole, updateMembershipStatus, type CommunityEndorsement, type CommunityJoinRequest, type CommunitySummary, type MembershipStatus } from '../../../components/guildos/community-list-api';
import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { StudentNav } from '../../../components/guildos/student-nav';
import { Button } from '../../../components/guildos/ui/button';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { CommunityPosts } from '../../../components/guildos/feed/community-posts';
import { getFollowedCommunityIds, toggleCommunityFollow } from '../../../components/guildos/follow-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function normalizeCommunityImageUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
}

type ViewerMembership = { role: string } | null;

type CommunityContext = {
  community: CommunitySummary;
  viewerMembership?: ViewerMembership;
  viewerJoinRequest?: CommunityJoinRequest | null;
  leadership?: Array<{ membership: { _id: string; role: string; joinedAt?: string }; user: { id: string; fullName: string; profile?: { avatar?: string } } }>;
  endorsements?: CommunityEndorsement[];
  members?: Array<{ membership: { _id: string; role: string; status?: MembershipStatus; joinedAt?: string; assignedBy?: string | null }; user: { id: string; fullName: string; profile?: { avatar?: string } } }>;
  joinRequests?: CommunityJoinRequest[];
};

export default function CommunityDetailPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [context, setContext] = useState<CommunityContext | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [roleUpdateBusy, setRoleUpdateBusy] = useState('');
  const [joinRequests, setJoinRequests] = useState<CommunityJoinRequest[]>([]);
  const [requestBusy, setRequestBusy] = useState('');
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [tab, setTab] = useState<'profile' | 'posts'>('profile');

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        setCurrentUserId(user.id);
        const response = await getCommunity(slug);
        setContext(response as CommunityContext);
        setFollowerCount(response.community?.followerCount ?? 0);
        if (response.community?._id) {
          try {
            const { communityIds } = await getFollowedCommunityIds();
            setFollowing(communityIds.includes(response.community._id));
          } catch {
            /* ignore */
          }
        }
        if (response.joinRequests) {
          setJoinRequests(response.joinRequests as CommunityJoinRequest[]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load community');
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      void load();
    }
  }, [router, slug]);

  const community = context?.community;
  const isFounder = community?.founder === currentUserId;
  const isMember = Boolean(context?.viewerMembership);
  const isArchived = Boolean(community?.archivedAt);
  const hasPendingJoinRequest = context?.viewerJoinRequest?.status === 'PENDING';
  const canJoin = Boolean(community && !isArchived && !isFounder && !isMember && !hasPendingJoinRequest && community.visibility === 'PUBLIC');
  const canInvite = Boolean(isFounder || (context?.viewerMembership?.role === 'PRESIDENT'));
  const canEdit = Boolean(isFounder);
  const canLeave = Boolean(isMember && context?.viewerMembership?.role !== 'FOUNDER');
  const canDelete = Boolean(isFounder);
  const canArchive = Boolean(isFounder && !isArchived);
  const canViewMembers = Boolean(context?.viewerMembership && ['COORDINATOR', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'].includes(context.viewerMembership.role));
  const canManageRoles = Boolean(context?.viewerMembership && ['VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'].includes(context.viewerMembership.role));
  const canManageMembers = canManageRoles;
  const canReviewRequests = Boolean(context?.viewerMembership && ['PRESIDENT', 'FOUNDER'].includes(context.viewerMembership.role));

  async function handleFollow() {
    if (!community) return;
    try {
      const { following: isFollowing } = await toggleCommunityFollow(community._id);
      setFollowing(isFollowing);
      setFollowerCount((c) => Math.max(0, c + (isFollowing ? 1 : -1)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update follow');
    }
  }

  const leadership = useMemo(() => context?.leadership ?? [], [context]);
  const endorsements = useMemo(() => context?.endorsements ?? [], [context]);
  const members = useMemo(() => context?.members ?? [], [context]);

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
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

  async function handleJoin() {
    if (!community) return;
    try {
      setActionBusy(true);
      setActionError('');
      await joinCommunity(community._id);
      const response = await getCommunity(community.slug);
      setContext(response as CommunityContext);
      if (response.joinRequests) {
        setJoinRequests(response.joinRequests as CommunityJoinRequest[]);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to join community');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleLeave() {
    if (!community) return;
    try {
      setActionBusy(true);
      setActionError('');
      await leaveCommunity(community._id);
      const response = await getCommunity(community.slug);
      setContext(response as CommunityContext);
      if (response.joinRequests) {
        setJoinRequests(response.joinRequests as CommunityJoinRequest[]);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to leave community');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCreateInviteLink() {
    if (!community) return;
    try {
      setInviteBusy(true);
      setActionError('');
      const result = await createCommunityInviteLink(community._id);
      setInviteLink(`${window.location.origin}${result.inviteLink}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create invite link');
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleCopyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      setActionError('Unable to copy invite link');
    }
  }

  async function handleRevokeInviteLink() {
    if (!community) return;
    try {
      setInviteBusy(true);
      setActionError('');
      await revokeCommunityInviteLink(community._id);
      setInviteLink('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to revoke invite link');
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleDelete() {
    if (!community) return;
    const confirmed = window.confirm(`Delete ${community.name}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      setActionBusy(true);
      setActionError('');
      await deleteCommunity(community._id);
      router.push('/dashboard/communities');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete community');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleArchive() {
    if (!community) return;

    const confirmed = window.confirm(`Archive ${community.name}? This will disable join and invite actions.`);
    if (!confirmed) return;

    try {
      setActionBusy(true);
      setActionError('');
      await archiveCommunity(community._id, 'Archived from community dashboard');
      const response = await getCommunity(community.slug);
      setContext(response as CommunityContext);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to archive community');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleChangeMemberRole(memberId: string, nextRole: string) {
    if (!community) return;

    try {
      setRoleUpdateBusy(memberId);
      setActionError('');
      await updateCommunityMemberRole(community._id, memberId, nextRole);
      const response = await getCommunity(community.slug);
      setContext(response as CommunityContext);
      if (response.joinRequests) {
        setJoinRequests(response.joinRequests as CommunityJoinRequest[]);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update member role');
    } finally {
      setRoleUpdateBusy('');
    }
  }

  async function handleSetMemberStatus(memberId: string, status: MembershipStatus) {
    if (!community) return;

    if (status === 'REMOVED') {
      const confirmed = window.confirm('Remove this member from the community?');
      if (!confirmed) return;
    }

    try {
      setRoleUpdateBusy(memberId);
      setActionError('');
      await updateMembershipStatus(memberId, status);
      const response = await getCommunity(community.slug);
      setContext(response as CommunityContext);
      if (response.joinRequests) {
        setJoinRequests(response.joinRequests as CommunityJoinRequest[]);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update member status');
    } finally {
      setRoleUpdateBusy('');
    }
  }

  async function handleTransferOwnership(memberId: string) {
    if (!community) return;

    const confirmed = window.confirm('Transfer ownership to this member? You will remain a leadership member.');
    if (!confirmed) return;

    try {
      setRoleUpdateBusy(memberId);
      setActionError('');
      await transferCommunityOwnership(community._id, memberId);
      const response = await getCommunity(community.slug);
      setContext(response as CommunityContext);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to transfer ownership');
    } finally {
      setRoleUpdateBusy('');
    }
  }

  async function refreshJoinRequests() {
    if (!community) return;
    const response = await getCommunityJoinRequests(community._id);
    setJoinRequests(response.joinRequests);
  }

  async function handleApproveJoinRequest(requestId: string) {
    if (!community) return;

    try {
      setRequestBusy(requestId);
      setActionError('');
      await approveCommunityJoinRequest(community._id, requestId);
      await refreshJoinRequests();
      const response = await getCommunity(community.slug);
      setContext(response as CommunityContext);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to approve join request');
    } finally {
      setRequestBusy('');
    }
  }

  async function handleRejectJoinRequest(requestId: string) {
    if (!community) return;

    try {
      setRequestBusy(requestId);
      setActionError('');
      await rejectCommunityJoinRequest(community._id, requestId);
      await refreshJoinRequests();
      const response = await getCommunity(community.slug);
      setContext(response as CommunityContext);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to reject join request');
    } finally {
      setRequestBusy('');
    }
  }

  if (!community) {
    return null;
  }

  const isInsider = isMember || isFounder;

  const content = (
    <>
      <SectionHeader
        eyebrow="Community Profile"
        title={community.name}
        subtitle={community.shortDescription}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="relative h-48 bg-gradient-to-r from-indigo-600 to-sky-500">
              {community.coverImage ? (
                <img
                  src={normalizeCommunityImageUrl(community.coverImage)}
                  alt={`${community.name} cover`}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="relative z-10 px-6 pb-6">
              <div className="-mt-12 h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
                {community.logo ? (
                  <img src={normalizeCommunityImageUrl(community.logo)} alt={community.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xl font-semibold text-slate-500">
                    {community.name.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold text-slate-950">{community.name}</h2>
                  {community.verificationStatus === 'VERIFIED' ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : null}
                  {isArchived ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Archived</span> : null}
                </div>
                <p className="text-sm text-slate-500">{community.category}{community.university ? ` · ${community.university}` : ''}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>{community.visibility}</Badge>
                <Badge>{community.verificationStatus}</Badge>
                <Badge><Users className="mr-1 h-3.5 w-3.5" />{community.memberCount} members</Badge>
                <Badge><CalendarDays className="mr-1 h-3.5 w-3.5" />{community.eventCount} events</Badge>
                {followerCount ? <Badge><UserPlus className="mr-1 h-3.5 w-3.5" />{followerCount} followers</Badge> : null}
              </div>

              {community.whatsappLink || community.channelLink ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {community.whatsappLink ? (
                    <a href={community.whatsappLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                      <MessageCircle className="h-3.5 w-3.5" /> Join WhatsApp group
                    </a>
                  ) : null}
                  {community.channelLink ? (
                    <a href={community.channelLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700">
                      <Radio className="h-3.5 w-3.5" /> Open channel
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="sticky top-2 z-20 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button onClick={() => setTab('profile')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === 'profile' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              <IdCard className="h-4 w-4" /> Profile
            </button>
            <button onClick={() => setTab('posts')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === 'posts' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Grid3x3 className="h-4 w-4" /> Posts
            </button>
          </div>

          {tab === 'profile' ? (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <Panel title="About">
                  <div className="space-y-3 text-sm text-slate-600">
                    <p>{community.description || community.shortDescription}</p>
                    <InfoRow label="University" value={community.university} />
                    <InfoRow label="Faculty" value={community.faculty || '—'} />
                    <InfoRow label="Department" value={community.department || '—'} />
                  </div>
                </Panel>

                <Panel title="Leadership Team">
                  <div className="space-y-3">
                    {leadership.length ? (
                      leadership.map((entry) => (
                        <div key={entry.user.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-900">{entry.user.fullName}</p>
                            <p className="text-sm text-slate-500">{entry.membership.role}</p>
                          </div>
                          <span className="text-xs text-slate-400">Joined</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No leadership members yet.</p>
                    )}
                  </div>
                </Panel>
              </div>

              <Panel title="Endorsements">
                <div className="space-y-3">
                  {endorsements.length ? (
                    endorsements.map((entry) => (
                      <div key={entry.endorsement._id} className="rounded-2xl border border-slate-200 px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-slate-900">{entry.user.fullName}</p>
                            <p className="text-sm text-slate-500">{new Date(entry.endorsement.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">Verified leader</span>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">{entry.endorsement.note || 'No endorsement note provided.'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No endorsements have been recorded yet.</p>
                  )}
                </div>
              </Panel>

              <Panel title="Events">
                <div className="grid gap-4 md:grid-cols-3">
                  <Stat label="Upcoming Events" value="0" />
                  <Stat label="Completed Events" value="0" />
                  <Stat label="Attendance Statistics" value="—" />
                </div>
              </Panel>
            </>
          ) : (
            <div className="space-y-4">
              <CommunityPosts communityId={community._id} currentUserId={currentUserId} canPost={canViewMembers} communityName={community.name} />
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <Panel title="Actions">
            <div className="space-y-3">
              {actionError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div> : null}
              <button
                onClick={() => void handleFollow()}
                className={`w-full rounded-2xl px-4 py-2 text-sm font-medium transition ${following ? 'border border-slate-300 bg-white text-slate-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                {following ? '✓ Following' : 'Follow'}{followerCount ? ` · ${followerCount}` : ''}
              </button>
              {canJoin ? (
                <Button variant="primary" className="w-full" onClick={handleJoin} disabled={actionBusy}>
                  Request to Join
                </Button>
              ) : hasPendingJoinRequest ? (
                <Button variant="primary" className="w-full" disabled>
                  Join Requested
                </Button>
              ) : null}
              {canLeave ? (
                <Button variant="secondary" className="w-full" onClick={handleLeave} disabled={actionBusy}>
                  Leave Community
                </Button>
              ) : null}
              {canInvite ? (
                <Button variant="secondary" className="w-full" onClick={handleCreateInviteLink} disabled={inviteBusy}>
                  Generate Invite Link
                </Button>
              ) : null}
              {inviteLink ? (
                <Button variant="secondary" className="w-full" onClick={handleCopyInviteLink}>
                  Copy Invite Link
                </Button>
              ) : null}
              {inviteLink ? (
                <Button variant="secondary" className="w-full" onClick={handleRevokeInviteLink} disabled={inviteBusy}>
                  Revoke Invite Link
                </Button>
              ) : null}
              {canEdit ? (
                <Button variant="secondary" asChild href={`/dashboard/communities/${community.slug}/edit`} className="w-full">
                  Edit Community
                </Button>
              ) : null}
              {canDelete ? (
                <Button variant="secondary" onClick={handleDelete} disabled={actionBusy} className="w-full">
                  Delete Community
                </Button>
              ) : null}
              {canArchive ? (
                <Button variant="secondary" onClick={handleArchive} disabled={actionBusy} className="w-full">
                  Archive Community
                </Button>
              ) : null}
              <Button variant="secondary" asChild href="/dashboard/events" className="w-full">
                Create Event
              </Button>
            </div>
          </Panel>

          {canViewMembers ? (
            <Panel title="Members">
              <div className="space-y-3">
                {members.length ? (
                  members.map((entry) => (
                    <div key={entry.user.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <MemberAvatar fullName={entry.user.fullName} avatar={entry.user.profile?.avatar} />
                        <div>
                          <p className="font-medium text-slate-900">{entry.user.fullName}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-slate-500">{entry.membership.role}</p>
                            {entry.membership.status && entry.membership.status !== 'ACTIVE' ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{entry.membership.status}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canManageRoles && entry.membership.role === 'FOUNDER' ? (
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">FOUNDER</span>
                        ) : canManageRoles ? (
                          <label className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="whitespace-nowrap">Role</span>
                            <select
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                              value={entry.membership.role}
                              onChange={(event) => void handleChangeMemberRole(entry.membership._id, event.target.value)}
                              disabled={roleUpdateBusy === entry.membership._id || entry.membership.role === 'FOUNDER'}
                            >
                              {['MEMBER', 'VOLUNTEER', 'COORDINATOR', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT'].map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        {canManageMembers && entry.membership.role !== 'FOUNDER' ? (
                          entry.membership.status === 'SUSPENDED' ? (
                            <Button variant="secondary" onClick={() => void handleSetMemberStatus(entry.membership._id, 'ACTIVE')} disabled={roleUpdateBusy === entry.membership._id}>
                              Reactivate
                            </Button>
                          ) : (
                            <Button variant="secondary" onClick={() => void handleSetMemberStatus(entry.membership._id, 'SUSPENDED')} disabled={roleUpdateBusy === entry.membership._id}>
                              Suspend
                            </Button>
                          )
                        ) : null}
                        {canManageMembers && entry.membership.role !== 'FOUNDER' ? (
                          <Button variant="secondary" onClick={() => void handleSetMemberStatus(entry.membership._id, 'REMOVED')} disabled={roleUpdateBusy === entry.membership._id}>
                            Remove
                          </Button>
                        ) : null}
                        {isFounder && entry.membership.role !== 'FOUNDER' ? (
                          <Button variant="secondary" onClick={() => void handleTransferOwnership(entry.membership._id)} disabled={roleUpdateBusy === entry.membership._id}>
                            Transfer Ownership
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No member records available yet.</p>
                )}
              </div>
            </Panel>
          ) : null}

          {canReviewRequests ? (
            <Panel title="Join Requests">
              <div className="space-y-3">
                {joinRequests.length ? (
                  joinRequests.map((request) => (
                    <div key={request._id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{request.user?.fullName ?? `Request from user ${request.userId}`}</p>
                        <p className="text-sm text-slate-500">Status: {request.status}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => void handleApproveJoinRequest(request._id)} disabled={requestBusy === request._id}>
                          Approve
                        </Button>
                        <Button variant="secondary" onClick={() => void handleRejectJoinRequest(request._id)} disabled={requestBusy === request._id}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No pending join requests.</p>
                )}
              </div>
            </Panel>
          ) : null}
        </aside>
      </div>
    </>
  );

  if (isInsider) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        {content}
      </DashboardShell>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav active="/communities" />
      <main className="mx-auto max-w-6xl px-4 py-8">{content}</main>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{children}</span>;
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
    return <img src={url} alt={fullName} className="h-10 w-10 rounded-full border border-slate-200 object-cover" />;
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-500">
      {initials || '?'}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
