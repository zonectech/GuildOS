'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag } from 'lucide-react';

import { getCurrentUser } from '../../../../components/guildos/auth-api';
import {
  getModerationQueue,
  setOpportunityModeration,
  type ModerationOpportunity,
} from '../../../../components/guildos/opportunity-api';

export default function OpportunityModerationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [queue, setQueue] = useState<ModerationOpportunity[]>([]);

  async function load() {
    const { opportunities } = await getModerationQueue();
    setQueue(opportunities);
  }

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        if (user.role !== 'ADMIN') {
          setError('Admins only.');
          return;
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load moderation queue');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function decide(id: string, status: 'VERIFIED' | 'FLAGGED' | 'ARCHIVED') {
    try {
      await setOpportunityModeration(id, status);
      setQueue((list) => list.filter((o) => o.id !== id));
      setNotice(`Opportunity ${status.toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update opportunity');
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-slate-500 dark:text-slate-400 shadow-sm">Loading…</div>;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Opportunity moderation</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Review pending and flagged opportunities before they reach students. Prevents scam postings.</p>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      {queue.length ? (
        <div className="space-y-3">
          {queue.map((o) => (
            <div key={o.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{o.moderationStatus}</span>
                  {o.reportCount ? <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"><Flag className="h-3 w-3" /> {o.reportCount} report{o.reportCount === 1 ? '' : 's'}</span> : null}
                  <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{o.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{[o.organization, o.location].filter(Boolean).join(' · ')} · {o.category.replace('_', ' ')} · source {o.source ?? 'MANUAL'}</p>
                  {o.description ? <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">{o.description}</p> : null}
                  {o.applicationUrl ? <a href={o.applicationUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">{o.applicationUrl}</a> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => void decide(o.id, 'VERIFIED')} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Verify</button>
                  <button onClick={() => void decide(o.id, 'FLAGGED')} className="rounded-2xl border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700">Flag</button>
                  <button onClick={() => void decide(o.id, 'ARCHIVED')} className="rounded-2xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400">Archive</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-sm text-slate-500 dark:text-slate-400">No opportunities awaiting review.</p>
      )}
    </div>
  );
}
