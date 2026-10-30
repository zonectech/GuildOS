'use client';

import { useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

import { createCommunityEndorsement, getCommunityEndorsements, type CommunityEndorsement } from '../../../../components/guildos/api/community-list-api';
import { MemberAvatar } from './leader-ui';

/**
 * Endorsement records + the endorse form. Hidden entirely unless there is something to
 * show (records exist, viewer already endorsed, or viewer qualifies to endorse).
 */
export function EndorsementsCard({
  communityId,
  endorsements,
  canEndorse,
  alreadyEndorsed,
  onEndorsed,
}: {
  communityId: string;
  endorsements: CommunityEndorsement[];
  /** Server-confirmed eligibility, already excluding founders, archived and non-pending communities. */
  canEndorse: boolean;
  alreadyEndorsed: boolean;
  onEndorsed: (refreshed: CommunityEndorsement[]) => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleEndorse() {
    try {
      setBusy(true);
      setError('');
      await createCommunityEndorsement(communityId, note.trim());
      const { endorsements: refreshed } = await getCommunityEndorsements(communityId);
      onEndorsed(refreshed);
      setNote('');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit endorsement');
    } finally {
      setBusy(false);
    }
  }

  if (!(endorsements.length > 0 || canEndorse || alreadyEndorsed || done)) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-white">
        <ShieldCheck className="h-4 w-4 text-emerald-500" /> Endorsements
        {endorsements.length > 0 && (
          <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            {endorsements.length}
          </span>
        )}
      </h2>
      {endorsements.length > 0 ? (
        <div className="mt-4 space-y-3">
          {endorsements.map((entry) => (
            <div key={entry.endorsement._id} className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-4">
              <div className="flex items-center gap-3">
                <MemberAvatar fullName={entry.user.fullName} avatar={entry.user.profile?.avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.user.fullName}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(entry.endorsement.createdAt).toLocaleDateString('en-NG')}</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">Verified leader</span>
              </div>
              {entry.endorsement.note && (
                <p className="mt-3 border-l-2 border-emerald-200 dark:border-emerald-500/40 pl-3 text-sm italic leading-relaxed text-slate-600 dark:text-slate-400">"{entry.endorsement.note}"</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No endorsements recorded yet.</p>
      )}

      {canEndorse && !done && (
        <div className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Endorse this community</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">You're a verified leader at the same university. Two endorsements automatically grant verified status.</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Why do you endorse this community? (optional)"
            className="mt-3 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
          <button onClick={() => void handleEndorse()} disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Submitting…' : <><CheckCircle2 className="h-4 w-4" /> Submit endorsement</>}
          </button>
        </div>
      )}
      {(alreadyEndorsed || done) && (
        <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> You have endorsed this community.
        </p>
      )}
    </div>
  );
}
