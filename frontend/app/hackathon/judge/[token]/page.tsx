'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Gavel } from 'lucide-react';

import { LogoSpinner } from '../../../../components/guildos/ui/loading';
import { getJudgeView, type JudgeView } from '../../../../components/guildos/hackathon-api';
import { ErrorBanner } from '../../../../components/guildos/hackathon/hackathon-ui';
import { ScoreSheet } from './_components/score-sheet';

/** A judge's private scoring page — the link is the credential, no GuildOS account needed. */
export default function JudgePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const [view, setView] = useState<JudgeView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    getJudgeView(token)
      .then(setView)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load the judging page'));
  }, [token]);

  function handleSaved(submissionId: string, scores: Record<string, number>, comment: string) {
    setView((v) => v && {
      ...v,
      submissions: v.submissions.map((s) => (s.id === submissionId ? { ...s, myScores: scores, myComment: comment } : s)),
    });
  }

  const scoredCount = view?.submissions.filter((s) => s.myScores).length ?? 0;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        {error ? (
          <ErrorBanner message={error} />
        ) : !view ? (
          <div className="grid place-items-center py-20"><LogoSpinner /></div>
        ) : (
          <>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400"><Gavel className="h-3.5 w-3.5" /> Judging</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">{view.event.title}</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Welcome, {view.judge.name}. Score each project 1–10 on every criterion — you can change scores until results are published.
              </p>
              <div className="mt-4">
                <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Your progress</span>
                  <span>{scoredCount}/{view.submissions.length} scored</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${view.submissions.length ? (scoredCount / view.submissions.length) * 100 : 0}%` }} />
                </div>
              </div>
              {view.resultsPublished && (
                <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                  Results are published — scores are final. <a className="underline" href={`/events/${view.event.slug}/hackathon`}>See the winners</a>.
                </p>
              )}
            </div>

            {view.submissions.length === 0 ? (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">No projects have been submitted yet — check back after the deadline.</p>
            ) : (
              view.submissions.map((s) => (
                <ScoreSheet key={s.id} token={token} submission={s} criteria={view.criteria} tracks={view.tracks} locked={view.resultsPublished} onSaved={handleSaved} />
              ))
            )}
          </>
        )}
      </main>
    </div>
  );
}
