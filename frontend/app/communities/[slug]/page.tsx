'use client';

import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../components/guildos/ui/loading';
import { SelectMenu } from '../../../components/guildos/ui/select-menu';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Archive, Award, BadgeCheck, Bell, BellOff, BookOpen, Building2, Camera, CalendarDays, CheckCircle2,
  ChevronRight, Copy, ExternalLink, Globe, GraduationCap, Grid3x3,
  IdCard, Link2, LogOut, Megaphone, MessageCircle, MoreHorizontal, PenLine, Plus, RotateCcw,
  Radio, Settings, ShieldCheck, Trash2, Users, UserCheck, UserMinus,
  UserPlus, XCircle,
} from 'lucide-react';

import { getCurrentUser, searchPeople, type PersonResult } from '../../../components/guildos/auth-api';
import {
  approveCommunityJoinRequest, archiveCommunity, createCommunityEndorsement,
  createCommunityInviteLink, deleteCommunity, getCommunity, getCommunityEndorsements,
  getCommunityJoinRequests, joinCommunity, leaveCommunity, rejectCommunityJoinRequest,
  resolveAvatarUrl, revokeCommunityInviteLink, sendCommunityAnnouncement, transferCommunityOwnership,
  updateCommunity, updateCommunityMemberRole, updateMembershipStatus,
  getCommunityLeaders, addCommunityLeader, updateCommunityLeader, removeCommunityLeader, uploadLeaderPhoto,
  getCommunityMembersPage, getCommunityMemberAnalytics, inviteMembersByEmail,
  type CommunityEndorsement, type CommunityJoinRequest, type CommunitySummary, type MembershipStatus, type CommunityLeader,
  type CommunityMemberAnalytics,
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

/**
 * Client-side mirror of the backend's session-label rule (defense in depth + instant feedback):
 * two consecutive 4-digit years ("2026/2027", never "2027/2026"), not starting earlier than the
 * current academic year (with a Jan/Feb grace window for schools still using last year's label).
 */
function validateSessionLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const match = /^(\d{4})\/(\d{4})$/.exec(trimmed);
  if (!match) return 'Session must be two consecutive years, e.g. 2026/2027';

  const y1 = Number(match[1]);
  const y2 = Number(match[2]);
  if (y2 !== y1 + 1) return 'Session years must be consecutive and in order, e.g. 2026/2027 (not 2027/2026)';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const effectiveYear = currentMonth <= 2 ? currentYear - 1 : currentYear;

  if (y1 < effectiveYear) return `Session can't start before ${effectiveYear}/${effectiveYear + 1} — dissolve the old session instead of backdating a new one`;

  return null;
}

type ViewerMembership = { role: string } | null;

