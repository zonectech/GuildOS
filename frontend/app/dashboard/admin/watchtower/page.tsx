'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, ShieldAlert, Building2, HeartHandshake, UsersRound, Award, Briefcase, ArrowRight, Check, X, Clock } from 'lucide-react';

import { SectionHeader } from '../../../../components/guildos/ui/section-header';
import {
  ACTION_LABEL,
  dismissWatchAlert,
  getWatchtower,
  runWatchAction,
  snoozeWatchAlert,
  type WatchAlert,
  type WatchSeverity,
  type WatchType,
  type WatchtowerResponse,
} from '../../../../components/guildos/admin-watchtower-api';
import { confirmDialog } from '../../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../../components/guildos/ui/loading';

const severityTone: Record<WatchSeverity, string> = {
  HIGH: 'bg-rose-50 text-rose-700 ring-rose-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-200',
  LOW: 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 ring-slate-200 dark:ring-slate-800',
};

function typeIcon(type: WatchType) {
  switch (type) {
    case 'COMMUNITY':
      return <Building2 className="h-4 w-4" />;
    case 'ENDORSEMENT':
      return <HeartHandshake className="h-4 w-4" />;
    case 'MEMBERSHIP':
      return <UsersRound className="h-4 w-4" />;
    case 'CERTIFICATE':
      return <Award className="h-4 w-4" />;
    case 'OPPORTUNITY':
      return <Briefcase className="h-4 w-4" />;
    default:
      return <ShieldAlert className="h-4 w-4" />;
  }
}

export default function WatchtowerPage() {
  const [data, setData] = useState<WatchtowerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<WatchSeverity | 'ALL'>('ALL');
  const [busy, setBusy] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');
      setData(await getWatchtower());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load watchtower');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const alerts: WatchAlert[] = data?.alerts ?? [];
  const filtered = filter === 'ALL' ? alerts : alerts.filter((a) => a.severity === filter);

  function removeLocal(id: string) {
    setData((d) => (d ? { ...d, alerts: d.alerts.filter((a) => a.id !== id) } : d));
  }

  async function onDismiss(alert: WatchAlert) {
    try {
      setBusy(alert.id);
      await dismissWatchAlert(alert.id);
      removeLocal(alert.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to dismiss');
    } finally {
      setBusy('');
    }
  }

  async function onSnooze(alert: WatchAlert) {
    try {
      setBusy(alert.id);
      await snoozeWatchAlert(alert.id, 7);
      removeLocal(alert.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to snooze');
    } finally {
      setBusy('');
    }
  }

  async function onAction(alert: WatchAlert, action: WatchAlert['actions'][number]) {
    const destructive = action === 'REJECT_COMMUNITY' || action === 'ARCHIVE_OPPORTUNITY';
    if (destructive && !(await confirmDialog({ title: `${ACTION_LABEL[action]} "${alert.entityLabel}"?`, confirmLabel: ACTION_LABEL[action], tone: 'danger' }))) return;
    try {
      setBusy(alert.id);
      await runWatchAction({ action, entityId: alert.entityId, alertKey: alert.id });
      removeLocal(alert.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy('');
    }
  }

  const cards = [
    { label: 'High risk', value: data?.summary.high ?? 0, tone: 'text-rose-600', key: 'HIGH' as const },
    { label: 'Medium', value: data?.summary.medium ?? 0, tone: 'text-amber-600', key: 'MEDIUM' as const },
    { label: 'Low', value: data?.summary.low ?? 0, tone: 'text-slate-600 dark:text-slate-400', key: 'LOW' as const },
    { label: 'Open signals', value: data?.summary.total ?? 0, tone: 'text-slate-900 dark:text-slate-100', key: 'ALL' as const },
  ];

  return (
    <>
      <SectionHeader
        eyebrow="Trust & Safety"
        title="Watchtower"
        subtitle="Automated risk monitoring across communities, endorsements, memberships, certificates, and opportunities."
        action={
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />

      {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => setFilter(c.key)}
            className={`rounded-2xl border bg-white dark:bg-slate-900 p-5 text-left shadow-sm transition hover:border-slate-300 dark:hover:border-slate-600 ${filter === c.key ? 'border-slate-900' : 'border-slate-200 dark:border-slate-800'}`}
          >
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{c.label}</p>
            <p className={`mt-1 text-2xl font-semibold tracking-tight ${c.tone}`}>{c.value}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 shadow-sm">
          <LogoSpinner />
        </div>
      ) : filtered.length ? (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${severityTone[alert.severity]}`}>
                    {typeIcon(alert.type)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{alert.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ring-1 ring-inset ${severityTone[alert.severity]}`}>{alert.severity}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{alert.detail}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {alert.signals.map((s) => (
                        <span key={s} className="rounded-full bg-slate-100 dark:bg-slate-950 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <Link
                  href={alert.link}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Review <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {alert.actions.map((action) => {
                  const destructive = action === 'REJECT_COMMUNITY' || action === 'ARCHIVE_OPPORTUNITY';
                  return (
                    <button
                      key={action}
                      onClick={() => void onAction(alert, action)}
                      disabled={busy === alert.id}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                        destructive ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {action === 'VERIFY_COMMUNITY' ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      {ACTION_LABEL[action]}
                    </button>
                  );
                })}
                <button
                  onClick={() => void onSnooze(alert)}
                  disabled={busy === alert.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                >
                  <Clock className="h-3.5 w-3.5" /> Snooze 7d
                </button>
                <button
                  onClick={() => void onDismiss(alert)}
                  disabled={busy === alert.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">All clear</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No risk signals{filter !== 'ALL' ? ` at ${filter.toLowerCase()} severity` : ''} right now.</p>
        </div>
      )}
    </>
  );
}
