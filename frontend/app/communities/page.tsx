'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { StudentNav } from '../../components/guildos/student-nav';
import { getCommunities, getUserMemberships, joinCommunity, resolveAvatarUrl, type CommunitySummary } from '../../components/guildos/community-list-api';
import { getCurrentUser } from '../../components/guildos/auth-api';
import { getFollowedCommunityIds, toggleCommunityFollow } from '../../components/guildos/follow-api';

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [joinBusy, setJoinBusy] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const filtered = search.trim()
    ? communities.filter((c) => {
        const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        return rx.test(c.name) || rx.test(c.description ?? '') || rx.test(c.category ?? '') || rx.test(c.university ?? '');
      })
    : communities;

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav active="/communities" />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Communities</h1>
            <p className="text-sm text-slate-500">Discover and join student communities across GuildOS.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="ev-input w-56" placeholder="Search communities" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Link href="/dashboard/communities/create" className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create community</Link>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-white" />)}
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <div key={c._id} className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-indigo-300">
                <Link href={`/communities/${c.slug}`} className="block">
                  <div className="h-20 bg-gradient-to-br from-indigo-100 to-slate-100">
                    {c.coverImage ? <img src={resolveAvatarUrl(c.coverImage)} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <div className="-mt-9 mb-2 flex items-center gap-2">
                    {c.logo ? <img src={resolveAvatarUrl(c.logo)} alt={c.name} className="h-12 w-12 rounded-2xl border-2 border-white object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-white bg-indigo-500 text-lg font-semibold text-white">{c.name.slice(0, 1)}</span>}
                  </div>
                  <Link href={`/communities/${c.slug}`} className="text-sm font-semibold text-slate-900 hover:underline">
                    {c.name}
                    {c.verificationStatus === 'VERIFIED' ? <span className="ml-1 align-middle text-xs font-medium text-sky-600">✓</span> : null}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 flex-1 text-xs text-slate-500">{c.shortDescription || c.description}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">{c.memberCount} members{c.followerCount ? ` · ${c.followerCount} followers` : ''}</span>
                    <div className="flex items-center gap-1.5">
                      {joined.has(c._id) ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Joined</span>
                      ) : (
                        <button
                          onClick={() => void handleJoin(c._id)}
                          disabled={joinBusy === c._id}
                          className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {joinBusy === c._id ? 'Joining…' : 'Join'}
                        </button>
                      )}
                      <button
                        onClick={() => void handleFollow(c._id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${following.has(c._id) ? 'bg-slate-100 text-slate-600' : 'border border-indigo-200 text-indigo-600'}`}
                      >
                        {following.has(c._id) ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No communities found. <Link href="/dashboard/communities/create" className="text-indigo-600 hover:underline">Create one →</Link></p>
        )}
      </main>
    </div>
  );
}