type CommunityContext = {
  community: CommunitySummary;
  viewerMembership?: ViewerMembership;
  viewerJoinRequest?: CommunityJoinRequest | null;
  leadership?: Array<{ membership: { _id: string; role: string; joinedAt?: string }; user: { id: string; fullName: string; profile?: { avatar?: string } } }>;
  endorsements?: CommunityEndorsement[];
  members?: Array<{ membership: { _id: string; role: string; status?: MembershipStatus; joinedAt?: string; assignedBy?: string | null }; user: { id: string; fullName: string; profile?: { avatar?: string } } }>;
  membersTotal?: number;
  membersNextCursor?: string | null;
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
  // Paged member roster — the context only ships the FIRST page (50); searching and
  // "Load more" go through GET /:id/members so huge communities stay fast.
  const [memberRows, setMemberRows] = useState<NonNullable<CommunityContext['members']>>([]);
  const [memberCursor, setMemberCursor] = useState<string | null>(null);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberBusy, setMemberBusy] = useState(false);
  const [joinModeBusy, setJoinModeBusy] = useState(false);
  const [requestBusy, setRequestBusy] = useState('');
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [tab, setTab] = useState<'profile' | 'posts' | 'knowledge'>('profile');
  const [knowledgeResourceId, setKnowledgeResourceId] = useState('');
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [announceEmail, setAnnounceEmail] = useState(false);
  const [announceBusy, setAnnounceBusy] = useState(false);
  const [announceDone, setAnnounceDone] = useState('');

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
  // Type-to-confirm guard for community deletion — destructive, so a plain confirm isn't enough.
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteNameInput, setDeleteNameInput] = useState('');
  // Manager extras: member analytics card + bulk email invites.
  const [memberAnalytics, setMemberAnalytics] = useState<CommunityMemberAnalytics | null>(null);
  const [inviteEmailsOpen, setInviteEmailsOpen] = useState(false);
  const [inviteEmailsText, setInviteEmailsText] = useState('');
  const [inviteEmailsBusy, setInviteEmailsBusy] = useState(false);
  const [inviteEmailsDone, setInviteEmailsDone] = useState('');
  const [events, setEvents] = useState<EventSummary[]>([]);

  // Curated leadership roster (CommunityLeader) — independent of Membership/role.
  const [leaders, setLeaders] = useState<CommunityLeader[]>([]);
  const [viewLeader, setViewLeader] = useState<CommunityLeader | null>(null);
  const [leaderModalOpen, setLeaderModalOpen] = useState(false);
  const [editingLeaderId, setEditingLeaderId] = useState('');
  const [leaderForm, setLeaderForm] = useState({ name: '', title: '', session: '', bio: '', phone: '', department: '', level: '', displayRank: '' });
  const [leaderPhotoFile, setLeaderPhotoFile] = useState<File | null>(null);
  const [leaderPhotoPreview, setLeaderPhotoPreview] = useState('');
  const [leaderPhotoCleared, setLeaderPhotoCleared] = useState(false);
  // Raw `/uploads/...` path reused directly from a tagged GuildOS account's own avatar — no
  // re-upload needed. Cleared as soon as the admin uploads their own file instead.
  const [leaderPhotoFromAvatar, setLeaderPhotoFromAvatar] = useState('');
  const [leaderLinkedUser, setLeaderLinkedUser] = useState<{ id: string; fullName: string; username: string; avatar: string } | null>(null);
  const [leaderSearchQuery, setLeaderSearchQuery] = useState('');
  const [leaderSearchResults, setLeaderSearchResults] = useState<PersonResult[]>([]);
  const [leaderBusy, setLeaderBusy] = useState(false);
  const [leaderError, setLeaderError] = useState('');

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
          try {
            const { leaders: fetchedLeaders } = await getCommunityLeaders(response.community._id);
            setLeaders(fetchedLeaders ?? []);
          } catch {
            /* leaders are non-critical for the profile */
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
  const isSeniorLeader = Boolean(context?.viewerMembership && ['VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'].includes(context.viewerMembership.role));
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
      { label: 'Write the About section', done: community.description.trim().length >= 40, href: `/dashboard/communities/${community.slug}/edit` },
      { label: 'Set community rules', done: Boolean(community.rules?.length), href: `/dashboard/communities/${community.slug}/edit` },
      { label: 'List your leadership team', done: leaders.length > 0, href: `/communities/${community.slug}/leaders` },
      { label: 'Host your first event', done: events.length > 0, href: '/dashboard/events/create' },
      { label: 'Grow past 5 members', done: community.memberCount > 5, href: '#invite' },
    ];
  }, [community, leaders.length, events.length]);

  async function handleSendEmailInvites() {
    if (!community) return;
    const emails = inviteEmailsText.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    if (!emails.length) return;
    try {
      setInviteEmailsBusy(true);
      setInviteEmailsDone('');
      setActionError('');
      const result = await inviteMembersByEmail(community._id, emails);
      const parts = [`Sent ${result.sent} invite${result.sent === 1 ? '' : 's'}`];
      if (result.skippedMembers) parts.push(`${result.skippedMembers} already member${result.skippedMembers === 1 ? '' : 's'}`);
      if (result.failed.length) parts.push(`${result.failed.length} failed`);
      setInviteEmailsDone(parts.join(' · ') + '.');
      setInviteEmailsText(result.failed.join('\n'));
    } catch (err) {
      setInviteEmailsDone('');
      setActionError(err instanceof Error ? err.message : 'Unable to send invites');
    } finally {
      setInviteEmailsBusy(false);
    }
  }

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

  // Keep the paged rows in sync with the context's first page — unless the admin is
  // mid-search, in which case their filtered view wins until the search is cleared.
  useEffect(() => {
    if (memberSearch.trim()) return;
    setMemberRows(context?.members ?? []);
    setMemberCursor(context?.membersNextCursor ?? null);
    setMemberTotal(context?.membersTotal ?? context?.members?.length ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  async function runMemberSearch(q: string) {
    if (!context?.community) return;
    try {
      setMemberBusy(true);
      const page = await getCommunityMembersPage(context.community._id, { q: q.trim() || undefined });
      setMemberRows(page.members as NonNullable<CommunityContext['members']>);
      setMemberCursor(page.nextCursor);
      setMemberTotal(page.total);
    } catch {
      /* keep the previous rows on transient failures */
    } finally {
      setMemberBusy(false);
    }
  }

  async function loadMoreMembers() {
    if (!context?.community || !memberCursor) return;
    try {
      setMemberBusy(true);
      const page = await getCommunityMembersPage(context.community._id, { cursor: memberCursor, q: memberSearch.trim() || undefined });
      setMemberRows((rows) => [...rows, ...(page.members as NonNullable<CommunityContext['members']>)]);
      setMemberCursor(page.nextCursor);
      setMemberTotal(page.total);
    } catch {
      /* ignore */
    } finally {
      setMemberBusy(false);
    }
  }
  // Currently serving = ACTIVE **and** belonging to the current session (the highest starting
  // year among active leaders' sessions). Stale ACTIVE rows in older sessions, plus ARCHIVED
  // (left early) and PAST (session dissolved), are only shown on the dedicated /leaders page.
  const currentSessionLabel = useMemo(() => {
    let best: string | null = null;
    let bestYear = -1;
    for (const l of leaders) {
      if (l.status !== 'ACTIVE') continue;
      const m = /^(\d{4})\/\d{4}$/.exec(l.session.trim());
      const year = m ? Number(m[1]) : 0;
      if (year > bestYear) {
        bestYear = year;
        best = l.session.trim();
      }
    }
    return best;
  }, [leaders]);
  const activeLeaders = useMemo(
    () => leaders.filter((l) => l.status === 'ACTIVE' && (currentSessionLabel === null || l.session.trim() === currentSessionLabel)),
    [leaders, currentSessionLabel],
  );
  const LEADER_PREVIEW_LIMIT = 6;
  const visibleActiveLeaders = useMemo(() => activeLeaders.slice(0, LEADER_PREVIEW_LIMIT), [activeLeaders]);
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
    // Executed from the danger-zone modal only after the founder typed the exact community name.
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
      if (memberSearch.trim()) void runMemberSearch(memberSearch);
      if (response.joinRequests) {
        setJoinRequests(response.joinRequests as CommunityJoinRequest[]);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update member role');
    } finally {
      setRoleUpdateBusy('');
    }
  }

  function resetLeaderForm() {
    setEditingLeaderId('');
    setLeaderForm({ name: '', title: '', session: '', bio: '', phone: '', department: '', level: '', displayRank: '' });
    setLeaderPhotoFile(null);
    setLeaderPhotoPreview('');
    setLeaderPhotoCleared(false);
    setLeaderPhotoFromAvatar('');
    setLeaderLinkedUser(null);
    setLeaderSearchQuery('');
    setLeaderSearchResults([]);
    setLeaderError('');
  }

  function openAddLeader() {
    resetLeaderForm();
    setLeaderModalOpen(true);
  }

  function openEditLeader(leader: CommunityLeader) {
    setEditingLeaderId(leader.id);
    setLeaderForm({
      name: leader.name,
      title: leader.title,
      session: leader.session,
      bio: leader.bio,
      phone: leader.phone,
      department: leader.department,
      level: leader.level,
      displayRank: leader.displayRank !== null && leader.displayRank !== undefined ? String(leader.displayRank) : '',
    });
    setLeaderPhotoFile(null);
    setLeaderPhotoPreview(leader.photo ? resolveAvatarUrl(leader.photo) : '');
    setLeaderPhotoCleared(false);
    setLeaderPhotoFromAvatar('');
    setLeaderLinkedUser(leader.linkedUser);
    setLeaderSearchQuery('');
    setLeaderSearchResults([]);
    setLeaderError('');
    setLeaderModalOpen(true);
  }

  async function refreshLeaders() {
    if (!community) return;
    const { leaders: fetched } = await getCommunityLeaders(community._id);
    setLeaders(fetched ?? []);
  }

  async function handleLeaderSearch(q: string) {
    setLeaderSearchQuery(q);
    if (q.trim().length < 2) {
      setLeaderSearchResults([]);
      return;
    }
    try {
      const { people } = await searchPeople(q.trim());
      setLeaderSearchResults(people);
    } catch {
      /* typeahead is best-effort */
    }
  }

  async function handleSaveLeader() {
    if (!community) return;
    if (!leaderForm.name.trim()) {
      setLeaderError('Name is required');
      return;
    }

    // Only re-validate the session format/range when it's actually changing — leaving an
    // existing leader's untouched, legitimately-historical session alone should never fail.
    const originalSession = editingLeaderId ? leaders.find((l) => l.id === editingLeaderId)?.session : undefined;
    if (leaderForm.session.trim() !== (originalSession ?? '')) {
      const sessionError = validateSessionLabel(leaderForm.session);
      if (sessionError) {
        setLeaderError(sessionError);
        return;
      }
    }

    try {
      setLeaderBusy(true);
      setLeaderError('');

      let photo = '';
      if (leaderPhotoFile) {
        const uploaded = await uploadLeaderPhoto(leaderPhotoFile);
        photo = uploaded.photo;
      } else if (leaderPhotoFromAvatar) {
        photo = leaderPhotoFromAvatar;
      } else if (!leaderPhotoCleared && editingLeaderId) {
        photo = leaders.find((l) => l.id === editingLeaderId)?.photo ?? '';
      }

      const input = {
        name: leaderForm.name.trim(),
        title: leaderForm.title.trim(),
        session: leaderForm.session.trim(),
        bio: leaderForm.bio.trim(),
        photo,
        phone: leaderForm.phone.trim(),
        department: leaderForm.department.trim(),
        level: leaderForm.level.trim(),
        displayRank: leaderForm.displayRank.trim() === '' ? null : Number(leaderForm.displayRank),
        linkedUserId: leaderLinkedUser?.id ?? null,
      };

      if (editingLeaderId) {
        await updateCommunityLeader(community._id, editingLeaderId, input);
      } else {
        await addCommunityLeader(community._id, input);
      }

      await refreshLeaders();
      setLeaderModalOpen(false);
      resetLeaderForm();
    } catch (err) {
      setLeaderError(err instanceof Error ? err.message : 'Unable to save leader');
    } finally {
      setLeaderBusy(false);
    }
  }

  async function handleRemoveLeader(leaderId: string) {
    if (!community) return;

    const confirmed = await confirmDialog({ title: 'Permanently delete this entry?', message: 'This cannot be undone. Use Archive instead if you just want to retire them for this session.', confirmLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;

    try {
      setLeaderBusy(true);
      await removeCommunityLeader(community._id, leaderId);
      await refreshLeaders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to remove leader');
    } finally {
      setLeaderBusy(false);
    }
  }

  async function handleArchiveLeader(leaderId: string) {
    if (!community) return;

    const confirmed = await confirmDialog({ title: 'Archive this leader?', message: "They'll be marked as having left the post before their session ended — removed from the Leadership Team card but kept on record on the leaders page.", confirmLabel: 'Archive' });
    if (!confirmed) return;

    try {
      setLeaderBusy(true);
      await updateCommunityLeader(community._id, leaderId, { status: 'ARCHIVED' });
      await refreshLeaders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to archive leader');
    } finally {
      setLeaderBusy(false);
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
      if (memberSearch.trim()) void runMemberSearch(memberSearch);
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
      if (memberSearch.trim()) void runMemberSearch(memberSearch);
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

  /** Founder toggle: free/instant join (autoApprove) vs request-to-join (approval queue). */
  async function handleSetJoinMode(autoApprove: boolean) {
    if (!community || community.autoApprove === autoApprove) return;
    try {
      setJoinModeBusy(true);
      setActionError('');
      await updateCommunity(community._id, { autoApprove });
      const response = await getCommunity(community.slug);
      setContext(response as CommunityContext);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update join settings');
    } finally {
      setJoinModeBusy(false);
    }
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
                  {activeLeaders.length > 0 && (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
                      {activeLeaders.length} {activeLeaders.length === 1 ? 'leader' : 'leaders'}
                    </span>
                  )}
                  {canManageRoles && (
                    <button
                      onClick={openAddLeader}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add leader
                    </button>
                  )}
                </h2>
                <p className="mt-1 text-xs text-slate-400">Click a leader to read their bio. Session officers are re-listed every year — no GuildOS account required.</p>
                {activeLeaders.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {visibleActiveLeaders.map((leader) => (
                      <button
                        key={leader.id}
                        onClick={() => setViewLeader(leader)}
                        className="group relative flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3.5 text-left transition hover:border-indigo-200 hover:bg-white hover:shadow-sm"
                      >
                        <MemberAvatar fullName={leader.name} avatar={leader.photo} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate font-semibold text-slate-900">{leader.name}</p>
                            {leader.linkedUser && (
                              <span title="Has a GuildOS account" className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200">
                                <BadgeCheck className="h-3 w-3" /> On GuildOS
                              </span>
                            )}
                          </div>
                          {(leader.title || leader.session) && (
                            <p className="truncate text-xs font-medium text-indigo-600">
                              {leader.title}
                              {leader.title && leader.session ? ' · ' : ''}
                              {leader.session}
                            </p>
                          )}
                          {leader.bio && (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{leader.bio}</p>
                          )}
                        </div>
                        {canManageRoles && (
                          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                            <LeaderCardAction
                              onClick={(e) => { e.stopPropagation(); openEditLeader(leader); }}
                              title="Edit leader"
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600"
                            >
                              <PenLine className="h-3.5 w-3.5" />
                            </LeaderCardAction>
                            <LeaderCardAction
                              onClick={(e) => { e.stopPropagation(); void handleArchiveLeader(leader.id); }}
                              title="Archive (left the post early)"
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:border-amber-200 hover:text-amber-600"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </LeaderCardAction>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-sm text-slate-500">No leadership members listed yet.</p>
                    {canManageRoles && (
                      <button
                        onClick={openAddLeader}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add your first leader
                      </button>
                    )}
                  </div>
                )}
                {(leaders.length > 0) && (
                  <a
                    href={`/communities/${community.slug}/leaders`}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    {activeLeaders.length > LEADER_PREVIEW_LIMIT ? `View full Leadership Team (${activeLeaders.length})` : 'Browse leaders by session'} <ChevronRight className="h-3.5 w-3.5" />
                  </a>
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

              {/* Members full list — insiders only. Paged + server-searched so communities
                  with thousands of members stay fast: 50 rows at a time, search by name. */}
              {canViewMembers && (memberRows.length > 0 || memberSearch.trim() || members.length > 0) && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                    <Users className="h-4 w-4 text-indigo-500" /> All Members
                    <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{memberTotal}</span>
                  </h2>
                  {(memberTotal > 10 || memberSearch.trim()) && (
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => {
                        const q = e.target.value;
                        setMemberSearch(q);
                        if (q.trim().length >= 2) void runMemberSearch(q);
                        else if (!q.trim()) {
                          setMemberRows(context?.members ?? []);
                          setMemberCursor(context?.membersNextCursor ?? null);
                          setMemberTotal(context?.membersTotal ?? 0);
                        }
                      }}
                      placeholder="Search members by name…"
                      className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-400"
                    />
                  )}
                  <div className="mt-4 space-y-2">
                    {memberRows.length === 0 && (
                      <p className="py-4 text-center text-sm text-slate-500">{memberBusy ? 'Searching…' : 'No members match your search.'}</p>
                    )}
                    {memberRows.map((entry) => (
                      <div key={entry.user.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                        <MemberAvatar fullName={entry.user.fullName} avatar={entry.user.profile?.avatar} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{entry.user.fullName}</p>
                          {entry.membership.status && entry.membership.status !== 'ACTIVE' && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">{entry.membership.status}</span>
                          )}
                        </div>
                        {canManageRoles && entry.membership.role !== 'FOUNDER' ? (
                          <SelectMenu
                            aria-label="Member role"
                            className="w-44"
                            size="sm"
                            value={entry.membership.role}
                            onChange={(v) => void handleChangeMemberRole(entry.membership._id, v)}
                            disabled={roleUpdateBusy === entry.membership._id}
                            options={['MEMBER','VOLUNTEER','COORDINATOR','SECRETARY','TREASURER','VICE_PRESIDENT','PRESIDENT'].map((r) => ({ value: r, label: r.replace('_', ' ') }))}
                          />
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
                  {memberCursor && (
                    <button
                      onClick={() => void loadMoreMembers()}
                      disabled={memberBusy}
                      className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      {memberBusy ? 'Loading…' : `Load more (${memberRows.length} of ${memberTotal})`}
                    </button>
                  )}
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

                  {/* How people join — quick toggle for the existing autoApprove flag so admins
                      don't have to dig into the edit wizard. Founder-only (community updates
                      are founder-gated server-side). */}
                  {isFounder && community.visibility !== 'PRIVATE' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-3.5 py-2.5">
                      <p className="mr-1 text-xs font-semibold text-slate-600">How people join:</p>
                      <button
                        onClick={() => void handleSetJoinMode(true)}
                        disabled={joinModeBusy}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${community.autoApprove ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
                      >
                        Free join (instant)
                      </button>
                      <button
                        onClick={() => void handleSetJoinMode(false)}
                        disabled={joinModeBusy}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${!community.autoApprove ? 'bg-amber-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
                      >
                        Request to join (approval)
                      </button>
                      <p className="w-full text-[11px] text-slate-400">
                        {community.autoApprove
                          ? 'Anyone can join instantly — no approval needed.'
                          : 'New members wait below until a leader approves them.'}
                      </p>
                    </div>
                  )}

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

              {/* Founder setup checklist — shown until everything's ticked. */}
              {isFounder && !isArchived && setupChecklist.some((item) => !item.done) && (
                <div className="rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-indigo-500">Setup checklist</h3>
                    <span className="text-xs font-semibold text-slate-500">
                      {setupChecklist.filter((i) => i.done).length}/{setupChecklist.length}
                    </span>
                  </div>
                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${Math.round((setupChecklist.filter((i) => i.done).length / setupChecklist.length) * 100)}%` }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {setupChecklist.map((item) => (
                      item.done ? (
                        <p key={item.label} className="flex items-center gap-2 text-sm text-slate-400">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          <span className="line-through">{item.label}</span>
                        </p>
                      ) : item.href === '#invite' ? (
                        <button key={item.label} onClick={() => { setInviteEmailsOpen(true); setInviteEmailsDone(''); }} className="flex w-full items-center gap-2 text-left text-sm font-medium text-slate-700 hover:text-indigo-600">
                          <ChevronRight className="h-4 w-4 shrink-0 text-indigo-400" /> {item.label}
                        </button>
                      ) : (
                        <a key={item.label} href={item.href} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-indigo-600">
                          <ChevronRight className="h-4 w-4 shrink-0 text-indigo-400" /> {item.label}
                        </a>
                      )
                    ))}
                  </div>
                </div>
              )}

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
                  {canViewMembers && !isArchived && (
                    <button onClick={() => { setInviteEmailsOpen(true); setInviteEmailsDone(''); }} className="flex w-full items-center gap-2.5 rounded-2xl border border-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-200 hover:bg-slate-50">
                      <UserPlus className="h-4 w-4" /> Invite by email
                    </button>
                  )}
                  {canViewMembers && (
                    <a href="/dashboard/events/create" className="flex w-full items-center gap-2.5 rounded-2xl border border-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-200 hover:bg-slate-50">
                      <CalendarDays className="h-4 w-4" /> Create event
                    </a>
                  )}
                  {isSeniorLeader && (
                    <button onClick={() => { setAnnounceOpen((v) => !v); setAnnounceDone(''); }} className="flex w-full items-center gap-2.5 rounded-2xl border border-indigo-100 px-4 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50">
                      <Bell className="h-4 w-4" /> Send announcement
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => { setDeleteNameInput(''); setDeleteConfirmOpen(true); }} disabled={actionBusy} className="flex w-full items-center gap-2.5 rounded-2xl border border-rose-100 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50">
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

              {/* Member analytics (COORDINATOR+) — growth, engagement, role mix. */}
              {canViewMembers && memberAnalytics && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Member analytics</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                      <p className="text-lg font-extrabold text-slate-900">{memberAnalytics.totalMembers}</p>
                      <p className="text-[11px] font-medium text-slate-500">Active members</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 px-3 py-2.5">
                      <p className="text-lg font-extrabold text-emerald-700">+{memberAnalytics.newLast30Days}</p>
                      <p className="text-[11px] font-medium text-emerald-600">New (30 days)</p>
                    </div>
                    <div className="rounded-2xl bg-indigo-50 px-3 py-2.5">
                      <p className="text-lg font-extrabold text-indigo-700">{memberAnalytics.engagedLast60Days}</p>
                      <p className="text-[11px] font-medium text-indigo-600">Engaged (60 days)</p>
                    </div>
                    <div className="rounded-2xl bg-amber-50 px-3 py-2.5">
                      <p className="text-lg font-extrabold text-amber-700">{memberAnalytics.dormantMembers}</p>
                      <p className="text-[11px] font-medium text-amber-600">Dormant</p>
                    </div>
                  </div>
                  {(() => {
                    const max = Math.max(1, ...memberAnalytics.joinsByMonth.map((m) => m.count));
                    return (
                      <div className="mt-4">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Joins — last 12 months</p>
                        <div className="flex h-16 items-end gap-1">
                          {memberAnalytics.joinsByMonth.map((m) => (
                            <div key={m.month} className="group relative flex-1">
                              <div
                                className="w-full rounded-t bg-indigo-400 transition group-hover:bg-indigo-600"
                                style={{ height: `${Math.max(3, Math.round((m.count / max) * 60))}px` }}
                                title={`${m.month}: ${m.count} join${m.count === 1 ? '' : 's'}`}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                          <span>{memberAnalytics.joinsByMonth[0]?.month}</span>
                          <span>{memberAnalytics.joinsByMonth[memberAnalytics.joinsByMonth.length - 1]?.month}</span>
                        </div>
                      </div>
                    );
                  })()}
                  {memberAnalytics.departedMembers > 0 && (
                    <p className="mt-3 text-[11px] text-slate-400">{memberAnalytics.departedMembers} member{memberAnalytics.departedMembers === 1 ? '' : 's'} left or removed overall · {memberAnalytics.followerCount} follower{memberAnalytics.followerCount === 1 ? '' : 's'}</p>
                  )}
                </div>
              )}

              {/* Announcement composer (VP+): in-app to every active member + optional branded email */}
              {announceOpen && isSeniorLeader && (
                <div className="rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-indigo-500"><Megaphone className="h-4 w-4" /> Announcement</h3>
                  {announceDone ? <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{announceDone}</p> : null}
                  <div className="space-y-2.5">
                    <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Title" value={announceTitle}
                      onChange={(e) => setAnnounceTitle(e.target.value.slice(0, 120))} />
                    <textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Message to all members…" value={announceBody}
                      onChange={(e) => setAnnounceBody(e.target.value.slice(0, 2000))} />
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input type="checkbox" checked={announceEmail} onChange={(e) => setAnnounceEmail(e.target.checked)} />
                      Also send as branded email
                    </label>
                    <button
                      disabled={announceBusy || !announceTitle.trim() || !announceBody.trim()}
                      onClick={() => {
                        void (async () => {
                          try {
                            setAnnounceBusy(true);
                            setActionError('');
                            const result = await sendCommunityAnnouncement(community._id, { title: announceTitle, body: announceBody, emailToo: announceEmail });
                            setAnnounceDone(`Sent to ${result.recipients} member${result.recipients === 1 ? '' : 's'}${result.emailed ? ` (${result.emailed} emailed)` : ''}.`);
                            setAnnounceTitle('');
                            setAnnounceBody('');
                          } catch (err) {
                            setActionError(err instanceof Error ? err.message : 'Unable to send announcement');
                          } finally {
                            setAnnounceBusy(false);
                          }
                        })();
                      }}
                      className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {announceBusy ? 'Sending…' : 'Send to all members'}
                    </button>
                  </div>
                </div>
              )}

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
        {inviteEmailsOpen && community ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !inviteEmailsBusy && setInviteEmailsOpen(false)}>
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <UserPlus className="h-4 w-4 text-indigo-500" /> Invite members by email
              </h3>
              <p className="mt-1.5 text-xs text-slate-500">
                Paste up to 50 addresses (one per line, or separated by commas/spaces). Each gets a branded email
                with your community's join link — existing members are skipped automatically.
              </p>
              {inviteEmailsDone ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{inviteEmailsDone}</p> : null}
              <textarea
                value={inviteEmailsText}
                onChange={(e) => setInviteEmailsText(e.target.value)}
                placeholder={'ada@student.edu.ng\nbayo@student.edu.ng'}
                className="mt-3 min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs outline-none transition focus:border-indigo-400"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setInviteEmailsOpen(false)} disabled={inviteEmailsBusy} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                  Close
                </button>
                <button
                  onClick={() => void handleSendEmailInvites()}
                  disabled={inviteEmailsBusy || !inviteEmailsText.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
                >
                  {inviteEmailsBusy ? 'Sending…' : 'Send invites'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {deleteConfirmOpen && community ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !actionBusy && setDeleteConfirmOpen(false)}>
            <div className="w-full max-w-sm rounded-3xl border border-rose-200 bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <h3 className="flex items-center gap-2 text-sm font-bold text-rose-700">
                <Trash2 className="h-4 w-4" /> Delete {community.name}?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                This permanently deletes the community, its posts and knowledge — it <span className="font-semibold text-slate-700">cannot be undone</span>.
                If you just want to wind it down, <span className="font-semibold text-slate-700">Archive</span> instead (reversible, keeps everything).
              </p>
              <label className="mt-4 block text-xs font-semibold text-slate-600">
                Type <span className="select-all font-bold text-slate-900">{community.name}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteNameInput}
                onChange={(e) => setDeleteNameInput(e.target.value)}
                placeholder={community.name}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-rose-400"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setDeleteConfirmOpen(false)} disabled={actionBusy} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  onClick={() => void handleDelete()}
                  disabled={actionBusy || deleteNameInput.trim() !== community.name}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
                >
                  {actionBusy ? 'Deleting…' : 'Delete forever'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
        {viewLeader ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setViewLeader(null)}>
            <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <MemberAvatar fullName={viewLeader.name} avatar={viewLeader.photo} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">{viewLeader.name}</p>
                    {(viewLeader.title || viewLeader.session) && (
                      <p className="truncate text-xs font-medium text-indigo-600">
                        {viewLeader.title}
                        {viewLeader.title && viewLeader.session ? ' · ' : ''}
                        {viewLeader.session}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setViewLeader(null)} className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              {viewLeader.linkedUser && (
                <a
                  href={`/u/${viewLeader.linkedUser.username}`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100"
                >
                  <BadgeCheck className="h-3.5 w-3.5" /> View GuildOS profile
                </a>
              )}
              {(viewLeader.department || viewLeader.level || viewLeader.phone) && (
                <div className="mt-4 space-y-1 rounded-2xl bg-slate-50 px-3.5 py-3 text-sm">
                  {viewLeader.department && (
                    <p className="flex justify-between gap-3"><span className="text-slate-400">Department</span><span className="font-medium text-slate-700">{viewLeader.department}</span></p>
                  )}
                  {viewLeader.level && (
                    <p className="flex justify-between gap-3"><span className="text-slate-400">Level</span><span className="font-medium text-slate-700">{viewLeader.level}</span></p>
                  )}
                  {viewLeader.phone && (
                    <p className="flex justify-between gap-3"><span className="text-slate-400">Phone</span><a href={`tel:${viewLeader.phone}`} className="font-medium text-indigo-600 hover:underline">{viewLeader.phone}</a></p>
                  )}
                </div>
              )}
              <p className="mt-4 text-sm leading-relaxed text-slate-600">{viewLeader.bio || 'No bio added yet.'}</p>
            </div>
          </div>
        ) : null}
        {leaderModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setLeaderModalOpen(false)}>
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">{editingLeaderId ? 'Edit leader' : 'Add leader'}</h3>
                <button onClick={() => setLeaderModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">List anyone on your leadership team — they don't need a GuildOS account.</p>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  {leaderPhotoPreview ? (
                    <button
                      type="button"
                      onClick={() => setMediaPreview({ src: leaderPhotoPreview, alt: leaderForm.name || 'Leader photo' })}
                      title="Click to preview"
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200"
                    >
                      <img src={leaderPhotoPreview} alt="" className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-300">
                      <Camera className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex flex-col items-start gap-1">
                    <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                      <Camera className="h-3.5 w-3.5" /> {leaderPhotoPreview ? 'Change photo' : 'Add photo (optional)'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setLeaderPhotoFile(file);
                          setLeaderPhotoCleared(false);
                          setLeaderPhotoFromAvatar('');
                          setLeaderPhotoPreview(URL.createObjectURL(file));
                        }}
                      />
                    </label>
                    {leaderPhotoPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setLeaderPhotoFile(null);
                          setLeaderPhotoPreview('');
                          setLeaderPhotoFromAvatar('');
                          setLeaderPhotoCleared(true);
                        }}
                        className="text-xs font-medium text-rose-600 hover:underline"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>

                {/* Suggest reusing the tagged GuildOS account's own profile picture when no photo is set yet. */}
                {leaderLinkedUser?.avatar && !leaderPhotoPreview && (
                  <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setMediaPreview({ src: resolveAvatarUrl(leaderLinkedUser!.avatar), alt: leaderLinkedUser!.fullName })}
                      title="Click to preview"
                      className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-sky-200"
                    >
                      <img src={resolveAvatarUrl(leaderLinkedUser.avatar)} alt="" className="h-full w-full object-cover" />
                    </button>
                    <p className="flex-1 text-xs text-sky-800">Use {leaderLinkedUser.fullName.split(' ')[0]}'s GuildOS profile picture as their photo?</p>
                    <button
                      type="button"
                      onClick={() => {
                        setLeaderPhotoFromAvatar(leaderLinkedUser.avatar);
                        setLeaderPhotoFile(null);
                        setLeaderPhotoCleared(false);
                        setLeaderPhotoPreview(resolveAvatarUrl(leaderLinkedUser.avatar));
                      }}
                      className="shrink-0 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
                    >
                      Use it
                    </button>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-600">Name *</label>
                  <input
                    type="text"
                    value={leaderForm.name}
                    onChange={(e) => setLeaderForm((f) => ({ ...f, name: e.target.value.slice(0, 120) }))}
                    placeholder="e.g. Amina Yusuf"
                    maxLength={120}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Title</label>
                  <input
                    type="text"
                    value={leaderForm.title}
                    onChange={(e) => setLeaderForm((f) => ({ ...f, title: e.target.value.slice(0, 80) }))}
                    placeholder="e.g. Amirah, General Secretary, PRO"
                    maxLength={80}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Department</label>
                    <input
                      type="text"
                      value={leaderForm.department}
                      onChange={(e) => setLeaderForm((f) => ({ ...f, department: e.target.value.slice(0, 80) }))}
                      placeholder="e.g. Mechatronics Engineering"
                      maxLength={80}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Level</label>
                    <input
                      type="text"
                      value={leaderForm.level}
                      onChange={(e) => setLeaderForm((f) => ({ ...f, level: e.target.value.slice(0, 40) }))}
                      placeholder="e.g. 300 Level"
                      maxLength={40}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Phone number</label>
                  <input
                    type="tel"
                    value={leaderForm.phone}
                    onChange={(e) => setLeaderForm((f) => ({ ...f, phone: e.target.value.slice(0, 30) }))}
                    placeholder="e.g. +234 801 234 5678"
                    maxLength={30}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Session</label>
                    <input
                      type="text"
                      value={leaderForm.session}
                      onChange={(e) => setLeaderForm((f) => ({ ...f, session: e.target.value.slice(0, 40) }))}
                      placeholder="e.g. 2026/2027"
                      maxLength={40}
                      list="leader-session-options"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    <datalist id="leader-session-options">
                      {sessionSuggestions.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                    {sessionSuggestions.length > 0 && (
                      <p className="mt-1 text-[11px] text-slate-400">Re-use an existing session to group leaders.</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Display order</label>
                    <input
                      type="number"
                      value={leaderForm.displayRank}
                      onChange={(e) => setLeaderForm((f) => ({ ...f, displayRank: e.target.value }))}
                      placeholder="Optional"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">About</label>
                  <textarea
                    value={leaderForm.bio}
                    onChange={(e) => setLeaderForm((f) => ({ ...f, bio: e.target.value.slice(0, 280) }))}
                    rows={3}
                    placeholder="A short bio — background, focus area, what they lead…"
                    maxLength={280}
                    className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <p className="mt-1 text-right text-[11px] text-slate-400">{leaderForm.bio.length}/280</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">Tag their GuildOS account (optional)</label>
                  {leaderLinkedUser ? (
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                      <MemberAvatar fullName={leaderLinkedUser.fullName} avatar={leaderLinkedUser.avatar} size="sm" />
                      <span className="flex-1 truncate text-sm font-medium text-sky-800">{leaderLinkedUser.fullName}</span>
                      <button type="button" onClick={() => setLeaderLinkedUser(null)} className="text-xs font-semibold text-sky-700 hover:underline">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="relative mt-1">
                      <input
                        type="text"
                        value={leaderSearchQuery}
                        onChange={(e) => void handleLeaderSearch(e.target.value)}
                        placeholder="Search by name…"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                      {leaderSearchResults.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                          {leaderSearchResults.map((person) => (
                            <button
                              key={person.id}
                              type="button"
                              onClick={() => {
                                setLeaderLinkedUser({ id: person.id, fullName: person.fullName, username: person.username, avatar: person.avatar });
                                setLeaderSearchQuery('');
                                setLeaderSearchResults([]);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                            >
                              <MemberAvatar fullName={person.fullName} avatar={person.avatar} size="sm" />
                              <span className="truncate">{person.fullName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {leaderError && <p className="text-xs font-medium text-rose-600">{leaderError}</p>}
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => void handleSaveLeader()}
                  disabled={leaderBusy}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {leaderBusy ? 'Saving…' : editingLeaderId ? 'Save changes' : 'Add leader'}
                </button>
                <button
                  onClick={() => setLeaderModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
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

/**
 * A small icon action nested inside a leader card (which is itself a <button>) —
 * a real <button> can't nest inside another, so this is a keyboard-accessible
 * span: clickable, focusable (tabIndex), and Enter/Space triggers it like a button.
 */
function LeaderCardAction({
  onClick,
  title,
  className,
  children,
}: {
  onClick: (e: React.MouseEvent | React.KeyboardEvent) => void;
  title: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      aria-label={title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      }}
      className={className}
    >
      {children}
    </span>
  );
}
