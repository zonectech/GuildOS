'use client';

import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../components/guildos/ui/loading';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Award, Bell, BellOff, BookOpen, Building2, CalendarDays, CheckCircle2,
  ChevronRight, Copy, ExternalLink, Globe, GraduationCap, Grid3x3,
  IdCard, Link2, LogOut, MessageCircle, MoreHorizontal, PenLine,
  Radio, Settings, ShieldCheck, Trash2, Users, UserCheck, UserMinus,
  UserPlus, XCircle,
} from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import {
  approveCommunityJoinRequest, archiveCommunity, createCommunityEndorsement,
  createCommunityInviteLink, deleteCommunity, getCommunity, getCommunityEndorsements,
  getCommunityJoinRequests, joinCommunity, leaveCommunity, rejectCommunityJoinRequest,
  resolveAvatarUrl, revokeCommunityInviteLink, transferCommunityOwnership,
  updateCommunityMemberRole, updateMembershipStatus,
  type CommunityEndorsement, type CommunityJoinRequest, type CommunitySummary, type MembershipStatus,
} from '../../../components/guildos/community-list-api';
import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { StudentNav } from '../../../components/guildos/student-nav';
import { Button } from '../../../components/guildos/ui/button';
import { CommunityPosts } from '../../../components/guildos/feed/community-posts';
import { CommunityKnowledge } from '../../../components/guildos/community/community-knowledge';
import { getFollowedCommunityIds, toggleCommunityFollow } from '../../../components/guildos/follow-api';
import { listEvents, resolveEventImageUrl, type EventSummary } from '../../../components/guildos/event-api';

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
  const [tab, setTab] = useState<'profile' | 'posts' | 'knowledge'>('profile');
  const [knowledgeResourceId, setKnowledgeResourceId] = useState('');

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
  const [endorsements, setEndorsements] = useState<CommunityEndorsement[]>([]);
  const [endorseNote, setEndorseNote] = useState('');
  const [endorseBusy, setEndorseBusy] = useState(false);
  const [endorseError, setEndorseError] = useState('');
  const [endorseDone, setEndorseDone] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ src: string; alt: string } | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);

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
        if (response.community?._id) {
          try {
            const { events: communityEvents } = await listEvents(response.community._id);
            setEvents(communityEvents ?? []);
          } catch {
            /* events are non-critical for the profile */
          }
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
  const alreadyEndorsed = endorsements.some((entry) => entry.user.id === currentUserId);
  const canEndorse = Boolean(
    community && !isArchived && !isFounder && community.verificationStatus === 'PENDING' && !alreadyEndorsed,
  );
  const sortedEvents = useMemo(() => {
    const now = Date.now();
    return [...events].sort((a, b) => {
      const at = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bt = b.startDate ? new Date(b.startDate).getTime() : 0;
      const aUpcoming = at >= now;
      const bUpcoming = bt >= now;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return aUpcoming ? at - bt : bt - at;
    });
  }, [events]);

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

  async function handleEndorse() {
    if (!community) return;
    try {
      setEndorseBusy(true);
      setEndorseError('');
      await createCommunityEndorsement(community._id, endorseNote.trim());
      const { endorsements: refreshed } = await getCommunityEndorsements(community._id);
      setEndorsements(refreshed);
      setEndorseNote('');
      setEndorseDone(true);
    } catch (err) {
      setEndorseError(err instanceof Error ? err.message : 'Unable to submit endorsement');
    } finally {
      setEndorseBusy(false);
    }
  }

  const leadership = useMemo(() => context?.leadership ?? [], [context]);
  const members = useMemo(() => context?.members ?? [], [context]);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100">
        <LogoSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100">
        <StudentNav active="/communities" />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        </main>
      </div>
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
    const confirmed = await confirmDialog({ title: `Delete ${community.name}?`, message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' });
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

    const confirmed = await confirmDialog({ title: `Archive ${community.name}?`, message: 'This will disable join and invite actions.', confirmLabel: 'Archive', tone: 'danger' });
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
      const confirmed = await confirmDialog({ title: 'Remove this member?', message: 'They will be removed from the community.', confirmLabel: 'Remove', tone: 'danger' });
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

    const confirmed = await confirmDialog({ title: 'Transfer ownership?', message: 'You will remain a leadership member.', confirmLabel: 'Transfer' });
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

  const ROLE_STYLE: Record<string, { bg: string; text: string }> = {
    FOUNDER:       { bg: 'bg-violet-100', text: 'text-violet-700' },
    PRESIDENT:     { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    VICE_PRESIDENT:{ bg: 'bg-blue-100',   text: 'text-blue-700'   },
    TREASURER:     { bg: 'bg-amber-100',  text: 'text-amber-700'  },
    SECRETARY:     { bg: 'bg-emerald-100',text: 'text-emerald-700'},
    COORDINATOR:   { bg: 'bg-sky-100',    text: 'text-sky-700'    },
    VOLUNTEER:     { bg: 'bg-teal-100',   text: 'text-teal-700'   },
    MEMBER:        { bg: 'bg-slate-100',  text: 'text-slate-600'  },
  };
  function roleBadge(role: string) {
    const s = ROLE_STYLE[role] ?? ROLE_STYLE.MEMBER;
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.bg} ${s.text}`}>
        {role.replace('_', ' ')}
      </span>
    );
  }

  const content = (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* ── Hero card ── */}
      <div className="mx-auto max-w-5xl px-4 pt-4 pb-0">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md">
          {/* Cover */}
          <div className="relative h-48 sm:h-60">
            {community.coverImage ? (
              <img
                src={normalizeCommunityImageUrl(community.coverImage)}
                alt={`${community.name} cover`}
                className="h-full w-full cursor-zoom-in object-cover"
                onClick={() => setMediaPreview({ src: normalizeCommunityImageUrl(community.coverImage), alt: `${community.name} cover` })}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
              </div>
            )}
            {/* Category pill on cover */}
            <div className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              <BookOpen className="h-3.5 w-3.5" /> {community.category}
            </div>
            {isArchived && (
              <div className="absolute right-4 top-3 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                Archived
              </div>
            )}
          </div>

          {/* Identity row */}
          <div className="relative px-5 pb-5 sm:px-7">
            {/* Logo */}
            <div className="absolute -top-12 left-5 z-10 h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg sm:-top-14 sm:left-7 sm:h-28 sm:w-28">
              {community.logo ? (
                <img
                  src={normalizeCommunityImageUrl(community.logo)}
                  alt={community.name}
                  className="h-full w-full cursor-zoom-in object-cover"
                  onClick={() => setMediaPreview({ src: normalizeCommunityImageUrl(community.logo), alt: `${community.name} logo` })}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100 text-3xl font-bold text-indigo-600">
                  {community.name.slice(0, 1)}
                </div>
              )}
            </div>

            {/* Action buttons top-right */}
            <div className="flex flex-wrap justify-end gap-2 pt-3 pb-2">
              {/* Follow — outsiders only (founders/members already get updates) */}
              {!isInsider && (
                <button
                  onClick={() => void handleFollow()}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 ${
                    following
                      ? 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {following ? <><BellOff className="h-4 w-4" /> Unfollow</> : <><Bell className="h-4 w-4" /> Follow</>}
                </button>
              )}
              {canJoin && (
                <button onClick={() => void handleJoin()} disabled={actionBusy} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-50">
                  <UserPlus className="h-4 w-4" /> Request to Join
                </button>
              )}
              {hasPendingJoinRequest && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-700">
                  <UserCheck className="h-4 w-4" /> Pending
                </span>
              )}
              {canEdit && (
                <a href={`/dashboard/communities/${community.slug}/edit`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow">
                  <Settings className="h-4 w-4" /> Manage
                </a>
              )}
            </div>

            {/* Name + meta */}
            <div className="mt-12 sm:mt-14">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{community.name}</h1>
                {community.verificationStatus === 'VERIFIED' && (
                  <span title="Verified community" className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
                {community.verificationStatus === 'PENDING' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                    Pending verification
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {[community.faculty, community.department, community.university].filter(Boolean).join(' · ')}
              </p>
              {community.shortDescription && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{community.shortDescription}</p>
              )}

              {/* Stats strip */}
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span>{community.memberCount}</span>
                  <span className="font-normal text-slate-500">members</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  <span>{community.eventCount}</span>
                  <span className="font-normal text-slate-500">events</span>
                </span>
                {followerCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                    <UserPlus className="h-4 w-4 text-slate-400" />
                    <span>{followerCount}</span>
                    <span className="font-normal text-slate-500">followers</span>
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${community.visibility === 'PUBLIC' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  <Globe className="h-3 w-3" /> {community.visibility}
                </span>
              </div>

              {/* Social handles */}
              {(community.whatsappLink || community.channelLink) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {community.whatsappLink && (
                    <a href={community.whatsappLink} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700">
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Group
                    </a>
                  )}
                  {community.channelLink && (
                    <a href={community.channelLink} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-700">
                      <Radio className="h-3.5 w-3.5" /> Channel
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        {actionError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</div>
        )}

        {/* Tab bar */}
        <div className="sticky top-2 z-20 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {(['profile', 'posts', 'knowledge'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${tab === t ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
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
            <div className="space-y-5">

              {/* About */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                  <BookOpen className="h-4 w-4 text-indigo-500" /> About
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{community.description || community.shortDescription || 'No description provided.'}</p>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {community.university && (
                    <div className="flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3">
                      <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">University</p>
                        <p className="text-sm font-semibold text-slate-800">{community.university}</p>
                      </div>
                    </div>
                  )}
                  {community.faculty && (
                    <div className="flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3">
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Faculty</p>
                        <p className="text-sm font-semibold text-slate-800">{community.faculty}</p>
                      </div>
                    </div>
                  )}
                  {community.department && (
                    <div className="flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3">
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Department</p>
                        <p className="text-sm font-semibold text-slate-800">{community.department}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Founded</p>
                      <p className="text-sm font-semibold text-slate-800">{new Date(community.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Community Rules */}
              {(community.rules?.length ?? 0) > 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                    <ShieldCheck className="h-4 w-4 text-indigo-500" /> Community Rules
                  </h2>
                  <ol className="mt-4 space-y-2">
                    {community.rules!.map((rule, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-600">{i + 1}</span>
                        <p className="text-sm text-slate-700">{rule}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Events */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                  <CalendarDays className="h-4 w-4 text-indigo-500" /> Events
                  {sortedEvents.length > 0 && (
                    <span className="ml-auto rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
                      {sortedEvents.length}
                    </span>
                  )}
                </h2>
                {sortedEvents.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {sortedEvents.map((event) => (
                      <CommunityEventCard key={event._id} event={event} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No public events yet.</p>
                )}
              </div>

              {/* Leadership */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                  <Award className="h-4 w-4 text-indigo-500" /> Leadership Team
                  {leadership.length > 0 && (
                    <span className="ml-auto rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
                      {leadership.length} {leadership.length === 1 ? 'leader' : 'leaders'}
                    </span>
                  )}
                </h2>
                {leadership.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {leadership.map((entry) => (
                      <div key={entry.user.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 transition hover:border-slate-200 hover:bg-white">
                        <MemberAvatar fullName={entry.user.fullName} avatar={entry.user.profile?.avatar} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{entry.user.fullName}</p>
                          {entry.membership.joinedAt && (
                            <p className="text-xs text-slate-400">Since {new Date(entry.membership.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</p>
                          )}
                        </div>
                        {roleBadge(entry.membership.role)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No leadership members listed yet.</p>
                )}
              </div>

              {/* Endorsements */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Endorsements
                  {endorsements.length > 0 && (
                    <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                      {endorsements.length}
                    </span>
                  )}
                </h2>
                {endorsements.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {endorsements.map((entry) => (
                      <div key={entry.endorsement._id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                        <div className="flex items-center gap-3">
                          <MemberAvatar fullName={entry.user.fullName} avatar={entry.user.profile?.avatar} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">{entry.user.fullName}</p>
                            <p className="text-xs text-slate-400">{new Date(entry.endorsement.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">Verified leader</span>
                        </div>
                        {entry.endorsement.note && (
                          <p className="mt-3 border-l-2 border-emerald-200 pl-3 text-sm italic leading-relaxed text-slate-600">"{entry.endorsement.note}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No endorsements recorded yet.</p>
                )}

                {/* Endorse form */}
                {community.verificationStatus === 'PENDING' && !isArchived && !isFounder && !alreadyEndorsed && !endorseDone && canEndorse && (
                  <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                    <p className="text-sm font-semibold text-slate-900">Endorse this community</p>
                    <p className="mt-1 text-xs text-slate-500">You're a verified leader at the same university. Two endorsements automatically grant verified status.</p>
                    <textarea
                      value={endorseNote}
                      onChange={(e) => setEndorseNote(e.target.value)}
                      rows={3}
                      placeholder="Why do you endorse this community? (optional)"
                      className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    {endorseError && <p className="mt-1.5 text-xs font-medium text-rose-600">{endorseError}</p>}
                    <button onClick={() => void handleEndorse()} disabled={endorseBusy}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
                      {endorseBusy ? 'Submitting…' : <><CheckCircle2 className="h-4 w-4" /> Submit endorsement</>}
                    </button>
                  </div>
                )}
                {(alreadyEndorsed || endorseDone) && (
                  <p className="mt-4 flex items-center gap-1.5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> You have endorsed this community.
                  </p>
                )}
              </div>

              {/* Members full list — insiders only */}
              {canViewMembers && members.length > 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                    <Users className="h-4 w-4 text-indigo-500" /> All Members
                    <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{members.length}</span>
                  </h2>
                  <div className="mt-4 space-y-2">
                    {members.map((entry) => (
                      <div key={entry.user.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                        <MemberAvatar fullName={entry.user.fullName} avatar={entry.user.profile?.avatar} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{entry.user.fullName}</p>
                          {entry.membership.status && entry.membership.status !== 'ACTIVE' && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">{entry.membership.status}</span>
                          )}
                        </div>
                        {canManageRoles && entry.membership.role !== 'FOUNDER' ? (
                          <select
                            className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none"
                            value={entry.membership.role}
                            onChange={(e) => void handleChangeMemberRole(entry.membership._id, e.target.value)}
                            disabled={roleUpdateBusy === entry.membership._id}
                          >
                            {['MEMBER','VOLUNTEER','COORDINATOR','SECRETARY','TREASURER','VICE_PRESIDENT','PRESIDENT'].map((r) => (
                              <option key={r} value={r}>{r.replace('_', ' ')}</option>
                            ))}
                          </select>
                        ) : roleBadge(entry.membership.role)}
                        {canManageMembers && entry.membership.role !== 'FOUNDER' && (
                          <div className="flex gap-1.5">
                            {entry.membership.status === 'SUSPENDED' ? (
                              <button onClick={() => void handleSetMemberStatus(entry.membership._id, 'ACTIVE')} disabled={roleUpdateBusy === entry.membership._id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100">Reactivate</button>
                            ) : (
                              <button onClick={() => void handleSetMemberStatus(entry.membership._id, 'SUSPENDED')} disabled={roleUpdateBusy === entry.membership._id} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100">Suspend</button>
                            )}
                            <button onClick={() => void handleSetMemberStatus(entry.membership._id, 'REMOVED')} disabled={roleUpdateBusy === entry.membership._id} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100">Remove</button>
                            {isFounder && (
                              <button onClick={() => void handleTransferOwnership(entry.membership._id)} disabled={roleUpdateBusy === entry.membership._id} className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100">Transfer</button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Join Requests */}
              {canReviewRequests && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                    <UserCheck className="h-4 w-4 text-indigo-500" /> Join Requests
                    {joinRequests.length > 0 && (
                      <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">{joinRequests.length} pending</span>
                    )}
                  </h2>
                  {joinRequests.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {joinRequests.map((req) => (
                        <div key={req._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                          <div>
                            <p className="font-semibold text-slate-900">{req.user?.fullName ?? `User ${req.userId}`}</p>
                            <p className="text-xs text-slate-400">{new Date(req.requestedAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => void handleApproveJoinRequest(req._id)} disabled={requestBusy === req._id} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button onClick={() => void handleRejectJoinRequest(req._id)} disabled={requestBusy === req._id} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50">
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No pending requests.</p>
                  )}
                </div>
              )}
            </div>

            {/* ── Sidebar ── */}
            <aside className="space-y-5">

              {/* Quick actions */}
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Actions</h3>
                <div className="space-y-2">
                  {canLeave && (
                    <button onClick={() => void handleLeave()} disabled={actionBusy} className="flex w-full items-center gap-2.5 rounded-2xl border border-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                      <LogOut className="h-4 w-4" /> Leave community
                    </button>
                  )}
                  {canInvite && (
                    <button onClick={() => void handleCreateInviteLink()} disabled={inviteBusy} className="flex w-full items-center gap-2.5 rounded-2xl border border-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-200 hover:bg-slate-50">
                      <Link2 className="h-4 w-4" /> Generate invite link
                    </button>
                  )}
                  {inviteLink && (
                    <>
                      <button onClick={() => void handleCopyInviteLink()} className="flex w-full items-center gap-2.5 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100">
                        <Copy className="h-4 w-4" /> Copy invite link
                      </button>
                      <button onClick={() => void handleRevokeInviteLink()} disabled={inviteBusy} className="flex w-full items-center gap-2.5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100">
                        <XCircle className="h-4 w-4" /> Revoke invite link
                      </button>
                    </>
                  )}
                  {canViewMembers && (
                    <a href="/dashboard/events/create" className="flex w-full items-center gap-2.5 rounded-2xl border border-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-200 hover:bg-slate-50">
                      <CalendarDays className="h-4 w-4" /> Create event
                    </a>
                  )}
                  {canDelete && (
                    <button onClick={() => void handleDelete()} disabled={actionBusy} className="flex w-full items-center gap-2.5 rounded-2xl border border-rose-100 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50">
                      <Trash2 className="h-4 w-4" /> Delete community
                    </button>
                  )}
                  {canArchive && (
                    <button onClick={() => void handleArchive()} disabled={actionBusy} className="flex w-full items-center gap-2.5 rounded-2xl border border-amber-100 px-4 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50">
                      <XCircle className="h-4 w-4" /> Archive community
                    </button>
                  )}
                </div>
              </div>

              {/* Quick info */}
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Community Info</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Visibility</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${community.visibility === 'PUBLIC' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{community.visibility}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Status</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${community.verificationStatus === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700' : community.verificationStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{community.verificationStatus}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Category</span>
                    <span className="font-medium text-slate-800">{community.category}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Founded</span>
                    <span className="font-medium text-slate-800">{new Date(community.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                  </div>
                  {community.verificationMethod && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Verified via</span>
                      <span className="font-medium text-slate-800">
                        {community.verificationMethod === 'UNIVERSITY_EMAIL' ? 'Uni email' : community.verificationMethod === 'ENDORSEMENT' ? 'Endorsement' : 'Admin'}
                      </span>
                    </div>
                  )}
                </div>
                {canViewMembers && community.verificationNotes && (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">Note: {community.verificationNotes}</p>
                )}
              </div>

              {/* Leadership mini-list */}
              {leadership.length > 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Leaders</h3>
                  <div className="space-y-2.5">
                    {leadership.slice(0, 5).map((entry) => (
                      <div key={entry.user.id} className="flex items-center gap-3">
                        <MemberAvatar fullName={entry.user.fullName} avatar={entry.user.profile?.avatar} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{entry.user.fullName}</p>
                          <p className="text-xs text-slate-400">{entry.membership.role.replace('_', ' ')}</p>
                        </div>
                        {entry.membership.role === 'FOUNDER' && <Award className="h-4 w-4 shrink-0 text-violet-500" />}
                      </div>
                    ))}
                    {leadership.length > 5 && (
                      <p className="pt-1 text-xs text-slate-400">+{leadership.length - 5} more leaders</p>
                    )}
                  </div>
                </div>
              )}

              {/* Social channels */}
              {(community.whatsappLink || community.channelLink) && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Connect</h3>
                  <div className="space-y-2">
                    {community.whatsappLink && (
                      <a href={community.whatsappLink} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 transition hover:bg-emerald-100">
                        <MessageCircle className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-800">WhatsApp Group</span>
                        <ExternalLink className="ml-auto h-3.5 w-3.5 text-emerald-500" />
                      </a>
                    )}
                    {community.channelLink && (
                      <a href={community.channelLink} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 transition hover:bg-sky-100">
                        <Radio className="h-5 w-5 text-sky-600" />
                        <span className="text-sm font-semibold text-sky-800">Community Channel</span>
                        <ExternalLink className="ml-auto h-3.5 w-3.5 text-sky-500" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
        {mediaPreview ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setMediaPreview(null)}>
            <button
              onClick={(event) => {
                event.stopPropagation();
                setMediaPreview(null);
              }}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Close image preview"
            >
              <XCircle className="h-5 w-5" />
            </button>
            <img
              src={mediaPreview.src}
              alt={mediaPreview.alt}
              className="max-h-[90vh] w-auto max-w-[95vw] rounded-xl object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  if (isInsider) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        {content}
      </DashboardShell>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <StudentNav active="/communities" />
      {content}
    </div>
  );
}

function CommunityEventCard({ event }: { event: EventSummary }) {
  const start = event.startDate ? new Date(event.startDate) : null;
  const isLive = event.status === 'CHECK_IN' || event.status === 'CHECK_OUT';
  const isPast = event.status === 'COMPLETED' || (!isLive && start !== null && start.getTime() < Date.now());
  const banner = event.bannerImage ? resolveEventImageUrl(event.bannerImage) : '';
  const sponsors = event.sponsors ?? [];
  const speakers = event.speakers ?? [];

  return (
    <a href={`/events/${event.slug}`} className="block overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60 transition hover:border-slate-200 hover:bg-white hover:shadow-sm">
      <div className="flex gap-4 p-4">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" className="h-20 w-28 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
            <CalendarDays className="h-6 w-6 text-indigo-300" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-slate-900">{event.title}</p>
            {isLive ? (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-200">Live now</span>
            ) : isPast ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Past</span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-200">Upcoming</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {start ? start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA'}
            {' · '}
            {event.mode === 'VIRTUAL' ? 'Virtual' : event.venue || (event.mode === 'HYBRID' ? 'Hybrid' : 'In person')}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {event.registrationCount > 0 && (
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {event.registrationCount} registered</span>
            )}
            {speakers.length > 0 && (
              <span className="inline-flex items-center gap-1"><Radio className="h-3.5 w-3.5" /> {speakers.length} speaker{speakers.length === 1 ? '' : 's'}</span>
            )}
            {event.certificateEnabled && (
              <span className="inline-flex items-center gap-1"><Award className="h-3.5 w-3.5" /> Certificate</span>
            )}
            {event.sponsorshipOpen && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">Sponsorship open</span>
            )}
          </div>
        </div>
      </div>
      {sponsors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-white/70 px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sponsored by</span>
          {sponsors.map((sponsor) => (
            <span key={sponsor._id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200">
              {sponsor.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveEventImageUrl(sponsor.logo)} alt="" className="h-4 w-4 rounded-full object-cover" />
              )}
              <span className="text-[11px] font-semibold text-slate-700">{sponsor.name}</span>
            </span>
          ))}
        </div>
      )}
    </a>
  );
}

function MemberAvatar({ fullName, avatar, size = 'md' }: { fullName: string; avatar?: string; size?: 'sm' | 'md' }) {
  const url = resolveAvatarUrl(avatar);
  const initials = fullName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  const cls = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  if (url) return <img src={url} alt={fullName} className={`${cls} shrink-0 rounded-full border border-slate-200 object-cover`} />;
  return (
    <div className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-600`}>
      {initials || '?'}
    </div>
  );
}
