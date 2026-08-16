'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { LogoSpinner } from '../../../../components/guildos/ui/loading';
import {
  getCommunity,
  getCommunityPeoplePage,
  resolveAvatarUrl,
  type CommunityPeopleEntry,
} from '../../../../components/guildos/community-list-api';
import { StudentNav } from '../../../../components/guildos/student-nav';

type CommunityMeta = {
  id: string;
  slug: string;
  name: string;
  memberCount: number;
  followerCount: number;
};

export default function CommunityPeoplePage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params?.slug;
  const tab = searchParams.get('tab') === 'followers' ? 'followers' : 'members';

  const [community, setCommunity] = useState<CommunityMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<CommunityPeopleEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');

  const title = useMemo(() => (tab === 'followers' ? 'Followers' : 'Members'), [tab]);

  useEffect(() => {
    let cancelled = false;
    async function loadCommunity() {
      if (!slug) return;
      try {
        setLoading(true);
        setError('');
        const response = await getCommunity(slug);
        if (cancelled) return;
        setCommunity({
          id: response.community._id,
          slug: response.community.slug,
          name: response.community.name,
          memberCount: response.community.memberCount,
          followerCount: response.community.followerCount ?? 0,
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load community');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCommunity();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const fetchPeople = useCallback(
    async (opts?: { q?: string; nextCursor?: string | null }) => {
      if (!community?.id) return;
      try {
        setBusy(true);
        setError('');
        const page = await getCommunityPeoplePage(community.id, {
          kind: tab,
          q: opts?.q?.trim() || undefined,
          cursor: opts?.nextCursor || undefined,
          limit: 30,
        });
        if (opts?.nextCursor) {
          setRows((current) => [...current, ...page.items]);
        } else {
          setRows(page.items);
        }
        setCursor(page.nextCursor);
        setTotal(page.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load people');
      } finally {
        setBusy(false);
      }
    },
    [community?.id, tab],
  );

  useEffect(() => {
    if (!community?.id) return;
    setRows([]);
    setCursor(null);
    setTotal(0);
    setQuery('');
    void fetchPeople();
  }, [community?.id, tab, fetchPeople]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
        <StudentNav active="/communities" />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <LogoSpinner label="Loading community people…" />
        </main>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
        <StudentNav active="/communities" />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error || 'Community not found'}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav active="/communities" />

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href={`/communities/${encodeURIComponent(community.slug)}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600">
                <ArrowLeft className="h-4 w-4" /> Back to community
              </Link>
              <h1 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">{community.name} · {title}</h1>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
              {total}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.replace(`/communities/${encodeURIComponent(community.slug)}/people?tab=members`)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === 'members' ? 'bg-indigo-600 text-white' : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}
            >
              Members ({community.memberCount})
            </button>
            <button
              type="button"
              onClick={() => router.replace(`/communities/${encodeURIComponent(community.slug)}/people?tab=followers`)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === 'followers' ? 'bg-indigo-600 text-white' : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}
            >
              Followers ({community.followerCount})
            </button>
          </div>

          <input
            type="text"
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              void fetchPeople({ q: value });
            }}
            placeholder={`Search ${tab} by name or username…`}
            className="mt-4 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-indigo-400"
          />

          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

          <div className="mt-4 space-y-2">
            {!rows.length ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{busy ? 'Loading…' : `No ${tab} found.`}</p>
            ) : (
              rows.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 px-4 py-3">
                  <MemberAvatar fullName={entry.user.fullName} avatar={entry.user.profile?.avatar} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{entry.user.fullName}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {entry.user.profile?.username ? `@${entry.user.profile.username}` : 'GuildOS user'}
                      {entry.timestamp ? ` · ${new Date(entry.timestamp).toLocaleDateString('en-NG')}` : ''}
                    </p>
                  </div>
                  {entry.kind === 'MEMBER' ? (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                      {entry.role?.replace('_', ' ') ?? 'MEMBER'}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 dark:bg-slate-950 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      FOLLOWER
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {cursor ? (
            <button
              type="button"
              onClick={() => void fetchPeople({ q: query, nextCursor: cursor })}
              disabled={busy}
              className="mt-4 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Loading…' : `Load more (${rows.length} of ${total})`}
            </button>
          ) : null}
        </div>
      </main>
    </div>
  );
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
    return <img src={url} alt={fullName} className="h-10 w-10 shrink-0 rounded-full border border-slate-200 dark:border-slate-800 object-cover" />;
  }
  return (
    <div className="h-10 w-10 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-500/20 grid place-items-center text-sm font-semibold text-indigo-600 dark:text-indigo-300">
      {initials || '?'}
    </div>
  );
}
