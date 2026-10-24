'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { updateHackathonSettings, type HackathonCriterion, type HackathonSettings, type HackathonTrack } from '../../../../../components/guildos/hackathon-api';
import { CARD, INPUT, PRIMARY_BUTTON } from '../../../../../components/guildos/hackathon/hackathon-ui';

function toLocalInput(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

const ICON_BUTTON = 'grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-400 transition hover:text-rose-600 dark:border-slate-700';
const ADD_ROW = 'inline-flex items-center gap-1 rounded-xl border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400';

/** Team size, timeline, prize tracks and judging criteria. Locked once results are published. */
export function SettingsCard({ eventId, settings, onSaved, onError }: { eventId: string; settings: HackathonSettings; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [teamSizeMin, setTeamSizeMin] = useState(settings.teamSizeMin);
  const [teamSizeMax, setTeamSizeMax] = useState(settings.teamSizeMax);
  const [opensAt, setOpensAt] = useState(toLocalInput(settings.submissionOpensAt));
  const [deadline, setDeadline] = useState(toLocalInput(settings.submissionDeadline));
  const [tracks, setTracks] = useState<Array<Partial<HackathonTrack>>>(settings.tracks);
  const [criteria, setCriteria] = useState<Array<Partial<HackathonCriterion>>>(settings.criteria);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const locked = Boolean(settings.resultsPublishedAt);
  const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  const patchTrack = (i: number, patch: Partial<HackathonTrack>) => { setTracks((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r))); setSaved(false); };
  const patchCriterion = (i: number, patch: Partial<HackathonCriterion>) => { setCriteria((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r))); setSaved(false); };

  async function save() {
    try {
      setBusy(true);
      onError('');
      await updateHackathonSettings(eventId, {
        teamSizeMin,
        teamSizeMax,
        submissionOpensAt: fromLocalInput(opensAt),
        submissionDeadline: fromLocalInput(deadline),
        tracks,
        criteria: criteria.map((c) => ({ ...c, weight: Number(c.weight) })),
      });
      setSaved(true);
      await onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save settings');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={CARD}>
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Settings</h2>
      {locked && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Results are published, so settings are locked.</p>}
      <fieldset disabled={locked || busy} className="mt-4 space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Min team size
            <input type="number" min={1} max={10} className={`mt-1 ${INPUT}`} value={teamSizeMin} onChange={(e) => { setTeamSizeMin(Number(e.target.value)); setSaved(false); }} />
          </label>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Max team size
            <input type="number" min={1} max={10} className={`mt-1 ${INPUT}`} value={teamSizeMax} onChange={(e) => { setTeamSizeMax(Number(e.target.value)); setSaved(false); }} />
          </label>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Submissions open
            <input type="datetime-local" className={`mt-1 ${INPUT}`} value={opensAt} onChange={(e) => { setOpensAt(e.target.value); setSaved(false); }} />
          </label>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Deadline
            <input type="datetime-local" className={`mt-1 ${INPUT}`} value={deadline} onChange={(e) => { setDeadline(e.target.value); setSaved(false); }} />
          </label>
        </div>
        <p className="-mt-3 text-xs text-slate-500 dark:text-slate-400">Leave the times blank to keep submissions open until you publish results. Teams lock at the deadline.</p>

        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Prize tracks</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Optional, e.g. "Best use of AI". Teams pick the tracks they enter; each track gets its own winner.</p>
          <div className="mt-2 space-y-2">
            {tracks.map((t, i) => (
              <div key={t.key ?? `new-${i}`} className="grid gap-2 sm:grid-cols-[1fr_160px_1fr_auto]">
                <input className={INPUT} placeholder="Track name" maxLength={80} value={t.name ?? ''} onChange={(e) => patchTrack(i, { name: e.target.value })} />
                <input className={INPUT} placeholder="Prize (e.g. ₦50,000)" maxLength={120} value={t.prize ?? ''} onChange={(e) => patchTrack(i, { prize: e.target.value })} />
                <input className={INPUT} placeholder="Short description" maxLength={300} value={t.description ?? ''} onChange={(e) => patchTrack(i, { description: e.target.value })} />
                <button type="button" aria-label="Remove track" onClick={() => { setTracks((rows) => rows.filter((_, j) => j !== i)); setSaved(false); }} className={ICON_BUTTON}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {tracks.length < 10 && (
              <button type="button" onClick={() => setTracks((rows) => [...rows, { name: '', prize: '', description: '' }])} className={ADD_ROW}><Plus className="h-3.5 w-3.5" /> Add track</button>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Judging criteria</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Judges score each criterion 1–10. Weights are relative, so they don't have to add up to 100. Once judging starts you can rename or reweight, but not add or remove.</p>
          <div className="mt-2 space-y-2">
            {criteria.map((c, i) => (
              <div key={c.key ?? `new-${i}`} className="grid grid-cols-[1fr_110px_auto] gap-2">
                <input className={INPUT} placeholder="Criterion" maxLength={60} value={c.name ?? ''} onChange={(e) => patchCriterion(i, { name: e.target.value })} />
                <div className="relative">
                  <input type="number" min={1} max={100} className={`${INPUT} pr-12`} value={c.weight ?? ''} onChange={(e) => patchCriterion(i, { weight: Number(e.target.value) })} />
                  <span className="pointer-events-none absolute right-3 top-2 text-xs text-slate-400">{totalWeight ? `${Math.round(((Number(c.weight) || 0) / totalWeight) * 100)}%` : ''}</span>
                </div>
                <button type="button" aria-label="Remove criterion" disabled={criteria.length <= 1} onClick={() => { setCriteria((rows) => rows.filter((_, j) => j !== i)); setSaved(false); }} className={ICON_BUTTON}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {criteria.length < 8 && (
              <button type="button" onClick={() => setCriteria((rows) => [...rows, { name: '', weight: 10 }])} className={ADD_ROW}><Plus className="h-3.5 w-3.5" /> Add criterion</button>
            )}
          </div>
        </div>
      </fieldset>
      {!locked && (
        <div className="mt-5 flex items-center gap-3">
          <button onClick={() => void save()} disabled={busy} className={PRIMARY_BUTTON}>{busy ? 'Saving…' : 'Save settings'}</button>
          {saved && <span className="text-xs font-medium text-emerald-600">Saved</span>}
        </div>
      )}
    </div>
  );
}
