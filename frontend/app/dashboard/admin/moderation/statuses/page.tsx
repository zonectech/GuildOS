'use client';

import { Loading } from '../../../../../components/guildos/ui/loading';

// Save as: app/admin/moderation/statuses/page.tsx
// (4 levels below the project root, like your opportunity moderation page.
//  If you put it somewhere else, adjust the ../ depth of the imports.)
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag } from 'lucide-react';

import { getCurrentUser } from '../../../../../components/guildos/api/auth-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type ReportedStatus = {
  id: string;
  content: string;
  attachment: { type: 'EVENT' | 'TICKET' | 'CERTIFICATE'; title: string } | null;
  author: { id: string; fullName: string; username: string; avatar: string };
  /** Community name when the author posted on behalf of a community. */
  postedAsCommunity?: string;
  reportCount: number;
  reasons: string[];
  hidden: boolean;
  createdAt: string;
  expiresAt: string;
  lastReportedAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload;
}

async function getStatusReports() {
  const { statuses } = await request<{ statuses?: ReportedStatus[] }>('/api/admin/content/reports');
  return statuses ?? [];
}

async function moderateStatusReport(id: string, action: 'remove' | 'dismiss', note: string) {
  return request<{ ok: boolean }>(`/api/admin/content/status/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function StatusReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [queue, setQueue] = useState<ReportedStatus[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');

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
        setQueue(await getStatusReports());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load status reports');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function decide(id: string, action: 'remove' | 'dismiss') {
    setBusyId(id);
    setError('');
    try {
      await moderateStatusReport(id, action, notes[id] ?? '');
      setQueue((list) => list.filter((item) => item.id !== id));
      setNotice(action === 'remove' ? 'Status removed.' : 'Reports dismissed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status');
    } finally {
      setBusyId('');
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-slate-500 dark:text-slate-400 shadow-sm"><Loading /></div>;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Status reports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Reported status stories. Statuses expire after 24 hours, so expired ones drop out of this queue.</p>
      </header>

      {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</div> : null}

      {queue.length ? (
        <div className="space-y-3">
          {queue.map((item) => {
            const avatar = item.author.avatar
              ? item.author.avatar.startsWith('/') ? `${API_BASE}${item.author.avatar}` : item.author.avatar
              : '';

            return (
              <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"><Flag className="h-3 w-3" /> {item.reportCount} report{item.reportCount === 1 ? '' : 's'}</span>
                      {item.attachment ? <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{item.attachment.type}: {item.attachment.title}</span> : null}
                      {item.hidden ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">Already hidden</span> : null}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      {avatar ? <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.author.fullName.slice(0, 1).toUpperCase()}</span>}
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.author.fullName}{item.author.username ? <span className="font-normal text-slate-500 dark:text-slate-400"> @{item.author.username}</span> : null}{item.postedAsCommunity ? <span className="font-normal text-slate-500 dark:text-slate-400"> · posted as {item.postedAsCommunity}</span> : null}</p>
                    </div>

                    <p className="mt-3 whitespace-pre-line break-words text-sm text-slate-800 dark:text-slate-200">{item.content}</p>

                    {item.reasons.length ? (
                      <ul className="mt-3 space-y-1">
                        {item.reasons.map((reason, index) => <li key={index} className="text-xs text-slate-500 dark:text-slate-400">“{reason}”</li>)}
                      </ul>
                    ) : null}

                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Posted {formatDateTime(item.createdAt)} · expires {formatDateTime(item.expiresAt)} · last reported {formatDateTime(item.lastReportedAt)}</p>
                  </div>

                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-56">
                    <input
                      value={notes[item.id] ?? ''}
                      onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                      maxLength={300}
                      placeholder="Reason (optional)"
                      aria-label="Moderation note"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 focus:border-indigo-300"
                    />
                    <div className="flex gap-2">
                      <button disabled={busyId === item.id} onClick={() => void decide(item.id, 'remove')} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">Remove</button>
                      <button disabled={busyId === item.id} onClick={() => void decide(item.id, 'dismiss')} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 disabled:opacity-50">Dismiss</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-sm text-slate-500 dark:text-slate-400">No reported statuses awaiting review.</p>
      )}
    </div>
  );
}