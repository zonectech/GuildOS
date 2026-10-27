'use client';

import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../components/guildos/ui/loading';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckSquare2,
  Copy,
  CalendarDays,
  CalendarPlus,
  CircleDot,
  ExternalLink,
  History,
  LayoutGrid,
  Link2,
  List,
  Lock,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { Button } from '../../../components/guildos/ui/button';
import { MediaPreviewDialog } from '../../../components/guildos/ui/media-preview-dialog';
import { getCurrentUser } from '../../../components/guildos/auth-api';
import { FilterPills } from '../../../components/guildos/ui/filter-pills';
import { createCommunityInviteLink, deleteCommunity, getManagedCommunities, revokeCommunityInviteLink, type CommunitySummary } from '../../../components/guildos/community-list-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const STATUS_FILTERS = ['ALL', 'VERIFIED', 'PENDING', 'REJECTED'] as const;
const SCOPE_FILTERS = ['ALL', 'FOUNDER'] as const;
const SORT_OPTIONS = ['UPDATED_DESC', 'MEMBERS_DESC', 'EVENTS_DESC', 'NAME_ASC'] as const;

function normalizeCommunityImageUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
}

export default function CommunitiesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string } | null>(null);
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING' | 'REJECTED'>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'FOUNDER'>('ALL');
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]>('UPDATED_DESC');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        const response = await getManagedCommunities();
        setCurrentUser({ id: user.id, fullName: user.fullName });
        setCommunities(response.communities);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load communities');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [router]);

  const filteredCommunities = useMemo(() => {
    const q = query.trim().toLowerCase();
    return communities.filter((community) => {
      if (statusFilter !== 'ALL' && community.verificationStatus !== statusFilter) return false;
      if (scopeFilter === 'FOUNDER' && community.founder !== currentUser?.id) return false;
      if (!q) return true;
      const haystack = [
        community.name,
        community.shortDescription,
        community.category,
        community.university,
        community.faculty,
        community.department,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [communities, currentUser?.id, query, scopeFilter, statusFilter]);

  const sortedCommunities = useMemo(() => {
    const list = [...filteredCommunities];
    switch (sortBy) {
      case 'MEMBERS_DESC':
        return list.sort((a, b) => b.memberCount - a.memberCount);
      case 'EVENTS_DESC':
        return list.sort((a, b) => b.eventCount - a.eventCount);
      case 'NAME_ASC':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case 'UPDATED_DESC':
      default:
        return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  }, [filteredCommunities, sortBy]);

  const metrics = useMemo(() => {
    const total = communities.length;
    const verified = communities.filter((c) => c.verificationStatus === 'VERIFIED').length;
    const pending = communities.filter((c) => c.verificationStatus === 'PENDING').length;
    const founder = communities.filter((c) => c.founder === currentUser?.id).length;
    const members = communities.reduce((sum, c) => sum + c.memberCount, 0);
    const events = communities.reduce((sum, c) => sum + c.eventCount, 0);
    return { total, verified, pending, founder, members, events };
  }, [communities, currentUser?.id]);

  useEffect(() => {
    const visibleIds = new Set(sortedCommunities.map((community) => community._id));
    setSelectedIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [sortedCommunities]);

  const selectedCommunities = useMemo(
    () => sortedCommunities.filter((community) => selectedIds.includes(community._id)),
    [selectedIds, sortedCommunities],
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleSelectAllVisible() {
    if (!sortedCommunities.length) return;
    if (selectedIds.length === sortedCommunities.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(sortedCommunities.map((community) => community._id));
  }

  async function handleBulkDelete() {
    if (!selectedIds.length) return;
    const deletable = selectedCommunities.filter((community) => community.founder === currentUser?.id);
    if (!deletable.length) {
      setError('Only communities where you are the founder can be deleted.');
      return;
    }
    const confirmed = await confirmDialog({
      title: `Delete ${deletable.length} selected communit${deletable.length > 1 ? 'ies' : 'y'}?`,
      message: 'This action cannot be undone.',
      confirmLabel: 'Delete selected',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      setBulkBusy(true);
      setError('');
      for (const community of deletable) {
        await deleteCommunity(community._id);
      }
      const deletedIdSet = new Set(deletable.map((community) => community._id));
      setCommunities((prev) => prev.filter((community) => !deletedIdSet.has(community._id)));
      setSelectedIds((prev) => prev.filter((id) => !deletedIdSet.has(id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete selected communities');
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleCopySelectedSlugs() {
    if (!selectedCommunities.length) return;
    const lines = selectedCommunities.map((community) => `/communities/${community.slug}`);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {
      setError('Unable to copy selected links.');
    }
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Community"
        title="Your communities"
        subtitle="Your community pages, verification, invite links and day-to-day actions."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild href="/dashboard/communities/history">
              <span className="inline-flex items-center gap-1.5"><History className="h-4 w-4" /> History</span>
            </Button>
            <Button variant="primary" asChild href="/dashboard/communities/create">
              <span className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> New community</span>
            </Button>
          </div>
        }
        toolbar={
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <SummaryChip>{metrics.total} {metrics.total === 1 ? 'community' : 'communities'}</SummaryChip>
            <SummaryChip tone="emerald"><ShieldCheck className="h-3.5 w-3.5" /> {metrics.verified} verified</SummaryChip>
            {metrics.pending ? <SummaryChip tone="amber">{metrics.pending} pending review</SummaryChip> : null}
            <SummaryChip><Users className="h-3.5 w-3.5" /> {metrics.members.toLocaleString('en-NG')} members</SummaryChip>
            <SummaryChip><CalendarDays className="h-3.5 w-3.5" /> {metrics.events.toLocaleString('en-NG')} events</SummaryChip>
          </div>
        }
      />

      {/* Search, filters and bulk tools only earn their space once there's something to sift. */}
      {communities.length > 3 ? (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, category, university, department..."
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-3 text-sm text-slate-900 dark:text-slate-100"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <FilterPills
              items={[...STATUS_FILTERS]}
              active={statusFilter}
              onChange={setStatusFilter}
              getLabel={(item) => item === 'ALL' ? 'All statuses' : item}
            />
            <FilterPills
              items={[...SCOPE_FILTERS]}
              active={scopeFilter}
              onChange={setScopeFilter}
              getLabel={(item) => item === 'ALL' ? 'All managed' : 'Founder only'}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              Sort
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as (typeof SORT_OPTIONS)[number])}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
              >
                <option value="UPDATED_DESC">Recently updated</option>
                <option value="MEMBERS_DESC">Most members</option>
                <option value="EVENTS_DESC">Most events</option>
                <option value="NAME_ASC">Name (A-Z)</option>
              </select>
            </label>
            <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${viewMode === 'cards' ? 'bg-slate-900 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${viewMode === 'table' ? 'bg-slate-900 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}
              >
                <List className="h-3.5 w-3.5" /> Table
              </button>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {error ? <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}

      {selectedIds.length ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-950/50 dark:text-indigo-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium"><CheckSquare2 className="h-4 w-4" /> {selectedIds.length} selected</span>
            <Button variant="secondary" size="sm" onClick={() => void handleCopySelectedSlugs()}>
              <Copy className="h-3.5 w-3.5" /> Copy links
            </Button>
            <Button variant="danger" size="sm" onClick={() => void handleBulkDelete()} disabled={bulkBusy}>
              <Trash2 className="h-3.5 w-3.5" /> {bulkBusy ? 'Deleting…' : 'Delete selected'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Clear selection
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 shadow-sm">
          <LogoSpinner />
        </div>
      ) : !communities.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <p className="font-medium text-slate-900 dark:text-white">You don’t run a community yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create one, get it verified, then host events and issue certificates.</p>
          <Button variant="primary" asChild href="/dashboard/communities/create" className="mt-4">
            <span className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Create a community</span>
          </Button>
        </div>
      ) : !filteredCommunities.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No communities match your current filters.</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950/40">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === sortedCommunities.length && sortedCommunities.length > 0}
                    onChange={toggleSelectAllVisible}
                  />
                </th>
                <th className="px-4 py-3">Community</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3">Events</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCommunities.map((community) => {
                const isFounder = community.founder === currentUser?.id;
                const selected = selectedIds.includes(community._id);
                return (
                  <tr key={community._id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 align-middle">
                      <input type="checkbox" checked={selected} onChange={() => toggleSelect(community._id)} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{community.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{community.category}{community.university ? ` · ${community.university}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge>{community.verificationStatus}</Badge>
                        {community.visibility === 'PRIVATE' ? <Badge><Lock className="mr-1 h-3 w-3" /> Private</Badge> : null}
                        {community.verificationStatus !== 'VERIFIED' ? <Badge><AlertTriangle className="mr-1 h-3 w-3" /> Needs attention</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle tabular-nums">{community.memberCount.toLocaleString('en-NG')}</td>
                    <td className="px-4 py-3 align-middle tabular-nums">{community.eventCount.toLocaleString('en-NG')}</td>
                    <td className="px-4 py-3 align-middle text-xs text-slate-500 dark:text-slate-400">
                      {new Date(community.updatedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => router.push(`/communities/${community.slug}`)}>
                          Open
                        </Button>
                        {isFounder ? (
                          <Button size="sm" variant="secondary" asChild href={`/dashboard/communities/${community.slug}/edit`}>
                            Edit
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {sortedCommunities.map((community) => (
            <CommunityCard
              key={community._id}
              community={community}
              currentUserId={currentUser?.id ?? ''}
              onView={() => router.push(`/communities/${community.slug}`)}
              onRemoved={(id) => setCommunities((prev) => prev.filter((communityItem) => communityItem._id !== id))}
              selected={selectedIds.includes(community._id)}
              onToggleSelect={() => toggleSelect(community._id)}
              selectable={communities.length > 3}
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function CommunityCard({
  community,
  currentUserId,
  onView,
  onRemoved,
  selected,
  onToggleSelect,
  selectable,
}: {
  community: CommunitySummary;
  currentUserId: string;
  onView: () => void;
  onRemoved: (id: string) => void;
  selected: boolean;
  onToggleSelect: () => void;
  selectable: boolean;
}) {
  const isFounder = community.founder === currentUserId;
  const isVerified = community.verificationStatus === 'VERIFIED';
  const [inviteLink, setInviteLink] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [cardError, setCardError] = useState('');
  const [mediaPreview, setMediaPreview] = useState<{ src: string; alt: string } | null>(null);
  const [logoBroken, setLogoBroken] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  async function handleCreateInviteLink() {
    try {
      setInviteBusy(true);
      setCardError('');
      const result = await createCommunityInviteLink(community._id);
      setInviteLink(`${window.location.origin}${result.inviteLink}`);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Unable to create invite link');
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleCopyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 1800);
    } catch {
      setCardError('Unable to copy invite link');
    }
  }

  async function handleRevokeInviteLink() {
    try {
      setInviteBusy(true);
      setCardError('');
      await revokeCommunityInviteLink(community._id);
      setInviteLink('');
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Unable to revoke invite link');
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleDeleteCommunity() {
    const confirmed = await confirmDialog({ title: `Delete ${community.name}?`, message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;
    try {
      setInviteBusy(true);
      setCardError('');
      await deleteCommunity(community._id);
      onRemoved(community._id);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Unable to delete community');
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <section className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
      {selectable ? (
        <label className="absolute right-4 top-4 z-30 inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/60 bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} />
          Select
        </label>
      ) : null}
      <div className="aspect-[40/11] overflow-hidden rounded-t-3xl bg-gradient-to-br from-indigo-600 via-sky-500 to-cyan-400">
        {community.coverImage ? (
          <img
            src={normalizeCommunityImageUrl(community.coverImage)}
            alt={`${community.name} cover`}
            className="h-full w-full cursor-zoom-in object-cover"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
            onClick={() => setMediaPreview({ src: normalizeCommunityImageUrl(community.coverImage), alt: `${community.name} cover` })}
          />
        ) : null}
      </div>

      <div className="p-5 pt-2">
        <div className="-mt-7 mb-3">
          <div className="h-14 w-14 overflow-hidden rounded-full bg-white shadow-md ring-2 ring-white dark:bg-slate-900 dark:ring-slate-900">
            {community.logo && !logoBroken ? (
              <img
                src={normalizeCommunityImageUrl(community.logo)}
                alt=""
                onError={() => setLogoBroken(true)}
                className="h-full w-full cursor-zoom-in object-cover"
                onClick={() => setMediaPreview({ src: normalizeCommunityImageUrl(community.logo), alt: `${community.name} logo` })}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-indigo-500 text-lg font-semibold text-white">
                {community.name.slice(0, 1)}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-slate-950 dark:text-white">{community.name}</h2>
              {isVerified ? <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" /> : null}
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {[community.category, community.university].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {isVerified ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Verified</span>
            ) : (
              <span title={community.verificationStatus === 'PENDING' ? 'An admin is reviewing your verification' : 'Verified communities can issue certificates and award Guild Score'} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" /> {community.verificationStatus === 'PENDING' ? 'Verification pending' : 'Not verified'}
              </span>
            )}
            {community.visibility === 'PRIVATE' ? <Badge><Lock className="mr-1 h-3 w-3" /> Private</Badge> : null}
          </div>
        </div>

        <div className="mt-3 flex gap-4 text-sm text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}</span>
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {community.eventCount} {community.eventCount === 1 ? 'event' : 'events'}</span>
        </div>

        {cardError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{cardError}</div> : null}

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button variant="primary" size="sm" onClick={onView}>
            <ExternalLink className="h-4 w-4" /> Open page
          </Button>
          {isFounder ? (
            <Button asChild size="sm" href={`/dashboard/communities/${community.slug}/edit`} variant="secondary">
              <Settings2 className="h-4 w-4" /> Edit
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" asChild href={`/dashboard/events/create?communityId=${community._id}`}>
            <CalendarPlus className="h-4 w-4" /> New event
          </Button>
          <Button variant="secondary" size="sm" asChild href="/dashboard/members">
            <Users className="h-4 w-4" /> Members
          </Button>
          <Button variant="secondary" size="sm" asChild href={`/status/new?as=${community._id}`}>
            <CircleDot className="h-4 w-4" /> Post status
          </Button>
          {isFounder && !inviteLink ? (
            <Button variant="secondary" size="sm" onClick={handleCreateInviteLink} disabled={inviteBusy}>
              <Link2 className="h-4 w-4" /> Invite link
            </Button>
          ) : null}
        </div>

        {inviteLink ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-2 dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <input readOnly value={inviteLink} className="min-w-0 flex-1 bg-transparent px-1 text-xs text-slate-700 outline-none dark:text-slate-200" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="secondary" size="sm" onClick={handleCopyInviteLink}>
              <Copy className="h-3.5 w-3.5" /> {inviteCopied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRevokeInviteLink} disabled={inviteBusy}>Revoke</Button>
          </div>
        ) : null}

        {isFounder ? (
          <div className="mt-4 border-t border-slate-100 pt-3 text-right dark:border-slate-800">
            <button type="button" onClick={handleDeleteCommunity} disabled={inviteBusy} className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400">
              <Trash2 className="h-3.5 w-3.5" /> Delete community
            </button>
          </div>
        ) : null}
      </div>
      <MediaPreviewDialog preview={mediaPreview} onClose={() => setMediaPreview(null)} />
    </section>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-950 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">{children}</span>;
}

function SummaryChip({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'emerald' | 'amber' }) {
  const toneClasses = tone === 'emerald'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
    : tone === 'amber'
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${toneClasses}`}>{children}</span>;
}
