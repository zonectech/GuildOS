'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { StudentNav } from '../../components/guildos/student-nav';
import { resolveAvatarUrl } from '../../components/guildos/community-list-api';
import { OPPORTUNITIES_COMING_SOON } from '../../components/guildos/opportunity-api';
import {
  unifiedSearch,
  type SearchPerson,
  type SearchCommunity,
  type SearchEvent,
  type SearchOpportunity,
  type SearchKnowledge,
} from '../../components/guildos/search-api';

function SearchInner() {
  const params = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const [people, setPeople] = useState<SearchPerson[]>([]);
  const [communities, setCommunities] = useState<SearchCommunity[]>([]);
  const [events, setEvents] = useState<SearchEvent[]>([]);
  const [opps, setOpps] = useState<SearchOpportunity[]>([]);
  const [knowledge, setKnowledge] = useState<SearchKnowledge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const results = await unifiedSearch(q);
        if (cancelled) return;
        setPeople(results.people ?? []);
        setCommunities(results.communities ?? []);
        setEvents(results.events ?? []);
        // Opportunities are locked (coming soon) — don't surface them in search
        // even if an older backend still returns matches.
        setOpps(OPPORTUNITIES_COMING_SOON ? [] : results.opportunities ?? []);
        setKnowledge(results.knowledge ?? []);
      } catch {
        if (cancelled) return;
        setPeople([]);
        setCommunities([]);
        setEvents([]);
        setOpps([]);
        setKnowledge([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  const empty = !loading && !people.length && !communities.length && !events.length && !opps.length && !knowledge.length;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-xl font-semibold text-slate-950 dark:text-white">Search results {q ? <span className="text-slate-400 dark:text-slate-500">for &ldquo;{q}&rdquo;</span> : null}</h1>
        </header>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Searching…</p>
        ) : empty ? (
          <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-sm text-slate-500 dark:text-slate-400">No matches for &ldquo;{q}&rdquo;. Try a different term.</p>
        ) : (
          <>
            {people.length ? (
              <Group title="People">
                {people.map((p) => (
                  <Link key={p.id} href={`/profile/${encodeURIComponent(p.username)}`} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                    {p.avatar ? (
                      <img src={resolveAvatarUrl(p.avatar)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 dark:bg-slate-950 text-sm font-semibold text-slate-500 dark:text-slate-400">{p.fullName.slice(0, 1)}</span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{p.fullName} <span className="font-normal text-slate-400 dark:text-slate-500">@{p.username}</span></p>
                      {p.headline ? <p className="truncate text-xs text-slate-500 dark:text-slate-400">{p.headline}</p> : null}
                    </div>
                  </Link>
                ))}
              </Group>
            ) : null}
            {communities.length ? (
              <Group title="Communities">
                {communities.map((c) => (
                  <Link key={c._id} href={`/communities/${c.slug}`} className="block rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{c.description}</p>
                  </Link>
                ))}
              </Group>
            ) : null}
            {events.length ? (
              <Group title="Events">
                {events.map((e) => (
                  <Link key={e._id} href={`/events/${e.slug}`} className="block rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{e.title}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{e.shortDescription}</p>
                  </Link>
                ))}
              </Group>
            ) : null}
            {knowledge.length ? (
              <Group title="Knowledge">
                {knowledge.map((k) => (
                  <Link key={k._id} href={`/communities/${encodeURIComponent(k.communitySlug)}?tab=knowledge&resource=${encodeURIComponent(k._id)}`} className="block rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{k.title}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{[k.communityName, k.summary].filter(Boolean).join(' · ')}</p>
                  </Link>
                ))}
              </Group>
            ) : null}
            {opps.length ? (
              <Group title="Opportunities">
                {opps.map((o) => (
                  <Link key={o.id} href={`/opportunities/${o.id}`} className="block rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{o.title}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{[o.organization, o.location].filter(Boolean).join(' · ')}</p>
                  </Link>
                ))}
              </Group>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchInner />
    </Suspense>
  );
}
