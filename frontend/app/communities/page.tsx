'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Users, GraduationCap, Search, Plus, LayoutGrid, List, SlidersHorizontal, Sparkles } from 'lucide-react';

import { StudentNav } from '../../components/guildos/student-nav';
import { getCommunities, getUserMemberships, joinCommunity, leaveCommunity, type CommunitySummary } from '../../components/guildos/community-list-api';
import { getCurrentUser } from '../../components/guildos/auth-api';
import { getFollowedCommunityIds, toggleCommunityFollow } from '../../components/guildos/follow-api';
import { confirmDialog } from '../../components/guildos/ui/confirm-dialog';
import { Button } from '../../components/guildos/ui/button';
import { EmptyState, PageHeader, PageShell } from '../../components/guildos/ui/page';
import { SearchField } from '../../components/guildos/ui/forms';
import { SelectMenu } from '../../components/guildos/ui/select-menu';
import { FilterPills } from '../../components/guildos/ui/filter-pills';
import { MediaPreviewDialog } from '../../components/guildos/ui/media-preview-dialog';
import { Tour, type TourStep } from '../../components/guildos/ui/tour';
import { CommunityGridCard, CommunityListRow, FeaturedCommunityCard, pickPopularCommunities, type MembershipState } from './_components/community-cards';

/** First-visit walkthrough of the communities directory. */
const COMMUNITIES_TOUR: TourStep[] = [
  {
    target: 'community-categories',
    title: 'Browse by category',
    body: 'Tech, academic, religious, social. Filter the directory to what you care about, or tap My university to see your campus.',
  },
  {
    target: 'community-search',
    title: 'Looking for a specific club?',
    body: 'Search by name, university, or what the community is about.',
  },
  {
    target: 'community-list',
    title: 'Follow or join',
    body: 'Follow to see posts in your feed, or join to become a member. Switch between cards and a compact list with the toggle. The blue badge means GuildOS verified the community.',
  },
  {
    target: 'community-create',
    title: 'Run your own?',
    body: 'Create your community here. Verify it with a university email or an endorsement letter, then start hosting events.',
  },
];

const VIEW_STORAGE_KEY = 'guildos-communities-view';

type QuickFilter = 'All' | 'MY_UNI' | 'VERIFIED' | 'JOINED' | 'FOLLOWING';

const PILL = 'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition';
const PILL_ON = 'border-indigo-600 bg-indigo-600 text-white';
const PILL_OFF = 'border-slate-300 bg-white text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400';

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`${PILL} ${active ? PILL_ON : PILL_OFF}`}>
      {children}
    </button>
  );
}

