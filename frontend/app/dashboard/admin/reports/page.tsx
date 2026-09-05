'use client';

import { LogoSpinner } from '../../../../components/guildos/ui/loading';

import { useEffect, useState } from 'react';
import { Loader2, Users, Building2, CalendarDays, Award, Briefcase, CheckCircle2, Download, Activity } from 'lucide-react';

import { ReportsChartCard } from '../../../../components/guildos/reports-chart-card';
import { ReportsSparkline } from '../../../../components/guildos/reports-sparkline';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';
import { getPlatformAnalytics, type PlatformAnalytics } from '../../../../components/guildos/admin-api';

export default function ReportsPage() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { analytics } = await getPlatformAnalytics(8);
        if (!cancelled) {
          setData(analytics);
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load analytics');
          setStatus('ready');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 shadow-sm">
        <LogoSpinner />
      </div>
    );
  }

  const totals = data?.totals;
  const totalCards = [
    { label: 'Total users', value: totals?.users ?? 0, icon: <Users className="h-5 w-5" /> },
    { label: 'Active (7 days)', value: totals?.activeUsers7d ?? 0, icon: <Activity className="h-5 w-5" /> },
    { label: 'Active (30 days)', value: totals?.activeUsers30d ?? 0, icon: <Activity className="h-5 w-5" /> },
    { label: 'Communities', value: totals?.communities ?? 0, icon: <Building2 className="h-5 w-5" /> },
    { label: 'Events', value: totals?.events ?? 0, icon: <CalendarDays className="h-5 w-5" /> },
    { label: 'Certificates', value: totals?.certificates ?? 0, icon: <Award className="h-5 w-5" /> },
    { label: 'Opportunities', value: totals?.opportunities ?? 0, icon: <Briefcase className="h-5 w-5" /> },
    { label: 'Total check-ins', value: totals?.checkIns ?? 0, icon: <CheckCircle2 className="h-5 w-5" /> },
  ];

  const range = data?.labels.length ? `${data.labels[0]} – ${data.labels[data.labels.length - 1]}` : 'last 8 months';

  function exportCsv() {
    if (!data) return;
    const s = data.series;
    const rows = [
      ['Month', 'Attendance', 'Events', 'Memberships', 'Certificates'],
      ...data.labels.map((label, i) => [label, s.attendance[i] ?? 0, s.events[i] ?? 0, s.memberships[i] ?? 0, s.certificates[i] ?? 0]),
      [],
      ['Totals'],
      ['Users', totals?.users ?? 0],
      ['Active (7 days)', totals?.activeUsers7d ?? 0],
      ['Active (30 days)', totals?.activeUsers30d ?? 0],
      ['Communities', totals?.communities ?? 0],
      ['Events', totals?.events ?? 0],
      ['Certificates', totals?.certificates ?? 0],
      ['Opportunities', totals?.opportunities ?? 0],
      ['Check-ins', totals?.checkIns ?? 0],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guildos-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <SectionHeader
        eyebrow="Reports"
        title="Analytics & Reports"
        subtitle={`Platform-wide activity across attendance, events, membership, and certificates (${range}).`}
        action={
          <button onClick={exportCsv} disabled={!data} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {totalCards.map((c) => (
          <div key={c.label} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{c.value.toLocaleString('en-NG')}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30">{c.icon}</div>
          </div>
        ))}
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <ReportsChartCard title="Attendance Trends" subtitle={`Event check-ins per month · ${range}`}>
          <ReportsSparkline values={data?.series.attendance ?? []} />
        </ReportsChartCard>

        <ReportsChartCard title="Event Growth" subtitle={`Events created per month · ${range}`}>
          <ReportsSparkline values={data?.series.events ?? []} />
        </ReportsChartCard>

        <ReportsChartCard title="Membership Growth" subtitle={`New memberships per month · ${range}`}>
          <ReportsSparkline values={data?.series.memberships ?? []} />
        </ReportsChartCard>

        <ReportsChartCard title="Certificate Issuance" subtitle={`Certificates issued per month · ${range}`}>
          <ReportsSparkline values={data?.series.certificates ?? []} />
        </ReportsChartCard>
      </section>
    </>
  );
}