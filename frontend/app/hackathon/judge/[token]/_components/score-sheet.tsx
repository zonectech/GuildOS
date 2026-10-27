'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';

import { scoreHackathonSubmission, type HackathonCriterion, type HackathonTrack, type JudgeSubmission } from '../../../../../components/guildos/hackathon-api';
import { CARD, INPUT, PRIMARY_BUTTON, ProjectDetails } from '../../../../../components/guildos/hackathon/hackathon-ui';

const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** One project: its write-up plus this judge's 1–10 score per criterion. */
export function ScoreSheet({
  token, submission, criteria, tracks, locked, onSaved,
}: {
  token: string;
  submission: JudgeSubmission;
  criteria: HackathonCriterion[];
  tracks: HackathonTrack[];
  locked: boolean;
  onSaved: (submissionId: string, scores: Record<string, number>, comment: string) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(submission.myScores ?? {});
  const [comment, setComment] = useState(submission.myComment);
  // Locked sheets start closed: after results there's nothing left to score.
  const [open, setOpen] = useState(!submission.myScores && !locked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const complete = criteria.every((c) => typeof scores[c.key] === 'number');
  const scored = Boolean(submission.myScores);

  async function save() {
    try {
      setBusy(true);
      setError('');
      const result = await scoreHackathonSubmission(token, submission.id, { scores, comment });
      onSaved(submission.id, result.scores, result.comment);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save scores');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={CARD}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{submission.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{submission.teamName} · {submission.memberCount} {submission.memberCount === 1 ? 'builder' : 'builders'}</p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {scored ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Scored</span>
          ) : locked ? (
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Not scored</span>
          ) : null}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          <ProjectDetails submission={submission} tracks={tracks} />
          <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            {criteria.map((c) => (
              <div key={c.key}>
                <p className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{c.name}</span>
                  <span className="text-xs text-slate-400">weight {c.weight}</span>
                </p>
                <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={c.name}>
                  {SCALE.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={scores[c.key] === n}
                      disabled={locked}
                      onClick={() => { setScores((s) => ({ ...s, [c.key]: n })); setDirty(true); }}
                      className={`h-9 w-9 rounded-lg border text-sm font-semibold transition disabled:opacity-60 ${scores[c.key] === n ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:text-slate-300'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Private note (optional, only organizers see it)
              <textarea disabled={locked} className={`mt-1 min-h-16 ${INPUT}`} maxLength={1000} value={comment} onChange={(e) => { setComment(e.target.value); setDirty(true); }} />
            </label>
            {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
            {!locked && (
              <button onClick={() => void save()} disabled={busy || !complete || (!dirty && scored)} className={PRIMARY_BUTTON}>
                {busy ? 'Saving…' : scored ? (dirty ? 'Update scores' : 'Saved') : complete ? 'Save scores' : 'Score every criterion'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
