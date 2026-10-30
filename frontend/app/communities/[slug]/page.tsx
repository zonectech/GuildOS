'use client';

import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../components/guildos/ui/loading';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BookOpen, Grid3x3, IdCard } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/api/auth-api';
import {
  approveCommunityJoinRequest, archiveCommunity, createCommunityInviteLink, deleteCommunity, getCommunity,
  getCommunityEndorsements, getCommunityJoinRequests, joinCommunity, leaveCommunity, rejectCommunityJoinRequest,
  revokeCommunityInviteLink, transferCommunityOwnership, updateCommunity, updateCommunityMemberRole, updateMembershipStatus,
  getCommunityLeaders, updateCommunityLeader, getCommunityMemberAnalytics,
  type CommunityEndorsement, type CommunityJoinRequest, type MembershipStatus, type CommunityLeader,
  type CommunityMemberAnalytics,
} from '../../../components/guildos/api/community-list-api';
import { DashboardShell } from '../../../components/guildos/dashboard/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard/dashboard-topbar';
import { StudentNav } from '../../../components/guildos/student-nav';
import { CommunityPosts } from '../../../components/guildos/feed/community-posts';
import { CommunityKnowledge } from '../../../components/guildos/community/community-knowledge';
import { getFollowedCommunityIds, toggleCommunityFollow } from '../../../components/guildos/api/follow-api';
import { getCommunitySponsors, listEvents, type CommunitySponsorEntry, type EventSummary } from '../../../components/guildos/api/event-api';

import { CommunityHero } from './_components/community-hero';
import { EventGallery } from '../../../components/guildos/events/event-gallery';
import { CommunityAboutCards, CommunityEventsCard, CommunitySponsorsCard } from './_components/profile-cards';
import { LeadershipCard } from './_components/leadership-card';
import { EndorsementsCard } from './_components/endorsements-card';
import { MembersCard } from './_components/members-card';
import { JoinRequestsCard } from './_components/join-requests-card';
import {
  AnnouncementComposer, CommunityActionsCard, CommunityInfoCard, LeadersMiniList, MemberAnalyticsCard, SetupChecklistCard,
} from './_components/sidebar-cards';
import { DeleteCommunityModal, InviteEmailsModal } from './_components/community-modals';
import { LeaderDetailModal } from './_components/leader-detail-modal';
import { LeaderEditorModal } from './_components/leader-editor-modal';
import { ImageLightbox } from './_components/leader-ui';
import { MANAGER_ROLES, type CommunityContext } from './_components/types';

