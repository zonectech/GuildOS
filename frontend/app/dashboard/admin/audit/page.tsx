'use client';

import { useEffect, useState } from 'react';
import { Loader2, ScrollText } from 'lucide-react';

import { getAdminAudit, type AuditEntry } from '../../../../components/guildos/admin-api';
import { Loading } from '../../../../components/guildos/ui/loading';

function timeAgo(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-NG');
}

const ACTION_TONE: Record<string, string> = {
  REMOVE: 'bg-rose-50 text-rose-700',
  BLOCK: 'bg-rose-50 text-rose-700',
  DELETE: 'bg-rose-50 text-rose-700',
  REJECT: 'bg-amber-50 text-amber-700',
  SUSPEND: 'bg-amber-50 text-amber-700',
  TAKEDOWN: 'bg-amber-50 text-amber-700',
  VERIFY: 'bg-emerald-50 text-emerald-700',
  RESTORE: 'bg-emerald-50 text-emerald-700',
  UNBLOCK: 'bg-emerald-50 text-emerald-700',
  BROADCAST: 'bg-indigo-50 text-indigo-700',
};

function toneFor(action: string) {
  const key = Object.keys(ACTION_TONE).find((k) => action.includes(k));
  return key ? ACTION_TONE[key] : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400';
}

export default function AuditLogPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const result = await getAdminAudit(page);
        if (cancelled) return;
        setEntries(result.entries);
        setPages(result.pages);
        setTotal(result.total);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load audit log');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950 dark:text-white"><ScrollText className="h-6 w-6" /> Admin audit log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Every administrator action — verifications, blocks, removals, suspensions, and broadcasts. {total} total.</p>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm"><Loading /></div>
      ) : entries.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <ul className="divide-y divide-slate-100">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneFor(e.action)}`}>{e.action.replace(/_/g, ' ')}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-800 dark:text-slate-200">
                    <span className="font-medium">{e.admin}</span>
                    {e.targetType ? <span className="text-slate-500 dark:text-slate-400"> · {e.targetType.toLowerCase()} {e.targetId ? `#${e.targetId.slice(-6)}` : ''}</span> : null}
                    {e.note ? <span className="text-slate-500 dark:text-slate-400"> — {e.note}</span> : null}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{timeAgo(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">No admin actions recorded yet.</p>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 disabled:opacity-50">Previous</button>
          <span className="text-sm text-slate-500 dark:text-slate-400">Page {page} of {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 disabled:opacity-50">Next</button>
        </div>
      ) : null}
    </div>
  );
}
