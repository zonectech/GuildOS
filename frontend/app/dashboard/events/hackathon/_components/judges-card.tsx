'use client';

import { useState } from 'react';
import { BadgeCheck, Copy, Gavel, Trash2 } from 'lucide-react';

import { confirmDialog } from '../../../../../components/guildos/ui/confirm-dialog';
import { searchPeople, type PersonResult } from '../../../../../components/guildos/auth-api';
import { addHackathonJudge, removeHackathonJudge, type HackathonJudge } from '../../../../../components/guildos/hackathon-api';
import { CARD, INPUT, PRIMARY_BUTTON } from '../../../../../components/guildos/hackathon/hackathon-ui';

/** Judges score through private links; tagging a GuildOS account also notifies them in-app. */
export function JudgesCard({
  eventId, judges, submissionCount, locked, onChanged, onError,
}: {
  eventId: string;
  judges: HackathonJudge[];
  submissionCount: number;
  locked: boolean;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [linked, setLinked] = useState<PersonResult | null>(null);
  const [results, setResults] = useState<PersonResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  async function search(q: string) {
    setName(q);
    setLinked(null);
    if (q.trim().length < 2) return setResults([]);
    try {
      setResults((await searchPeople(q.trim())).people.slice(0, 5));
    } catch {
      /* typeahead is best-effort */
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true);
      onError('');
      await addHackathonJudge(eventId, { name, email, userId: linked?.id });
      setName('');
      setEmail('');
      setLinked(null);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to add judge');
    } finally {
      setBusy(false);
    }
  }

  async function copy(judge: HackathonJudge) {
    try {
      await navigator.clipboard.writeText(judge.link);
      setCopied(judge.id);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={CARD}>
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100"><Gavel className="h-4 w-4 text-indigo-500" /> Judges</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Each judge gets a private scoring link. No account needed. Anyone with a link can score as that judge, so share it only with them.</p>

      {!locked && (
        <form onSubmit={(e) => void add(e)} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <div className="relative">
            <input className={INPUT} placeholder="Judge name (or search GuildOS)" value={linked ? linked.fullName : name} onChange={(e) => void search(e.target.value)} />
            {results.length > 0 && !linked && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {results.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setLinked(p); setName(p.fullName); setResults([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    {p.fullName} {p.username && <span className="text-xs text-slate-400">@{p.username}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input className={INPUT} type="email" placeholder="Email (optional, we'll send the link)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" disabled={busy || !name.trim()} className={PRIMARY_BUTTON}>Add judge</button>
        </form>
      )}

      <ul className="mt-4 space-y-2">
        {judges.length === 0 && <li className="text-sm text-slate-500 dark:text-slate-400">No judges yet.</li>}
        {judges.map((j) => (
          <li key={j.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-950/60">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                {j.name} {j.hasAccount && <BadgeCheck className="h-3.5 w-3.5 text-sky-500" aria-label="Has a GuildOS account" />}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{j.email || 'No email'} · scored {j.scoredCount}/{submissionCount}</p>
            </div>
            <button onClick={() => void copy(j)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <Copy className="h-3 w-3" /> {copied === j.id ? 'Copied' : 'Copy link'}
            </button>
            {!locked && (
              <button
                aria-label="Remove judge"
                onClick={() => void (async () => {
                  const ok = await confirmDialog({ title: `Remove ${j.name}?`, message: 'Their link stops working and their scores are deleted.', confirmLabel: 'Remove', tone: 'danger' });
                  if (!ok) return;
                  try {
                    await removeHackathonJudge(eventId, j.id);
                    await onChanged();
                  } catch (err) {
                    onError(err instanceof Error ? err.message : 'Unable to remove judge');
                  }
                })()}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