type LeaderEditor = { leader: CommunityLeader | null } | null;

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
  const [joinModeBusy, setJoinModeBusy] = useState(false);
  const [requestBusy, setRequestBusy] = useState('');
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [tab, setTab] = useState<'profile' | 'posts' | 'knowledge'>('profile');
  const [knowledgeResourceId, setKnowledgeResourceId] = useState('');
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [endorsements, setEndorsements] = useState<CommunityEndorsement[]>([]);
  const [serverCanEndorse, setServerCanEndorse] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ src: string; alt: string } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Manager extras: member analytics card + bulk email invites.
  const [memberAnalytics, setMemberAnalytics] = useState<CommunityMemberAnalytics | null>(null);
  const [inviteEmailsOpen, setInviteEmailsOpen] = useState(false);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [sponsorRoster, setSponsorRoster] = useState<{ sponsors: CommunitySponsorEntry[]; totalSponsors: number; eventsSponsored: number } | null>(null);

  // Curated leadership roster (CommunityLeader) — independent of Membership/role.
  const [leaders, setLeaders] = useState<CommunityLeader[]>([]);
  const [viewLeader, setViewLeader] = useState<CommunityLeader | null>(null);
  const [leaderEditor, setLeaderEditor] = useState<LeaderEditor>(null);

  // Deep links from global search: /communities/<slug>?tab=knowledge&resource=<id>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t === 'knowledge' || t === 'posts') setTab(t);
    const resource = params.get('resource');
    if (resource) {
      setTab('knowledge');
      setKnowledgeResourceId(resource);
    }
  }, []);

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
        setEndorsements(response.endorsements ?? []);
        setFollowerCount(response.community?.followerCount ?? 0);
        if (response.joinRequests) {
          setJoinRequests(response.joinRequests as CommunityJoinRequest[]);
        }
        const communityId = response.community?._id;
        if (communityId) {
          try {
            // Server decides endorse eligibility (verified leader of an active
            // community with 5+ completed events) — never show a dead form.
            const endorsementInfo = await getCommunityEndorsements(communityId);
            setEndorsements(endorsementInfo.endorsements ?? response.endorsements ?? []);
            setServerCanEndorse(Boolean(endorsementInfo.viewerCanEndorse));
          } catch {
            /* endorsements are non-critical */
          }
          try {
            const { communityIds } = await getFollowedCommunityIds();
            setFollowing(communityIds.includes(communityId));
          } catch {
            /* ignore */
          }
          try {
            const { events: communityEvents } = await listEvents(communityId);
            setEvents(communityEvents ?? []);
          } catch {
            /* events are non-critical for the profile */
          }
          try {
            const { leaders: fetchedLeaders } = await getCommunityLeaders(communityId);
            setLeaders(fetchedLeaders ?? []);
          } catch {
            /* leaders are non-critical for the profile */
          }
          // Sponsor roster — social proof card; fire-and-forget.
          void getCommunitySponsors(communityId)
            .then((r) => setSponsorRoster(r))
            .catch(() => undefined);
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
  const viewerRole = context?.viewerMembership?.role;
  const isFounder = community?.founder === currentUserId;
  const isMember = Boolean(context?.viewerMembership);
  const isInsider = isMember || isFounder;
  const isArchived = Boolean(community?.archivedAt);
  const hasPendingJoinRequest = context?.viewerJoinRequest?.status === 'PENDING';
  const canJoin = Boolean(community && !isArchived && !isFounder && !isMember && !hasPendingJoinRequest && community.visibility === 'PUBLIC');
  const canInvite = Boolean(isFounder || viewerRole === 'PRESIDENT');
  const canEdit = Boolean(isFounder);
  const canLeave = Boolean(isMember && viewerRole !== 'FOUNDER');
  const canDelete = Boolean(isFounder);
  const canArchive = Boolean(isFounder && !isArchived);
  const canViewMembers = Boolean(viewerRole && MANAGER_ROLES.includes(viewerRole));
  const canAnnounce = Boolean(viewerRole && ['SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'].includes(viewerRole)); // matches the backend SECRETARY+ announcement gate
  const canManageRoles = Boolean(viewerRole && ['VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'].includes(viewerRole));
  const canReviewRequests = Boolean(viewerRole && ['PRESIDENT', 'FOUNDER'].includes(viewerRole));
  const alreadyEndorsed = endorsements.some((entry) => entry.user.id === currentUserId);
  const canEndorse = Boolean(
    community && !isArchived && !isFounder && community.verificationStatus === 'PENDING' && !alreadyEndorsed && serverCanEndorse,
  );

  const sortedEvents = useMemo(() => {
    const now = Date.now();
    return [...events].sort((a, b) => {
      const at = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bt = b.startDate ? new Date(b.startDate).getTime() : 0;
      // Cancelled events never count as upcoming — they sort with past events.
      const aUpcoming = at >= now && a.status !== 'ARCHIVED';
      const bUpcoming = bt >= now && b.status !== 'ARCHIVED';
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return aUpcoming ? at - bt : bt - at;
    });
  }, [events]);

  // Manager-only member analytics (COORDINATOR+) — fire-and-forget, card renders when it lands.
  useEffect(() => {
    if (!community?._id || !canViewMembers) return;
    getCommunityMemberAnalytics(community._id)
      .then(({ analytics }) => setMemberAnalytics(analytics))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [community?._id, canViewMembers]);

  /** Founder setup checklist — fights the empty-community cold start. */
  const setupChecklist = useMemo(() => {
    if (!community) return [];
    return [
      { label: 'Add a logo', done: Boolean(community.logo), href: `/dashboard/communities/${community.slug}/edit` },
      { label: 'Add a cover image', done: Boolean(community.coverImage), href: `/dashboard/communities/${community.slug}/edit` },
      { label: 'Add community photos', done: Boolean(community.gallery?.length), href: `/dashboard/communities/${community.slug}/edit` },
      { label: 'Write the About section', done: community.description.trim().length >= 40, href: `/dashboard/communities/${community.slug}/edit` },
      { label: 'Set community rules', done: Boolean(community.rules?.length), href: `/dashboard/communities/${community.slug}/edit` },
      { label: 'List your leadership team', done: leaders.length > 0, href: `/communities/${community.slug}/leaders` },
      { label: 'Host your first event', done: events.length > 0, href: '/dashboard/events/create' },
      { label: 'Grow past 5 members', done: community.memberCount > 5, href: '#invite' },
    ];
  }, [community, leaders.length, events.length]);

  const leadership = useMemo(() => context?.leadership ?? [], [context]);
  const members = useMemo(() => context?.members ?? [], [context]);

  // Existing session labels (most recent first) — offered as autocomplete suggestions
  // so leaders re-use "2026/2027" instead of typos like "2026/27".
  const sessionSuggestions = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const leader of leaders) {
      const label = leader.session.trim();
      if (!label) continue;
      const t = new Date(leader.updatedAt || leader.createdAt).getTime();
      buckets.set(label, Math.max(buckets.get(label) ?? 0, t));
    }
    return Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]).map(([label]) => label);
  }, [leaders]);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 dark:bg-slate-950">
        <LogoSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
        <StudentNav active="/communities" />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div>
        </main>
      </div>
    );
  }

  if (!community) {
    return null;
  }

  /** Re-fetch the community context (membership, members page, join requests) after a mutation. */
  async function reloadContext() {
    const response = await getCommunity(community!.slug);
    setContext(response as CommunityContext);
    if (response.joinRequests) {
      setJoinRequests(response.joinRequests as CommunityJoinRequest[]);
    }
  }

  /** Runs a community action with the shared busy flag + error banner. */
  async function runAction(action: () => Promise<void>, fallbackError: string, setBusy: (busy: boolean) => void = setActionBusy) {
    try {
      setBusy(true);
      setActionError('');
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallbackError);
    } finally {
      setBusy(false);
    }
  }

  /** Same as runAction, keyed to one member row so only that row's controls disable. */
  async function runMemberAction(memberId: string, action: () => Promise<void>, fallbackError: string) {
    try {
      setRoleUpdateBusy(memberId);
      setActionError('');
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallbackError);
    } finally {
      setRoleUpdateBusy('');
    }
  }

  async function handleFollow() {
    try {
      const { following: isFollowing } = await toggleCommunityFollow(community!._id);
      setFollowing(isFollowing);
      setFollowerCount((c) => Math.max(0, c + (isFollowing ? 1 : -1)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update follow');
    }
  }

  function openPeople(kind: 'members' | 'followers') {
    router.push(`/communities/${encodeURIComponent(community!.slug)}/people?tab=${kind}`);
  }

  async function handleCopyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      setActionError('Unable to copy invite link');
    }
  }

  async function handleArchive() {
    const confirmed = await confirmDialog({ title: `Archive ${community!.name}?`, message: 'This will disable join and invite actions.', confirmLabel: 'Archive', tone: 'danger' });
    if (!confirmed) return;
    await runAction(async () => {
      await archiveCommunity(community!._id, 'Archived from community dashboard');
      await reloadContext();
    }, 'Unable to archive community');
  }

  async function handleSetMemberStatus(memberId: string, status: MembershipStatus) {
    if (status === 'REMOVED') {
      const confirmed = await confirmDialog({ title: 'Remove this member?', message: 'They will be removed from the community.', confirmLabel: 'Remove', tone: 'danger' });
      if (!confirmed) return;
    }
    await runMemberAction(memberId, async () => {
      await updateMembershipStatus(memberId, status);
      await reloadContext();
    }, 'Unable to update member status');
  }

  async function handleTransferOwnership(memberId: string) {
    const confirmed = await confirmDialog({ title: 'Transfer ownership?', message: 'You will remain a leadership member.', confirmLabel: 'Transfer' });
    if (!confirmed) return;
    await runMemberAction(memberId, async () => {
      await transferCommunityOwnership(community!._id, memberId);
      await reloadContext();
    }, 'Unable to transfer ownership');
  }

  /** Founder toggle: free/instant join (autoApprove) vs request-to-join (approval queue). */
  async function handleSetJoinMode(autoApprove: boolean) {
    if (community!.autoApprove === autoApprove) return;
    await runAction(async () => {
      await updateCommunity(community!._id, { autoApprove });
      await reloadContext();
    }, 'Unable to update join settings', setJoinModeBusy);
  }

  async function handleReviewJoinRequest(requestId: string, decision: 'approve' | 'reject') {
    try {
      setRequestBusy(requestId);
      setActionError('');
      if (decision === 'approve') await approveCommunityJoinRequest(community!._id, requestId);
      else await rejectCommunityJoinRequest(community!._id, requestId);
      const { joinRequests: pending } = await getCommunityJoinRequests(community!._id);
      setJoinRequests(pending);
      setContext((await getCommunity(community!.slug)) as CommunityContext);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Unable to ${decision} join request`);
    } finally {
      setRequestBusy('');
    }
  }

  async function refreshLeaders() {
    const { leaders: fetched } = await getCommunityLeaders(community!._id);
    setLeaders(fetched ?? []);
  }

  async function handleArchiveLeader(leaderId: string) {
    const confirmed = await confirmDialog({ title: 'Archive this leader?', message: "They'll be marked as having left the post before their session ended. They’ll leave the Leadership Team card but stay on record on the leaders page.", confirmLabel: 'Archive' });
    if (!confirmed) return;
    try {
      await updateCommunityLeader(community!._id, leaderId, { status: 'ARCHIVED' });
      await refreshLeaders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to archive leader');
    }
  }

  const content = (
    <div className="min-h-screen bg-[#F4F6FA] dark:bg-slate-950">
      <CommunityHero
        community={community}
        isInsider={isInsider}
        following={following}
        followerCount={followerCount}
        eventRating={context?.eventRating}
        canJoin={canJoin}
        canEdit={canEdit}
        hasPendingJoinRequest={hasPendingJoinRequest}
        actionBusy={actionBusy}
        onFollow={() => void handleFollow()}
        onJoin={() => void runAction(async () => { await joinCommunity(community._id); await reloadContext(); }, 'Unable to join community')}
        onOpenPeople={openPeople}
        onPreview={(src, alt) => setMediaPreview({ src, alt })}
      />

      {/* ── Body ── */}
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        {actionError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300">{actionError}</div>
        )}

        {/* Tab bar */}
        <div className="sticky top-[4.5rem] z-30 grid grid-cols-3 gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-1 shadow-sm backdrop-blur">
          {(['profile', 'posts', 'knowledge'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${tab === t ? 'bg-slate-900 text-white shadow dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              {t === 'profile' ? <><IdCard className="h-4 w-4" /> Profile</> : t === 'posts' ? <><Grid3x3 className="h-4 w-4" /> Posts</> : <><BookOpen className="h-4 w-4" /> Knowledge</>}
            </button>
          ))}
        </div>

        {tab === 'posts' ? (
          <CommunityPosts communityId={community._id} currentUserId={currentUserId} canPost={canViewMembers} communityName={community.name} />
        ) : tab === 'knowledge' ? (
          <CommunityKnowledge communityId={community._id} communityName={community.name} canManage={canViewMembers} initialResourceId={knowledgeResourceId || undefined} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            {/* ── Left ── */}
            <div className="min-w-0 space-y-5">
              <CommunityAboutCards community={community} editHref={canEdit ? `/dashboard/communities/${community.slug}/edit` : undefined} />
              {community.gallery?.length ? <EventGallery images={community.gallery} title={community.name} heading="Photos" /> : null}
              <CommunityEventsCard events={sortedEvents} />
              {sponsorRoster && sponsorRoster.totalSponsors > 0 && <CommunitySponsorsCard roster={sponsorRoster} />}
              {leaders.length || canManageRoles ? <LeadershipCard
                communitySlug={community.slug}
                leaders={leaders}
                canManage={canManageRoles}
                onAdd={() => setLeaderEditor({ leader: null })}
                onEdit={(leader) => setLeaderEditor({ leader })}
                onArchive={(leaderId) => void handleArchiveLeader(leaderId)}
                onView={setViewLeader}
              /> : null}
              <EndorsementsCard
                communityId={community._id}
                endorsements={endorsements}
                canEndorse={canEndorse}
                alreadyEndorsed={alreadyEndorsed}
                onEndorsed={setEndorsements}
              />
              {canViewMembers && (
                <MembersCard
                  communityId={community._id}
                  firstPage={members}
                  firstPageCursor={context?.membersNextCursor ?? null}
                  firstPageTotal={context?.membersTotal ?? members.length}
                  canManageRoles={canManageRoles}
                  canManageMembers={canManageRoles}
                  isFounder={isFounder}
                  busyMemberId={roleUpdateBusy}
                  onOpenPeople={openPeople}
                  onChangeRole={(memberId, role) => runMemberAction(memberId, async () => {
                    await updateCommunityMemberRole(community._id, memberId, role);
                    await reloadContext();
                  }, 'Unable to update member role')}
                  onSetStatus={handleSetMemberStatus}
                  onTransferOwnership={handleTransferOwnership}
                />
              )}
              {canReviewRequests && (
                <JoinRequestsCard
                  community={community}
                  isFounder={isFounder}
                  joinRequests={joinRequests}
                  requestBusy={requestBusy}
                  joinModeBusy={joinModeBusy}
                  onSetJoinMode={(autoApprove) => void handleSetJoinMode(autoApprove)}
                  onApprove={(id) => void handleReviewJoinRequest(id, 'approve')}
                  onReject={(id) => void handleReviewJoinRequest(id, 'reject')}
                />
              )}
            </div>

            {/* ── Sidebar ── */}
            <aside className="space-y-5">
              {isFounder && !isArchived && setupChecklist.some((item) => !item.done) && (
                <SetupChecklistCard items={setupChecklist} onInvite={() => setInviteEmailsOpen(true)} />
              )}
              <CommunityInfoCard community={community} showNotes={canViewMembers} />
              {leadership.length > 0 && <LeadersMiniList leadership={leadership} />}
              <CommunityActionsCard
                canLeave={canLeave}
                canInvite={canInvite}
                canInviteByEmail={canViewMembers && !isArchived}
                canCreateEvent={canViewMembers}
                canAnnounce={canAnnounce}
                canDelete={canDelete}
                canArchive={canArchive}
                inviteLink={inviteLink}
                actionBusy={actionBusy}
                inviteBusy={inviteBusy}
                onLeave={() => void runAction(async () => { await leaveCommunity(community._id); await reloadContext(); }, 'Unable to leave community')}
                onCreateInviteLink={() => void runAction(async () => {
                  const result = await createCommunityInviteLink(community._id);
                  setInviteLink(`${window.location.origin}${result.inviteLink}`);
                }, 'Unable to create invite link', setInviteBusy)}
                onCopyInviteLink={() => void handleCopyInviteLink()}
                onRevokeInviteLink={() => void runAction(async () => {
                  await revokeCommunityInviteLink(community._id);
                  setInviteLink('');
                }, 'Unable to revoke invite link', setInviteBusy)}
                onInviteByEmail={() => setInviteEmailsOpen(true)}
                onToggleAnnounce={() => setAnnounceOpen((v) => !v)}
                onDelete={() => setDeleteConfirmOpen(true)}
                onArchive={() => void handleArchive()}
              />
              {canViewMembers && memberAnalytics && <MemberAnalyticsCard analytics={memberAnalytics} />}
              {announceOpen && canAnnounce && <AnnouncementComposer communityId={community._id} onError={setActionError} />}
            </aside>
          </div>
        )}

        {inviteEmailsOpen && (
          <InviteEmailsModal communityId={community._id} onClose={() => setInviteEmailsOpen(false)} onError={setActionError} />
        )}
        {deleteConfirmOpen && (
          <DeleteCommunityModal
            communityName={community.name}
            busy={actionBusy}
            onCancel={() => setDeleteConfirmOpen(false)}
            // Reached only after the founder typed the exact community name.
            onConfirm={() => void runAction(async () => {
              await deleteCommunity(community._id);
              router.push('/dashboard/communities');
            }, 'Unable to delete community')}
          />
        )}
        {viewLeader && <LeaderDetailModal leader={viewLeader} onClose={() => setViewLeader(null)} />}
        {leaderEditor && (
          <LeaderEditorModal
            communityId={community._id}
            leader={leaderEditor.leader}
            sessionSuggestions={sessionSuggestions}
            onClose={() => setLeaderEditor(null)}
            onSaved={refreshLeaders}
            onPreviewPhoto={(src, alt) => setMediaPreview({ src, alt })}
          />
        )}
        {mediaPreview && <ImageLightbox src={mediaPreview.src} alt={mediaPreview.alt} onClose={() => setMediaPreview(null)} />}
      </div>
    </div>
  );

  // The organizer workspace is for people who run the community; ordinary members stay in Student mode.
  if (canViewMembers) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        {content}
      </DashboardShell>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA] dark:bg-slate-950">
      <StudentNav active="/communities" />
      {content}
    </div>
  );
}
