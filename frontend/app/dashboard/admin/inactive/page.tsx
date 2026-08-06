'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, Archive, Users2, CalendarX, Building2, RotateCcw } from 'lucide-react';

import { getCurrentUser } from '../../../../components/guildos/auth-api';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';
import {
  getInactiveEntities,
  unblockUser,
  restoreUser,
  type InactiveEntities,
} from '../../../../components/guildos/admin-api';

const REASON_TONE: Record<string, string> = {
  REJECTED: 'bg-rose-50 text-rose-700',
  ARCHIVED: 'bg-amber-50 text-amber-700',
  DELETED: 'bg-slate-200 text-slate-700 dark:text-slate-300',
  BLOCKED: 'bg-orange-50 text-orange-700',
};

function ReasonBadge({ reason }: { reason: string }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${REASON_TONE[reason] ?? 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400'}`}>{reason}</span>;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
}

export default function AdminInactivePage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'denied' | 'ready'>('loading');
  const [data, setData] = useState<InactiveEntities | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  async function load() {
    try {
      setError('');
      const entities = await getInactiveEntities();
      setData(entities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inactive items');
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      if (user.role !== 'ADMIN') {
        setStatus('denied');
        return;
      }
      await load();
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleUserAction(id: string, reason: 'BLOCKED' | 'DELETED', fullName: string) {
    try {
      setBusyId(id);
      setError('');
      setNotice('');
      if (reason === 'BLOCKED') {
        await unblockUser(id);
        setNotice(`${fullName} has been unblocked and can sign in again.`);
      } else {
        await restoreUser(id);
        setNotice(`${fullName} has been restored.`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId('');
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500 dark:text-slate-400" />
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-3 text-lg font-semibold text-amber-900">Admins only</h2>
        <p className="mt-1 text-sm text-amber-800">This audit view is restricted to administrators.</p>
        <Link href="/home" className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Back to Student Home</Link>
      </div>
    );
  }

  const communities = data?.communities ?? [];
  const events = data?.events ?? [];
  const users = data?.users ?? [];
  const total = communities.length + events.length + users.length;

  return (
    <>
      <SectionHeader
        eyebrow="Admin Console"
        title="Inactive & Removed"
        subtitle="Communities, events, and accounts that have been rejected, archived, blocked, or deleted. These are hidden from all normal users."
        action={<Link href="/dashboard/admin" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">← Admin Console</Link>}
      />

      {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div> : null}

      {total === 0 ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-sm">
          <Archive className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Nothing here. No inactive communities, events, or accounts.</p>
        </div>
      ) : null}

      {/* Communities */}
      {communities.length ? (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
            <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Communities</h2>
            <span className="rounded-full bg-slate-100 dark:bg-slate-950 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">{communities.length}</span>
          </header>
          <ul className="divide-y divide-slate-100">
            {communities.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                    <ReasonBadge reason={c.reason} />
                  </div>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{c.university || '—'}{c.note ? ` · ${c.note}` : ''} · {formatDate(c.updatedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Events */}
      {events.length ? (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
            <CalendarX className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Events</h2>
            <span className="rounded-full bg-slate-100 dark:bg-slate-950 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">{events.length}</span>
          </header>
          <ul className="divide-y divide-slate-100">
            {events.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{e.title}</p>
                    <ReasonBadge reason={e.reason} />
                  </div>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{e.community || '—'} · {formatDate(e.updatedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Users */}
      {users.length ? (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
            <Users2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Accounts</h2>
            <span className="rounded-full bg-slate-100 dark:bg-slate-950 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">{users.length}</span>
          </header>
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{u.fullName}</p>
                    <ReasonBadge reason={u.reason} />
                  </div>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{u.email}{u.username ? ` · @${u.username}` : ''}{u.note ? ` · ${u.note}` : ''} · {formatDate(u.updatedAt)}</p>
                </div>
                <button
                  onClick={() => void handleUserAction(u.id, u.reason, u.fullName)}
                  disabled={busyId === u.id}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                >
                  {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  {u.reason === 'BLOCKED' ? 'Unblock' : 'Restore'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
