'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Users, GraduationCap, Search, Plus } from 'lucide-react';

import { StudentNav } from '../../components/guildos/student-nav';
import { getCommunities, getUserMemberships, joinCommunity, leaveCommunity, resolveAvatarUrl, type CommunitySummary } from '../../components/guildos/community-list-api';
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

/** First-visit walkthrough of the communities directory. */
const COMMUNITIES_TOUR: TourStep[] = [
  {
    target: 'community-categories',
    title: 'Browse by category',
    body: 'Tech, academic, religious, social — filter the directory to what you care about.',
  },
  {
    target: 'community-search',
    title: 'Looking for a specific club?',
    body: 'Search by name, university, or what the community is about.',
  },
  {
    target: 'community-list',
    title: 'Follow or join',
    body: 'Follow to see posts in your feed, or join to become a member — the blue badge means GuildOS verified the community.',
  },
  {
    target: 'community-create',
    title: 'Run your own?',
    body: 'Create your community here — verify it with a university email or an endorsement letter and start hosting events.',
  },
];

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState('');
  const [joinBusy, setJoinBusy] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [uniFilter, setUniFilter] = useState('All');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'RELEVANT' | 'MEMBERS' | 'NEWEST'>('RELEVANT');
  const [myUniversity, setMyUniversity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mediaPreview, setMediaPreview] = useState<{ src: string; alt: string } | null>(null);

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

  /** Unjoin straight from the list — the "Joined" badge doubles as the leave control. */
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
  /** Universities present in the directory — the dropdown only offers real choices. */
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
    if (verifiedOnly && c.verificationStatus !== 'VERIFIED') return false;
    if (!search.trim()) return true;
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return rx.test(c.name) || rx.test(c.description ?? '') || rx.test(c.category ?? '') || rx.test(c.university ?? '');
  });

  return (
    <PageShell nav={<StudentNav active="/communities" />}>
      <Tour steps={COMMUNITIES_TOUR} storageKey="guildos-tour-communities-v1" />
      <PageHeader
        eyebrow="Communities"
        title="Communities"
        description="Discover and join student communities across GuildOS."
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

      <div data-tour="community-categories" className="flex flex-wrap items-center gap-3">
        <FilterPills items={categories} active={activeCategory} onChange={setActiveCategory} />
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
        <button
          type="button"
          onClick={() => setVerifiedOnly((v) => !v)}
          aria-pressed={verifiedOnly}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${verifiedOnly ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-sky-300'}`}
        >
          <BadgeCheck className="h-3.5 w-3.5" /> Verified
        </button>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-60 animate-pulse rounded-3xl bg-white dark:bg-slate-900" />)}
        </div>
      ) : filtered.length ? (
        <div className="space-y-3" data-tour="community-list">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{filtered.length} {filtered.length === 1 ? 'community' : 'communities'}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <article key={c._id} className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
                  <Link href={`/communities/${c.slug}`} className="block">
                    {/* Cover keeps the banner's wide aspect ratio so the artwork is never cut. */}
                    <div className="relative aspect-[40/11] min-h-24 bg-gradient-to-br from-indigo-500/20 via-indigo-100 to-slate-100 dark:from-indigo-500/10 dark:via-slate-800 dark:to-slate-900">
                      {c.coverImage ? (
                        <img
                          src={resolveAvatarUrl(c.coverImage)}
                          alt={`${c.name} cover`}
                          className="h-full w-full cursor-zoom-in object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setMediaPreview({ src: resolveAvatarUrl(c.coverImage), alt: `${c.name} cover` });
                          }}
                        />
                      ) : null}
                      {c.category ? <span className="absolute right-2 top-2 rounded-full bg-white/90 dark:bg-slate-900/90 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 shadow-sm backdrop-blur">{c.category}</span> : null}
                    </div>
                  </Link>
                  <div className="relative z-20 -mt-7 pl-4">
                    {c.logo ? (
                      <img
                        src={resolveAvatarUrl(c.logo)}
                        alt={c.name}
                        className="h-14 w-14 cursor-zoom-in rounded-full object-cover shadow-md"
                        onError={(event) => {
                          const fallback = document.createElement('span');
                          fallback.className = 'grid h-14 w-14 place-items-center rounded-full bg-indigo-500 text-xl font-semibold text-white shadow-md';
                          fallback.textContent = c.name.slice(0, 1);
                          event.currentTarget.replaceWith(fallback);
                        }}
                        onClick={() => setMediaPreview({ src: resolveAvatarUrl(c.logo), alt: `${c.name} logo` })}
                      />
                    ) : (
                      <span className="grid h-14 w-14 place-items-center rounded-full bg-indigo-500 text-xl font-semibold text-white shadow-md">{c.name.slice(0, 1)}</span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col px-4 pb-4 pt-2">
                    <div className="flex items-start gap-1.5">
                      <Link href={`/communities/${c.slug}`} className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:underline">{c.name}</Link>
                      {c.verificationStatus === 'VERIFIED' ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" /> : null}
                    </div>
                    {c.university ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><GraduationCap className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.university}</span></p>
                    ) : null}
                    <p className="mt-1.5 line-clamp-2 flex-1 text-xs text-slate-500 dark:text-slate-400">{c.shortDescription || c.description}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Users className="h-3.5 w-3.5" /> {c.memberCount}{c.followerCount ? ` · ${c.followerCount}` : ''}</span>
                      <div className="flex items-center gap-1.5">
                        {userId && c.founder === userId ? (
                          /* Your own community reads "Owned", not "Joined" — you didn't join it, you built it. */
                          <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-500/30">Owned</span>
                        ) : joined.has(c._id) ? (
                          <button
                            onClick={() => void handleLeave(c._id, c.name)}
                            disabled={joinBusy === c._id}
                            title="Click to leave this community"
                            className="group/leave rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                          >
                            <span className="group-hover/leave:hidden">Joined</span>
                            <span className="hidden group-hover/leave:inline">Leave?</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => void handleJoin(c._id)}
                            disabled={joinBusy === c._id}
                            className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {joinBusy === c._id ? 'Joining…' : 'Join'}
                          </button>
                        )}
                        {/* You can't follow your own community — the button only shows for everyone else. */}
                        {userId && c.founder === userId ? null : (
                          <button
                            onClick={() => void handleFollow(c._id)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition ${following.has(c._id) ? 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400' : 'border border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}
                          >
                            {following.has(c._id) ? 'Following' : 'Follow'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          description={
            <>
              No communities found{search.trim() || activeCategory !== 'All' ? ' for this filter' : ''}.{' '}
              <Link href="/dashboard/communities/create" className="font-medium text-indigo-600 hover:underline">Create one →</Link>
            </>
          }
        />
      )}
      <MediaPreviewDialog preview={mediaPreview} onClose={() => setMediaPreview(null)} />
    </PageShell>
  );
}
