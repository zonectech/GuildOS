'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { StudentNav } from '../../components/guildos/student-nav';
import { getCommunities, resolveAvatarUrl, type CommunitySummary } from '../../components/guildos/community-list-api';
import { listEvents, type EventSummary } from '../../components/guildos/event-api';
import { listOpportunities, type Opportunity } from '../../components/guildos/opportunity-api';
import { searchPeople, type PersonResult } from '../../components/guildos/auth-api';
import { searchKnowledge, type KnowledgeSearchResult } from '../../components/guildos/knowledge-api';

function SearchInner() {
  const params = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const [p, c, e, o, k] = await Promise.allSettled([searchPeople(q), getCommunities(), listEvents(), listOpportunities({ search: q }), searchKnowledge(q)]);
      if (cancelled) return;
      if (p.status === 'fulfilled') setPeople(p.value.people);
      if (c.status === 'fulfilled') setCommunities(c.value.communities.filter((x) => rx.test(x.name) || rx.test(x.description ?? '')).slice(0, 6));
      if (e.status === 'fulfilled') setEvents(e.value.events.filter((x) => rx.test(x.title) || rx.test(x.shortDescription ?? '')).slice(0, 6));
      if (o.status === 'fulfilled') setOpps(o.value.opportunities.slice(0, 6));
      if (k.status === 'fulfilled') setKnowledge(k.value.results.slice(0, 6));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  const empty = !loading && !people.length && !communities.length && !events.length && !opps.length && !knowledge.length;

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-xl font-semibold text-slate-950">Search results {q ? <span className="text-slate-400">for &ldquo;{q}&rdquo;</span> : null}</h1>
        </header>

        {loading ? (
          <p className="text-sm text-slate-500">Searching…</p>
        ) : empty ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No matches for &ldquo;{q}&rdquo;. Try a different term.</p>
        ) : (
          <>
            {people.length ? (
              <Group title="People">
                {people.map((p) => (
                  <Link key={p.id} href={`/profile/${encodeURIComponent(p.username)}`} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                    {p.avatar ? (
                      <img src={resolveAvatarUrl(p.avatar)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">{p.fullName.slice(0, 1)}</span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{p.fullName} <span className="font-normal text-slate-400">@{p.username}</span></p>
                      {p.headline ? <p className="truncate text-xs text-slate-500">{p.headline}</p> : null}
                    </div>
                  </Link>
                ))}
              </Group>
            ) : null}
            {communities.length ? (
              <Group title="Communities">
                {communities.map((c) => (
                  <Link key={c._id} href={`/communities/${c.slug}`} className="block rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                    <p className="text-sm font-medium text-slate-900">{c.name}</p>
                    <p className="truncate text-xs text-slate-500">{c.description}</p>
                  </Link>
                ))}
              </Group>
            ) : null}
            {events.length ? (
              <Group title="Events">
                {events.map((e) => (
                  <Link key={e._id} href={`/events/${e.slug}`} className="block rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                    <p className="text-sm font-medium text-slate-900">{e.title}</p>
                    <p className="truncate text-xs text-slate-500">{e.shortDescription}</p>
                  </Link>
                ))}
              </Group>
            ) : null}
            {knowledge.length ? (
              <Group title="Knowledge">
                {knowledge.map((k) => (
                  <Link key={k._id} href={`/communities/${encodeURIComponent(k.communitySlug)}?tab=knowledge&resource=${encodeURIComponent(k._id)}`} className="block rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                    <p className="text-sm font-medium text-slate-900">{k.title}</p>
                    <p className="truncate text-xs text-slate-500">{[k.communityName, k.summary].filter(Boolean).join(' · ')}</p>
                  </Link>
                ))}
              </Group>
            ) : null}
            {opps.length ? (
              <Group title="Opportunities">
                {opps.map((o) => (
                  <Link key={o.id} href={`/opportunities/${o.id}`} className="block rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                    <p className="text-sm font-medium text-slate-900">{o.title}</p>
                    <p className="truncate text-xs text-slate-500">{[o.organization, o.location].filter(Boolean).join(' · ')}</p>
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
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
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