function readStoredView(): 'grid' | 'list' {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState('');
  const [joinBusy, setJoinBusy] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [uniFilter, setUniFilter] = useState('All');
  const [quick, setQuick] = useState<QuickFilter>('All');
  const [moreOpen, setMoreOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'RELEVANT' | 'MEMBERS' | 'NEWEST'>('RELEVANT');
  const [myUniversity, setMyUniversity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mediaPreview, setMediaPreview] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => setView(readStoredView()), []);

  function changeView(next: 'grid' | 'list') {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* private mode: the toggle still works for this visit */
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const user = await getCurrentUser();
        const [{ communities: list }, follows, memberships] = await Promise.all([
          getCommunities(),
          getFollowedCommunityIds().catch(() => ({ communityIds: [] as string[] })),
          user ? getUserMemberships(user.id).catch(() => ({ memberships: [] })) : Promise.resolve({ memberships: [] }),
        ]);
        if (!cancelled) {
          setCommunities(list);
          setUserId(user?.id ?? '');
          setMyUniversity(user?.profile?.university?.trim() ?? '');
          setFollowing(new Set(follows.communityIds));
          setJoined(new Set(memberships.memberships.filter((m) => m.community && m.status === 'ACTIVE').map((m) => m.community!.id)));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load communities');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFollow(id: string) {
    try {
      const { following: isFollowing } = await toggleCommunityFollow(id);
      setFollowing((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.add(id);
        else next.delete(id);
        return next;
      });
    } catch {
      /* ignore */
    }
  }

  async function handleJoin(id: string) {
    try {
      setJoinBusy(id);
      const res = await joinCommunity(id);
      if (!res.alreadyRequested) {
        setJoined((prev) => new Set(prev).add(id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join community');
    } finally {
      setJoinBusy('');
    }
  }

  /** Unjoin straight from the list: the "Joined" badge doubles as the leave control. */
  async function handleLeave(id: string, name: string) {
    const ok = await confirmDialog({
      title: `Leave ${name}?`,
      message: 'You can rejoin any time (approval-based communities will re-review your request).',
      confirmLabel: 'Leave',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      setJoinBusy(id);
      await leaveCommunity(id);
      setJoined((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to leave community');
    } finally {
      setJoinBusy('');
    }
  }

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(communities.map((c) => c.category).filter((category): category is string => Boolean(category))))],
    [communities],
  );
  /** Universities present in the directory: the dropdown only offers real choices. */
  const universities = useMemo(
    () => Array.from(new Set(communities.map((c) => c.university?.trim()).filter((u): u is string => Boolean(u)))).sort(),
    [communities],
  );

  // Default order: your own university's communities first, then biggest.
  const sorted = useMemo(() => {
    const uni = myUniversity.toLowerCase();
    const mine = (c: CommunitySummary) => (uni && (c.university ?? '').trim().toLowerCase() === uni ? 0 : 1);
    return [...communities].sort((a, b) => {
      if (sortBy === 'MEMBERS') return (b.memberCount ?? 0) - (a.memberCount ?? 0);
      if (sortBy === 'NEWEST') return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      if (mine(a) !== mine(b)) return mine(a) - mine(b);
      return (b.memberCount ?? 0) - (a.memberCount ?? 0);
    });
  }, [communities, myUniversity, sortBy]);

  const filtered = sorted.filter((c) => {
    if (activeCategory !== 'All' && c.category !== activeCategory) return false;
    if (uniFilter !== 'All' && (c.university ?? '').trim() !== uniFilter) return false;
    if (quick === 'VERIFIED' && c.verificationStatus !== 'VERIFIED') return false;
    if (quick === 'MY_UNI' && (c.university ?? '').trim().toLowerCase() !== myUniversity.toLowerCase()) return false;
    if (quick === 'JOINED' && !joined.has(c._id) && c.founder !== userId) return false;
    if (quick === 'FOLLOWING' && !following.has(c._id)) return false;
    if (!search.trim()) return true;
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return rx.test(c.name) || rx.test(c.description ?? '') || rx.test(c.category ?? '') || rx.test(c.university ?? '');
  });

  const anyFilter = Boolean(search.trim()) || activeCategory !== 'All' || quick !== 'All' || uniFilter !== 'All' || sortBy !== 'RELEVANT';
  const moreCount = [uniFilter !== 'All', sortBy !== 'RELEVANT'].filter(Boolean).length;
  // Popular shows on the unfiltered view only, and only when there's a real choice to show.
  const popular = useMemo(() => {
    if (anyFilter) return [];
    const picks = pickPopularCommunities(communities, myUniversity);
    return picks.length >= 2 ? picks : [];
  }, [anyFilter, communities, myUniversity]);

  function resetFilters() {
    setSearch('');
    setActiveCategory('All');
    setQuick('All');
    setUniFilter('All');
    setSortBy('RELEVANT');
  }

  const toggleQuick = (next: QuickFilter) => setQuick((current) => (current === next ? 'All' : next));
  const membershipFor = (c: CommunitySummary): MembershipState => ({
    userId,
    joined: joined.has(c._id),
    following: following.has(c._id),
    busy: joinBusy === c._id,
    onJoin: () => void handleJoin(c._id),
    onLeave: () => void handleLeave(c._id, c.name),
    onFollow: () => void handleFollow(c._id),
  });

  return (
    <PageShell nav={<StudentNav active="/communities" />}>
      <Tour steps={COMMUNITIES_TOUR} storageKey="guildos-tour-communities-v1" />
      <PageHeader
        eyebrow="Communities"
        title="Find your people"
        description="Clubs, guilds and societies on every campus. Join one, or start your own."
        action={
          <>
            <span data-tour="community-search" className="flex min-w-0">
              <SearchField
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search communities"
              />
            </span>
            <span data-tour="community-create" className="flex shrink-0">
              <Button asChild href="/dashboard/communities/create" variant="primary" className="shrink-0 bg-slate-900 hover:bg-slate-800">
                <Plus className="h-4 w-4" /> Create
              </Button>
            </span>
          </>
        }
      />

      <div className="space-y-3" data-tour="community-categories">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPills items={categories} active={activeCategory} onChange={setActiveCategory} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={`${PILL} ${moreOpen || moreCount ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300' : PILL_OFF}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> More filters{moreCount ? ` · ${moreCount}` : ''}
            </button>
            <div className="inline-flex rounded-full border border-slate-300 p-0.5 dark:border-slate-700" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'grid'} aria-label="Card view" onClick={() => changeView('grid')} className={`rounded-full p-1.5 transition ${view === 'grid' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-pressed={view === 'list'} aria-label="List view" onClick={() => changeView('list')} className={`rounded-full p-1.5 transition ${view === 'list' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`}>
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* One-tap pills */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Pill active={quick === 'All'} onClick={() => setQuick('All')}>All</Pill>
          {myUniversity && <Pill active={quick === 'MY_UNI'} onClick={() => toggleQuick('MY_UNI')}><GraduationCap className="h-3.5 w-3.5" /> My university</Pill>}
          <Pill active={quick === 'VERIFIED'} onClick={() => toggleQuick('VERIFIED')}><BadgeCheck className="h-3.5 w-3.5" /> Verified</Pill>
          {userId && <Pill active={quick === 'JOINED'} onClick={() => toggleQuick('JOINED')}>Joined</Pill>}
          {userId && <Pill active={quick === 'FOLLOWING'} onClick={() => toggleQuick('FOLLOWING')}>Following</Pill>}
        </div>

        {moreOpen && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            {universities.length > 1 ? (
              <SelectMenu
                aria-label="Filter by university"
                className="w-56"
                size="sm"
                value={uniFilter}
                onChange={setUniFilter}
                options={[{ value: 'All', label: 'All universities' }, ...universities.map((u) => ({ value: u, label: u }))]}
              />
            ) : null}
            <SelectMenu
              aria-label="Sort communities"
              className="w-44"
              size="sm"
              value={sortBy}
              onChange={(v) => setSortBy(v as typeof sortBy)}
              options={[
                { value: 'RELEVANT', label: 'My university first' },
                { value: 'MEMBERS', label: 'Most members' },
                { value: 'NEWEST', label: 'Newest' },
              ]}
            />
            {anyFilter && (
              <button type="button" onClick={resetFilters} className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}

      {popular.length > 0 && (
        <section aria-label="Popular communities">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Sparkles className="h-4 w-4 text-amber-500" /> Popular{myUniversity ? ' on your campus' : ''}
          </h2>
          <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
            {popular.map((c) => <FeaturedCommunityCard key={c._id} community={c} />)}
          </div>
        </section>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-60 animate-pulse rounded-xl bg-white dark:bg-slate-900" />)}
        </div>
      ) : filtered.length ? (
        <div className="space-y-3" data-tour="community-list">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'community' : 'communities'}
            {anyFilter && (
              <button type="button" onClick={resetFilters} className="ml-2 font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Clear filters</button>
            )}
          </p>
          {view === 'list' ? (
            <div className="space-y-2">
              {filtered.map((c) => <CommunityListRow key={c._id} community={c} membership={membershipFor(c)} myUniversity={myUniversity} />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <CommunityGridCard key={c._id} community={c} membership={membershipFor(c)} onPreview={(src, alt) => setMediaPreview({ src, alt })} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          description={
            <>
              No communities found{anyFilter ? ' for these filters' : ''}.{' '}
              {anyFilter ? (
                <button type="button" onClick={resetFilters} className="font-medium text-indigo-600 hover:underline">Clear filters</button>
              ) : (
                <Link href="/dashboard/communities/create" className="font-medium text-indigo-600 hover:underline">Start the first one</Link>
              )}
            </>
          }
        />
      )}
      <MediaPreviewDialog preview={mediaPreview} onClose={() => setMediaPreview(null)} />
    </PageShell>
  );
}
