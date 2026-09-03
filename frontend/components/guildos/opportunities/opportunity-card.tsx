'use client';

import Link from 'next/link';
import {
  matchTier,
  OPPORTUNITY_CATEGORY_LABELS,
  setOpportunityAction,
  type Opportunity,
  type OpportunityAction,
} from '../opportunity-api';

function deadlineLabel(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const date = d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });
  if (days < 0) return `Closed · ${date}`;
  if (days <= 14) return `${days} day${days === 1 ? '' : 's'} left · ${date}`;
  return `Deadline ${date}`;
}

const ACTIONS: { value: OpportunityAction; label: string }[] = [
  { value: 'SAVED', label: 'Save' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'NOT_RELEVANT', label: 'Not relevant' },
];

export function OpportunityCard({ opp, onActioned }: { opp: Opportunity; onActioned?: (action: OpportunityAction) => void }) {
  const tier = matchTier(opp.matchScore);
  const deadline = deadlineLabel(opp.deadline);

  async function act(action: OpportunityAction) {
    try {
      await setOpportunityAction(opp.id, action);
      onActioned?.(action);
    } catch {
      /* surfaced by parent if needed */
    }
  }

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">{OPPORTUNITY_CATEGORY_LABELS[opp.category]}</span>
          <Link href={`/opportunities/${opp.id}`} className="block truncate text-base font-semibold text-slate-950 dark:text-white hover:underline">{opp.title}</Link>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {[opp.organization, opp.location].filter(Boolean).join(' · ')}
            {opp.recruiterVerified ? <span className="ml-1 align-middle text-xs font-medium text-sky-600">✓ Verified recruiter</span> : null}
          </p>
        </div>
        {opp.matchScore !== null ? (
          <div className="shrink-0 text-right">
            <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tier.tone}`}>{opp.matchScore}%</div>
            <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">{tier.label}</p>
          </div>
        ) : null}
      </div>

      {opp.matchReason ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{opp.matchReason}</p>
      ) : opp.reasons.length ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Why: {opp.reasons.slice(0, 2).join('; ')}.</p>
      ) : null}

      {opp.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {opp.tags.slice(0, 5).map((t) => <span key={t} className="rounded-full bg-slate-100 dark:bg-slate-950 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">{t}</span>)}
        </div>
      ) : null}

      <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
        {deadline ? <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{deadline}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          {opp.applicationUrl ? (
            <a href={opp.applicationUrl} target="_blank" rel="noreferrer" onClick={() => void act('APPLIED')} className="rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Apply</a>
          ) : null}
          {ACTIONS.map((a) => (
            <button
              key={a.value}
              onClick={() => void act(a.value)}
              className={`rounded-xl border px-2.5 py-1.5 text-xs font-medium ${opp.action === a.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              {opp.action === a.value ? `✓ ${a.label}` : a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
