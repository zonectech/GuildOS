'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, ArrowLeft } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import { getSavedOpportunities, type Opportunity, type OpportunityAction } from '../../../components/guildos/opportunity-api';
import { OpportunityCard } from '../../../components/guildos/opportunities/opportunity-card';
import { StudentNav } from '../../../components/guildos/student-nav';

export default function SavedOpportunitiesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Opportunity[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      try {
        const { opportunities } = await getSavedOpportunities();
        if (!cancelled) setItems(opportunities);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load saved opportunities');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function onActioned(id: string, action: OpportunityAction) {
    if (action === 'NOT_RELEVANT') setItems((list) => list.filter((o) => o.id !== id));
    else setItems((list) => list.map((o) => (o.id === id ? { ...o, action } : o)));
  }

  const groups: { action: OpportunityAction; title: string }[] = [
    { action: 'APPLIED', title: 'Applied' },
    { action: 'INTERESTED', title: 'Interested' },
    { action: 'SAVED', title: 'Saved for later' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav active="/opportunities" />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <Link href="/opportunities" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> All jobs
        </Link>
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950 dark:text-white"><Bookmark className="h-6 w-6" /> My jobs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Jobs you applied to, are interested in, or saved. Updates from employers show here too.</p>
        </header>

        {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-white dark:bg-slate-900" />)}</div>
        ) : items.length ? (
          <div className="space-y-8">
            {groups.map((g) => {
              const list = items.filter((o) => o.action === g.action);
              if (!list.length) return null;
              return (
                <section key={g.action} className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{g.title} <span className="font-normal text-slate-400">({list.length})</span></h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {list.map((opp) => (
                      <OpportunityCard key={opp.id} opp={opp} onActioned={(action) => onActioned(opp.id, action)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
            <Bookmark className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Nothing here yet. Save a job or apply to one and it shows up here.</p>
            <Link href="/opportunities" className="mt-3 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Browse jobs</Link>
          </div>
        )}
      </main>
    </div>
  );
}
