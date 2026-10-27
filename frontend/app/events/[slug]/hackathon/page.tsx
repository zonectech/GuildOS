'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { StudentNav } from '../../../../components/guildos/student-nav';
import { LogoSpinner } from '../../../../components/guildos/ui/loading';
import { getCurrentUser } from '../../../../components/guildos/auth-api';
import { getHackathonHub, type HackathonHub } from '../../../../components/guildos/hackathon-api';
import { ErrorBanner } from '../../../../components/guildos/hackathon/hackathon-ui';
import { HubOverview } from './_components/hub-overview';
import { TeamPanel } from './_components/team-panel';
import { SubmissionForm } from './_components/submission-form';
import { ProjectGallery } from './_components/project-gallery';

export default function HackathonHubPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const [hub, setHub] = useState<HackathonHub | null>(null);
  const [userId, setUserId] = useState('');
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');

  const reload = useCallback(async () => {
    setHub(await getHackathonHub(slug));
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      try {
        const user = await getCurrentUser().catch(() => null);
        setUserId(user?.id ?? '');
        await reload();
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Unable to load the hackathon');
      }
    })();
  }, [slug, reload]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav active="/events" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {loadError ? (
          <ErrorBanner message={loadError} />
        ) : !hub ? (
          <div className="grid place-items-center py-20"><LogoSpinner /></div>
        ) : (
          <>
            <HubOverview hub={hub} />
            <ErrorBanner message={actionError} />
            {/* Once results are out, the winners are the news; your (now locked) team and project follow. */}
            {hub.settings.resultsPublishedAt ? <ProjectGallery hub={hub} /> : null}
            <section id="project-submission" className="scroll-mt-24 space-y-6" aria-label="Team and project submission">
            <TeamPanel key={hub.viewer.team?.id ?? 'no-team'} hub={hub} userId={userId} onChanged={reload} onError={setActionError} />
            {hub.viewer.team && (
              hub.settings.resultsPublishedAt ? (
                <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Your project: {hub.viewer.submission?.title ?? 'not submitted'} <span className="font-normal text-slate-500 dark:text-slate-400">(submissions are closed, tap to view)</span>
                  </summary>
                  <div className="mt-4">
                    <SubmissionForm key={`${hub.viewer.team.id}:${hub.viewer.submission?.id ?? 'new'}`} hub={hub} onSaved={reload} onError={setActionError} />
                  </div>
                </details>
              ) : (
                // Re-seed the form when the team (and so the project) changes.
                <SubmissionForm key={`${hub.viewer.team.id}:${hub.viewer.submission?.id ?? 'new'}`} hub={hub} onSaved={reload} onError={setActionError} />
              )
            )}
            </section>
            {hub.settings.resultsPublishedAt ? null : <ProjectGallery hub={hub} />}
          </>
        )}
      </main>
    </div>
  );
}
