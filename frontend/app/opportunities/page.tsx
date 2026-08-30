'use client';

import { toast } from '../../components/guildos/ui/toast';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bookmark, Clock, Sparkles, Target } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import {
  getRecommendedOpportunities,
  listOpportunities,
  OPPORTUNITY_CATEGORY_LABELS,
  OPPORTUNITIES_COMING_SOON,
  syncOpportunities,
  type Opportunity,
  type OpportunityCategory,
  type Recommendations,
} from '../../components/guildos/opportunity-api';
import { OpportunityCard } from '../../components/guildos/opportunities/opportunity-card';
import { StudentNav } from '../../components/guildos/student-nav';

const CATEGORIES = Object.keys(OPPORTUNITY_CATEGORY_LABELS) as OpportunityCategory[];

// Single flip point lives in opportunity-api.ts (shared with search).
const COMING_SOON = OPPORTUNITIES_COMING_SOON;

export default function OpportunitiesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recs, setRecs] = useState<Recommendations | null>(null);
  const [all, setAll] = useState<Opportunity[]>([]);
  const [category, setCategory] = useState<OpportunityCategory | ''>('');
  const [search, setSearch] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function loadBrowse(cat: OpportunityCategory | '', q: string) {
    const { opportunities } = await listOpportunities({ category: cat || undefined, search: q || undefined });
    setAll(opportunities);
  }

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        setIsAdmin(user.role === 'ADMIN');
        if (COMING_SOON) return;
        const [recResult] = await Promise.all([getRecommendedOpportunities(), loadBrowse('', '')]);
        setRecs(recResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load opportunities');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (loading || COMING_SOON) return;
    void loadBrowse(category, search).catch(() => setAll([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search]);

  const hasRecs = useMemo(
    () => recs && (recs.recommended.length || recs.stretch.length || recs.nearDeadline.length || recs.trending.length),
    [recs],
  );

  function patchAction(id: string, action: Opportunity['action']) {
    const apply = (list: Opportunity[]) => list.map((o) => (o.id === id ? { ...o, action } : o));
    setAll(apply);
    setRecs((r) => (r ? { recommended: apply(r.recommended), stretch: apply(r.stretch), nearDeadline: apply(r.nearDeadline), trending: apply(r.trending) } : r));
  }

  async function handleSync() {
    try {
      setSyncing(true);
      setError('');
      const result = await syncOpportunities();
      const [recResult] = await Promise.all([getRecommendedOpportunities(), loadBrowse(category, search)]);
      setRecs(recResult);
      setError('');
      toast.success('Opportunities synced', `+${result.created} new, ${result.updated} updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sync opportunities');
    } finally {
      setSyncing(false);
    }
  }

  if (COMING_SOON) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
        <StudentNav active="/opportunities" />
        <main className="mx-auto max-w-6xl px-4 py-10">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-20 text-center shadow-sm">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-indigo-100/60 blur-3xl" />
            <div className="relative flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 shadow-lg shadow-slate-900/20">
                <Sparkles className="h-8 w-8 text-amber-400" />
              </div>
              <span className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                Coming soon
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Opportunities</h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                Scholarships, internships, grants, and competitions — matched to your verified
                activities, leadership, certificates, and Guild Score. We&apos;re putting the finishing
                touches on it.
              </p>
              <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-4">
                  <Target className="mx-auto h-5 w-5 text-indigo-600" />
                  <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">Matched to you</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ranked by your verified profile</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-4">
                  <Clock className="mx-auto h-5 w-5 text-indigo-600" />
                  <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">Deadline alerts</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Never miss a closing date</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-4">
                  <Bookmark className="mx-auto h-5 w-5 text-indigo-600" />
                  <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">Save &amp; track</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Keep a shortlist as you apply</p>
                </div>
              </div>
              <p className="mt-8 text-xs text-slate-400 dark:text-slate-500">
                Keep attending events and earning certificates — your Guild Score powers your matches.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-100 dark:bg-slate-950"><StudentNav active="/opportunities" /><main className="mx-auto max-w-6xl px-4 py-10"><p className="text-slate-500 dark:text-slate-400">Finding opportunities for you…</p></main></div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav active="/opportunities" />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Opportunities</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Matched to your verified activities, leadership, certificates, and Guild Score.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/opportunities/saved" className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Bookmark className="h-4 w-4" /> Saved
          </Link>
          {isAdmin ? (
            <button onClick={() => void handleSync()} disabled={syncing} className="rounded-2xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 disabled:opacity-50">
              {syncing ? 'Syncing…' : 'Sync from partner sources'}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {hasRecs ? (
        <>
          <Section title="Recommended for you" items={recs!.recommended} onActioned={patchAction} />
          <Section title="Near deadline" items={recs!.nearDeadline} onActioned={patchAction} />
          <Section title="Stretch opportunities" subtitle="Slightly above your current profile — great for growth." items={recs!.stretch} onActioned={patchAction} />
          <Section title="Trending" items={recs!.trending} onActioned={patchAction} />
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-sm text-slate-500 dark:text-slate-400">Complete events, earn certificates, and take on leadership to unlock personalized recommendations.</p>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Browse all</h2>
          <input className="ev-input w-full sm:w-56" placeholder="Search opportunities" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCategory('')} className={`rounded-full px-3 py-1 text-xs font-medium ${category === '' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400'}`}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`rounded-full px-3 py-1 text-xs font-medium ${category === c ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400'}`}>{OPPORTUNITY_CATEGORY_LABELS[c]}</button>
          ))}
        </div>
        {all.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {all.map((o) => <OpportunityCard key={o.id} opp={o} onActioned={(a) => patchAction(o.id, a)} />)}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No opportunities in this view.</p>
        )}
      </section>
    </main>
    </div>
  );
}

function Section({ title, subtitle, items, onActioned }: { title: string; subtitle?: string; items: Opportunity[]; onActioned: (id: string, action: Opportunity['action']) => void }) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((o) => <OpportunityCard key={o.id} opp={o} onActioned={(a) => onActioned(o.id, a)} />)}
      </div>
    </section>
  );
}
