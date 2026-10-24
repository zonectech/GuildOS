'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import { DashboardShell } from '../../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../../components/guildos/dashboard-topbar';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';
import { LogoSpinner } from '../../../../components/guildos/ui/loading';
import { getHackathonManage, type HackathonManage } from '../../../../components/guildos/hackathon-api';
import { ErrorBanner } from '../../../../components/guildos/hackathon/hackathon-ui';
import { SettingsCard } from './_components/settings-card';
import { JudgesCard } from './_components/judges-card';
import { ResultsCard } from './_components/results-card';
import { TeamsCard } from './_components/teams-card';

export default function HackathonDashboardPage() {
  return (
    <Suspense fallback={null}>
      <HackathonDashboardInner />
    </Suspense>
  );
}

function HackathonDashboardInner() {
  const params = useSearchParams();
  const eventId = params.get('event') ?? '';
  const [data, setData] = useState<HackathonManage | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    setData(await getHackathonManage(eventId));
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setLoadError('No hackathon selected. Open it from your Events dashboard.');
      return;
    }
    reload().catch((err) => setLoadError(err instanceof Error ? err.message : 'Unable to load the hackathon'));
  }, [eventId, reload]);

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <a href="/dashboard/events" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to events
      </a>
      {loadError ? (
        <ErrorBanner message={loadError} />
      ) : !data ? (
        <div className="grid place-items-center py-20"><LogoSpinner /></div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="Hackathon" title={data.event.title} subtitle="Teams, judging and results." />
            <a href={`/events/${data.event.slug}/hackathon`} target="_blank" rel="noopener noreferrer" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline">
              Public hackathon page <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <ErrorBanner message={error} />
          {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</div>}

          {/* Keyed on publish so the winner picker and settings re-seed after results go out. */}
          <ResultsCard key={data.settings.resultsPublishedAt ?? 'draft'} data={data} onChanged={reload} onError={setError} onNotice={setNotice} />
          <div className="grid gap-5 lg:grid-cols-2">
            <JudgesCard eventId={data.event.id} judges={data.judges} submissionCount={data.submissions.length} locked={Boolean(data.settings.resultsPublishedAt)} onChanged={reload} onError={setError} />
            <TeamsCard teams={data.teams} minSize={data.settings.teamSizeMin} />
          </div>
          <SettingsCard key={`settings-${data.settings.resultsPublishedAt ?? 'draft'}`} eventId={data.event.id} settings={data.settings} onSaved={reload} onError={setError} />
        </div>
      )}
    </DashboardShell>
  );
}
