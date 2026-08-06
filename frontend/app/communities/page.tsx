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
import { FilterPills } from '../../components/guildos/ui/filter-pills';
import { MediaPreviewDialog } from '../../components/guildos/ui/media-preview-dialog';

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState('');
  const [joinBusy, setJoinBusy] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
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

  const filtered = communities.filter((c) => {
    if (activeCategory !== 'All' && c.category !== activeCategory) return false;
    if (!search.trim()) return true;
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return rx.test(c.name) || rx.test(c.description ?? '') || rx.test(c.category ?? '') || rx.test(c.university ?? '');
  });

  return (
    <PageShell nav={<StudentNav active="/communities" />}>
      <PageHeader
        eyebrow="Communities"
        title="Communities"
        description="Discover and join student communities across GuildOS."
        action={
          <>
            <SearchField
              icon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search communities"
            />
            <Button asChild href="/dashboard/communities/create" variant="primary" className="shrink-0 bg-slate-900 hover:bg-slate-800">
              <Plus className="h-4 w-4" /> Create
            </Button>
          </>
        }
      />

      <FilterPills items={categories} active={activeCategory} onChange={setActiveCategory} />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-3xl bg-white dark:bg-slate-900" />)}
        </div>
      ) : filtered.length ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{filtered.length} {filtered.length === 1 ? 'community' : 'communities'}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <article key={c._id} className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
                  <Link href={`/communities/${c.slug}`} className="block">
                    <div className="relative h-24 bg-gradient-to-br from-indigo-500/20 via-indigo-100 to-slate-100">
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
                      {c.category ? <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 shadow-sm backdrop-blur">{c.category}</span> : null}
                    </div>
                  </Link>
                  <div className="absolute left-4 top-16 z-20">
                    {c.logo ? (
                      <img
                        src={resolveAvatarUrl(c.logo)}
                        alt={c.name}
                        className="h-14 w-14 cursor-zoom-in rounded-2xl border-2 border-white bg-white dark:bg-slate-900 object-cover shadow-md ring-1 ring-slate-900/5"
                        onError={(event) => {
                          const fallback = document.createElement('span');
                          fallback.className = 'grid h-14 w-14 place-items-center rounded-2xl border-2 border-white bg-indigo-500 text-xl font-semibold text-white shadow-md ring-1 ring-slate-900/5';
                          fallback.textContent = c.name.slice(0, 1);
                          event.currentTarget.replaceWith(fallback);
                        }}
                        onClick={() => setMediaPreview({ src: resolveAvatarUrl(c.logo), alt: `${c.name} logo` })}
                      />
                    ) : (
                      <span className="grid h-14 w-14 place-items-center rounded-2xl border-2 border-white bg-indigo-500 text-xl font-semibold text-white shadow-md ring-1 ring-slate-900/5">{c.name.slice(0, 1)}</span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col px-4 pb-4 pt-9">
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
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">Owned</span>
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
                        <button
                          onClick={() => void handleFollow(c._id)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${following.has(c._id) ? 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400' : 'border border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}
                        >
                          {following.has(c._id) ? 'Following' : 'Follow'}
                        </button>
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
