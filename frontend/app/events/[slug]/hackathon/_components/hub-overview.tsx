'use client';

import { ArrowLeft, CalendarClock, Gavel, Settings, Trophy, Users } from 'lucide-react';

import { resolveEventImageUrl } from '../../../../../components/guildos/api/event-api';
import type { HackathonHub } from '../../../../../components/guildos/api/hackathon-api';
import { CARD, formatWhen } from '../../../../../components/guildos/hackathon/hackathon-ui';

export function HubOverview({ hub }: { hub: HackathonHub }) {
  const { event, settings } = hub;
  const banner = resolveEventImageUrl(event.bannerImage);
  const teamSize = settings.teamSizeMin === settings.teamSizeMax ? `${settings.teamSizeMax}` : `${settings.teamSizeMin}–${settings.teamSizeMax}`;

  return (
    <div className="space-y-5">
      <a href={`/events/${event.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Event details
      </a>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {banner ? (
          <img src={banner} alt="" className="aspect-[4/1] w-full object-cover" />
        ) : (
          <div className="aspect-[4/1] w-full bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500" />
        )}
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Hackathon</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">{event.title}</h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> {hub.teamCount} teams · {hub.submissions.length} projects</span>
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> Teams of {teamSize}</span>
              {settings.judgeCount > 0 && <span className="inline-flex items-center gap-1.5"><Gavel className="h-4 w-4" /> {settings.judgeCount} judges</span>}
            </div>
          </div>
          {hub.viewer.canManage && (
            <a href={`/dashboard/events/hackathon?event=${event.id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <Settings className="h-4 w-4" /> Manage hackathon
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className={CARD}>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <CalendarClock className="h-4 w-4" /> Timeline
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Submissions open</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">{formatWhen(settings.submissionOpensAt) || 'Now'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Deadline</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">{formatWhen(settings.submissionDeadline) || 'Set by organizers'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Results</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">{settings.resultsPublishedAt ? `Published ${formatWhen(settings.resultsPublishedAt)}` : 'After judging'}</dd>
            </div>
          </dl>
          {!settings.submissionsOpen && !settings.resultsPublishedAt && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{settings.submissionsClosedReason}</p>
          )}
        </div>

        <div className={CARD}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">How projects are judged</h2>
          <ul className="mt-3 space-y-2">
            {settings.criteria.map((c) => (
              <li key={c.key} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{c.name}</span>
                  <span className="text-slate-500 dark:text-slate-400">{c.weight}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, c.weight)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {settings.tracks.length > 0 && (
        <div className={CARD}>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Trophy className="h-4 w-4" /> Prize tracks
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {settings.tracks.map((t) => (
              <div key={t.key} className="rounded-lg border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-500/20 dark:bg-violet-500/10">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{t.name}</p>
                {t.prize && <p className="mt-0.5 text-sm font-semibold text-violet-700 dark:text-violet-300">{t.prize}</p>}
                {t.description && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
