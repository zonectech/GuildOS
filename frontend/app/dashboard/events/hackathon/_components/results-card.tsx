'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Trophy } from 'lucide-react';

import { confirmDialog } from '../../../../../components/guildos/ui/confirm-dialog';
import {
  addHackathonPlaybook, archiveHackathonToKnowledge, awardIcon, publishHackathonResults,
  type AwardPick, type HackathonManage,
} from '../../../../../components/guildos/hackathon-api';
import { CARD, Modal, ProjectDetails, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../../../../components/guildos/hackathon/hackathon-ui';

const PLACES = [1, 2, 3] as const;
const SELECT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

/** Live leaderboard → pick winners → publish (certificates + Guild Score) → archive to the Knowledge Hub. */
export function ResultsCard({ data, onChanged, onError, onNotice }: {
  data: HackathonManage;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const { event, settings, leaderboard, submissions, awards } = data;
  const published = Boolean(settings.resultsPublishedAt);
  const [openProject, setOpenProject] = useState<HackathonManage['submissions'][number] | null>(null);
  const titleOf = useMemo(() => new Map(submissions.map((s) => [s.id, `${s.title} (${s.teamName})`])), [submissions]);
  const ranked = leaderboard.filter((r) => r.score !== null);

  // Pre-fill 1st–3rd from the leaderboard; the organizer has the final say.
  const [places, setPlaces] = useState<Record<number, string>>(() => Object.fromEntries(PLACES.map((p, i) => [p, ranked[i]?.submissionId ?? ''])));
  const [trackWinners, setTrackWinners] = useState<Record<string, string>>({});
  const [participantCertificates, setParticipantCertificates] = useState(Boolean(event.certificateEnabled));
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<string>) {
    try {
      setBusy(true);
      onError('');
      onNotice(await action());
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    const picks: AwardPick[] = [
      ...PLACES.filter((p) => places[p]).map((p) => ({ submissionId: places[p], place: p })),
      ...Object.entries(trackWinners).filter(([, id]) => id).map(([trackKey, submissionId]) => ({ submissionId, trackKey })),
    ];
    if (!picks.length) return onError('Pick at least one winner');
    const ok = await confirmDialog({
      title: 'Publish results?',
      message: event.certificateEnabled ? 'This is final: winners are announced publicly, eligible certificates and Guild Score are issued, and submissions, teams and scores lock.' : 'This is final: winners are announced publicly, eligible Guild Score is issued, and submissions, teams and scores lock. Certificates are switched off for this event.',
      confirmLabel: 'Publish results',
    });
    if (!ok) return;
    await run(async () => {
      const result = await publishHackathonResults(event.id, { awards: picks, participantCertificates });
      return result.certificatesSkipped || `Results published. ${result.certificates} certificate${result.certificates === 1 ? '' : 's'} issued.`;
    });
  }

  return (
    <div className={CARD}>
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100"><Trophy className="h-4 w-4 text-amber-500" /> Leaderboard &amp; results</h2>

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">All submissions are listed here. Select a project to review it. Only published winners appear on the public hackathon page.</p>
      {openProject && (
        <Modal title={openProject.title} onClose={() => setOpenProject(null)} wide>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{openProject.teamName}</p>
          <ProjectDetails submission={openProject} tracks={settings.tracks} />
        </Modal>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Project</th>
              {settings.criteria.map((c) => <th key={c.key} className="py-2 pr-3">{c.name}</th>)}
              <th className="py-2 pr-3">Score</th>
              <th className="py-2">Judges</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {leaderboard.length === 0 && (
              <tr><td colSpan={settings.criteria.length + 4} className="py-4 text-slate-500 dark:text-slate-400">No projects submitted yet.</td></tr>
            )}
            {leaderboard.map((row) => (
              <tr key={row.submissionId}>
                <td className="py-2 pr-3 font-semibold text-slate-700 dark:text-slate-300">{row.rank ?? '-'}</td>
                <td className="py-2 pr-3 text-slate-900 dark:text-slate-100">
                  <button type="button" className="text-left font-semibold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400" onClick={() => setOpenProject(submissions.find((s) => s.id === row.submissionId) ?? null)}>
                    {titleOf.get(row.submissionId)}
                  </button>
                  {awards.filter((a) => a.submissionId === row.submissionId).map((a) => (
                    <span key={a.id} className="ml-2 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{awardIcon(a)} {a.label}</span>
                  ))}
                </td>
                {settings.criteria.map((c) => <td key={c.key} className="py-2 pr-3 text-slate-600 dark:text-slate-400">{row.judgeCount ? row.byCriterion[c.key]?.toFixed(1) : '-'}</td>)}
                <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-slate-100">{row.score?.toFixed(2) ?? '-'}</td>
                <td className="py-2 text-slate-600 dark:text-slate-400">{row.judgeCount}/{data.judges.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!published ? (
        submissions.length > 0 && (
          <div className="mt-5 space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Pick the winners</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {PLACES.map((p) => (
                <label key={p} className="block text-xs font-semibold text-slate-600 dark:text-slate-400">{awardIcon({ place: p })} {p === 1 ? '1st' : p === 2 ? '2nd' : '3rd'} place
                  <select className={`mt-1 ${SELECT}`} value={places[p] ?? ''} onChange={(e) => setPlaces((cur) => ({ ...cur, [p]: e.target.value }))}>
                    <option value="">None</option>
                    {submissions.map((s) => <option key={s.id} value={s.id}>{titleOf.get(s.id)}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {settings.tracks.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {settings.tracks.map((t) => (
                  <label key={t.key} className="block text-xs font-semibold text-slate-600 dark:text-slate-400">🏆 {t.name}
                    <select className={`mt-1 ${SELECT}`} value={trackWinners[t.key] ?? ''} onChange={(e) => setTrackWinners((cur) => ({ ...cur, [t.key]: e.target.value }))}>
                      <option value="">None</option>
                      {/* Teams that entered the track first; organizers may still pick any project. */}
                      {[...submissions].sort((a, b) => Number(b.trackKeys.includes(t.key)) - Number(a.trackKeys.includes(t.key))).map((s) => (
                        <option key={s.id} value={s.id}>{s.trackKeys.includes(t.key) ? '✓ ' : ''}{titleOf.get(s.id)}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" disabled={!event.certificateEnabled || !data.community.verified} checked={Boolean(event.certificateEnabled && participantCertificates)} onChange={(e) => setParticipantCertificates(e.target.checked)} />
              {event.certificateEnabled ? 'Also give every other team a participation certificate' : 'Certificates are switched off for this event'}
            </label>
            {!data.community.verified && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                {data.community.name || 'This community'} isn't verified yet, so results will publish without certificates or Guild Score.
              </p>
            )}
            <button onClick={() => void publish()} disabled={busy} className={PRIMARY_BUTTON}>{busy ? 'Publishing…' : 'Publish results'}</button>
          </div>
        )
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
          <p className="flex-1 text-sm font-medium text-emerald-800 dark:text-emerald-300">Results are published and public on the hackathon page.</p>
          {data.knowledgeResourceId ? (
            <a href={`/communities/${data.community.slug}?tab=knowledge&resource=${data.knowledgeResourceId}`} className={SECONDARY_BUTTON}><BookOpen className="h-4 w-4" /> Saved to Knowledge Hub</a>
          ) : (
            <button disabled={busy} onClick={() => void run(async () => { await archiveHackathonToKnowledge(event.id); return 'Winning projects saved to your Knowledge Hub.'; })} className={SECONDARY_BUTTON}>
              <BookOpen className="h-4 w-4" /> Save winners to Knowledge Hub
            </button>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="flex-1 text-xs text-slate-500 dark:text-slate-400">Running your first hackathon? Add the organizer playbook (timeline checklist, sponsor pitch, rules) to your Knowledge Hub.</p>
        <button
          disabled={busy}
          onClick={() => void run(async () => {
            const result = await addHackathonPlaybook(event.id);
            return result.created ? `Added ${result.created} playbook articles to your Knowledge Hub.` : 'The playbook is already in your Knowledge Hub.';
          })}
          className={SECONDARY_BUTTON}
        >
          Add organizer playbook
        </button>
      </div>
    </div>
  );
}
