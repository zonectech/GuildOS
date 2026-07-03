'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, Users, Building2, CalendarDays, Award, Briefcase, CheckCircle2 } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { ReportsChartCard } from '../../../components/guildos/reports-chart-card';
import { ReportsSparkline } from '../../../components/guildos/reports-sparkline';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { getPlatformAnalytics, type PlatformAnalytics } from '../../../components/guildos/admin-api';

export default function ReportsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'denied' | 'ready'>('loading');
  const [data, setData] = useState<PlatformAnalytics | null>(null);
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
      if (user.role !== 'ADMIN') {
        setStatus('denied');
        return;
      }
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
  }, [router]);

  if (status === 'loading') {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-16 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </DashboardShell>
    );
  }

  if (status === 'denied') {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="mx-auto max-w-md rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
          <h2 className="mt-3 text-lg font-semibold text-amber-900">Admins only</h2>
          <p className="mt-1 text-sm text-amber-800">Reports &amp; analytics are available to platform administrators.</p>
          <Link href="/dashboard" className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Back to dashboard</Link>
        </div>
      </DashboardShell>
    );
  }

  const totals = data?.totals;
  const totalCards = [
    { label: 'Total users', value: totals?.users ?? 0, icon: <Users className="h-5 w-5" /> },
    { label: 'Communities', value: totals?.communities ?? 0, icon: <Building2 className="h-5 w-5" /> },
    { label: 'Events', value: totals?.events ?? 0, icon: <CalendarDays className="h-5 w-5" /> },
    { label: 'Certificates', value: totals?.certificates ?? 0, icon: <Award className="h-5 w-5" /> },
    { label: 'Opportunities', value: totals?.opportunities ?? 0, icon: <Briefcase className="h-5 w-5" /> },
    { label: 'Total check-ins', value: totals?.checkIns ?? 0, icon: <CheckCircle2 className="h-5 w-5" /> },
  ];

  const range = data?.labels.length ? `${data.labels[0]} – ${data.labels[data.labels.length - 1]}` : 'last 8 months';

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Reports"
        title="Analytics & Reports"
        subtitle={`Platform-wide activity across attendance, events, membership, and certificates (${range}).`}
      />

      {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {totalCards.map((c) => (
          <div key={c.label} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-sm font-medium text-slate-500">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{c.value.toLocaleString()}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">{c.icon}</div>
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
    </DashboardShell>
  );
}