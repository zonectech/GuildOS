'use client';

import { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';

import { resolveEventImageUrl } from '../../../../../components/guildos/event-api';
import { awardIcon, type GallerySubmission, type HackathonHub } from '../../../../../components/guildos/hackathon-api';
import { CARD, MemberAvatars, Modal, ProjectDetails, TrackChips } from '../../../../../components/guildos/hackathon/hackathon-ui';

/** Only published winning projects are returned by the hub. */
export function ProjectGallery({ hub }: { hub: HackathonHub }) {
  const [open, setOpen] = useState<GallerySubmission | null>(null);
  const { settings, awards, leaderboard } = hub;

  const awardsBySubmission = useMemo(() => {
    const map = new Map<string, typeof awards>();
    for (const a of awards) map.set(a.submissionId, [...(map.get(a.submissionId) ?? []), a]);
    return map;
  }, [awards]);
  const rowBySubmission = useMemo(() => new Map((leaderboard ?? []).map((r) => [r.submissionId, r])), [leaderboard]);

  // Published: rank order (winners first). Before results: submission order.
  const ordered = useMemo(() => {
    if (!leaderboard) return hub.submissions;
    const rank = (s: GallerySubmission) => rowBySubmission.get(s.id)?.rank ?? Number.MAX_SAFE_INTEGER;
    return [...hub.submissions].sort((a, b) => rank(a) - rank(b));
  }, [hub.submissions, leaderboard, rowBySubmission]);

  const winners = [...awards].sort((a, b) => (a.place ?? 99) - (b.place ?? 99));

  return (
    <div className="space-y-5">
      {winners.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm dark:border-amber-500/30 dark:from-amber-950/40 dark:to-slate-900">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100"><Trophy className="h-5 w-5 text-amber-500" /> Winners</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {winners.map((award) => {
              const project = hub.submissions.find((s) => s.id === award.submissionId);
              if (!project) return null;
              return (
                <button key={award.id} onClick={() => setOpen(project)} className="rounded-lg border border-amber-100 bg-white p-4 text-left transition hover:shadow-md dark:border-amber-500/20 dark:bg-slate-900">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">{awardIcon(award)} {award.label}</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{project.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{project.teamName}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">Winning projects ({hub.submissions.length})</h2>
        {ordered.length === 0 ? (
          <div className={`${CARD} text-center text-sm text-slate-500 dark:text-slate-400`}>Winning projects will appear here after the organizer publishes results.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((s) => {
              const row = rowBySubmission.get(s.id);
              const cover = s.images[0] ? resolveEventImageUrl(s.images[0]) : '';
              return (
                <button key={s.id} onClick={() => setOpen(s)} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition  hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                  {cover ? (
                    <img src={cover} alt="" className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="grid aspect-video w-full place-items-center bg-gradient-to-br from-slate-100 to-indigo-50 text-3xl font-black text-indigo-200 dark:from-slate-900 dark:to-indigo-950 dark:text-indigo-900">
                      {s.title.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    {(awardsBySubmission.get(s.id) ?? []).map((a) => (
                      <span key={a.id} className="w-fit rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{awardIcon(a)} {a.label}</span>
                    ))}
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{s.title}</p>
                    {s.tagline && <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{s.tagline}</p>}
                    <TrackChips keys={s.trackKeys} tracks={settings.tracks} />
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <MemberAvatars members={s.members} />
                        <span className="truncate text-xs text-slate-500 dark:text-slate-400">{s.teamName}</span>
                      </div>
                      {row?.score !== null && row?.score !== undefined && (
                        <span className="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">#{row.rank} · {row.score.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <Modal title={open.title} onClose={() => setOpen(null)} wide>
          <div className="mb-3 flex items-center gap-2">
            <MemberAvatars members={open.members} max={6} />
            <span className="text-sm text-slate-600 dark:text-slate-400">{open.teamName} · {open.members.map((m) => m.fullName).join(', ')}</span>
          </div>
          <ProjectDetails submission={open} tracks={settings.tracks} />
        </Modal>
      )}
    </div>
  );
}
