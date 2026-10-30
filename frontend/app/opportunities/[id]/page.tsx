'use client';

import { toast } from '../../../components/guildos/ui/toast';
import { promptDialog } from '../../../components/guildos/ui/confirm-dialog';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Flag } from 'lucide-react';

import { StudentNav } from '../../../components/guildos/student-nav';

import {
  getOpportunity,
  matchTier,
  OPPORTUNITY_CATEGORY_LABELS,
  reportOpportunity,
  setOpportunityAction,
  type Opportunity,
  type OpportunityAction,
} from '../../../components/guildos/api/opportunity-api';
import { getPublicRecruiter, type PublicRecruiter } from '../../../components/guildos/api/recruiter-api';

const ACTIONS: { value: OpportunityAction; label: string; done: string }[] = [
  { value: 'SAVED', label: 'Save', done: 'Saved' },
  { value: 'INTERESTED', label: 'Interested', done: 'Interested' },
  { value: 'APPLIED', label: 'I already applied', done: 'Applied' },
];

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav active="/opportunities" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"><ArrowLeft className="h-4 w-4" /> All jobs</Link>
        {children}
      </main>
    </div>
  );
}

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [recruiter, setRecruiter] = useState<PublicRecruiter | null>(null);
  const [error, setError] = useState('');
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const { opportunity } = await getOpportunity(id);
        if (!cancelled) setOpp(opportunity);
        const postedBy = (opportunity as Opportunity & { postedBy?: string | null }).postedBy;
        if (postedBy && !cancelled) {
          try {
            const { recruiter: rec } = await getPublicRecruiter(postedBy);
            if (!cancelled) setRecruiter(rec);
          } catch {
            /* recruiter trust is optional */
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Opportunity not found');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function act(action: OpportunityAction) {
    if (!opp) return;
    try {
      await setOpportunityAction(opp.id, action);
      setOpp({ ...opp, action });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update');
    }
  }

  async function report() {
    if (!opp || reported) return;
    const reason = await promptDialog({ title: 'Report this listing', message: 'What looks wrong? (e.g. scam, fake company, asks for payment)', placeholder: 'Reason (optional)', confirmLabel: 'Report' });
    if (reason === null) return;
    try {
      await reportOpportunity(opp.id, reason.trim());
      setReported(true);
      toast.success('Thanks for reporting', 'Our team will review this listing.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to report');
    }
  }

  if (error) {
    return <Page><div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div></Page>;
  }
  if (!opp) {
    return <Page><div className="h-48 animate-pulse rounded-xl bg-white dark:bg-slate-900" /></Page>;
  }

  const tier = matchTier(opp.matchScore);

  return (
    <Page>
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">{OPPORTUNITY_CATEGORY_LABELS[opp.category]}</span>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">{opp.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{[opp.organization, opp.location].filter(Boolean).join(' · ')}</p>
      </div>

      {opp.matchScore !== null ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`rounded-full px-3 py-1 text-sm font-semibold ${tier.tone}`}>{opp.matchScore}% · {tier.label}</div>
          </div>
          {opp.matchReason ? <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{opp.matchReason}</p> : null}
          {opp.reasons.length ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Why am I seeing this?</p>
              <ul className="mt-2 space-y-1">
                {opp.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"><span className="mt-0.5 text-emerald-600">✓</span><span>{r.charAt(0).toUpperCase() + r.slice(1)}</span></li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {recruiter && recruiter.company ? (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Posted by</h2>
              <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{recruiter.company}{recruiter.verified ? <span className="ml-2 align-middle text-xs font-medium text-sky-600">✓ Verified</span> : null}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{recruiter.successfulHires} successful hire(s) · {recruiter.responseRate}% response rate{recruiter.activeSince ? ` · since ${new Date(recruiter.activeSince).getFullYear()}` : ''}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${recruiter.tier === 'Top Campus Employer' ? 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300' : recruiter.tier === 'Trusted Employer' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : recruiter.tier === 'Verified Recruiter' ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400'}`}>{recruiter.tier}</span>
          </div>
        </section>
      ) : null}

      {opp.description ? (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">About</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{opp.description}</p>
          {opp.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {opp.tags.map((t) => <span key={t} className="rounded-full bg-slate-100 dark:bg-slate-950 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">{t}</span>)}
            </div>
          ) : null}
          {opp.deadline ? <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Deadline {new Date(opp.deadline).toLocaleDateString('en-NG')}</p> : null}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {opp.action === 'APPLIED' ? (
          <span className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">✓ You applied. We&apos;ll let you know if they shortlist you.</span>
        ) : (
          <>
            {opp.applicationUrl ? (
              <a href={opp.applicationUrl} target="_blank" rel="noreferrer" onClick={() => void act('APPLIED')} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900">Apply now</a>
            ) : null}
            {ACTIONS.map((a) => (
              <button key={a.value} onClick={() => void act(a.value)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${opp.action === a.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                {opp.action === a.value ? `✓ ${a.done}` : a.label}
              </button>
            ))}
          </>
        )}
        <button onClick={() => void report()} disabled={reported} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-slate-400 dark:text-slate-500 hover:text-rose-600 disabled:text-emerald-600">
          {reported ? 'Reported ✓' : <><Flag className="h-3.5 w-3.5" /> Report listing</>}
        </button>
      </div>
    </Page>
  );
}
