'use client';

import { Code2, ExternalLink, PlayCircle, XCircle } from 'lucide-react';

import { resolveAvatarUrl } from '../community-list-api';
import { resolveEventImageUrl } from '../event-api';
import type { HackathonMember, HackathonSubmission, HackathonTrack } from '../hackathon-api';

export const CARD = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm';
export const INPUT = 'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20';
export const PRIMARY_BUTTON = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50';
export const SECONDARY_BUTTON = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50';

export function formatWhen(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-NG', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function MemberAvatars({ members, max = 4 }: { members: HackathonMember[]; max?: number }) {
  return (
    <div className="flex -space-x-2">
      {members.slice(0, max).map((m) => {
        const url = resolveAvatarUrl(m.avatar);
        const initials = m.fullName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
        return url ? (
          <img key={m.id} src={url} alt={m.fullName} title={m.fullName} className="h-7 w-7 rounded-full border-2 border-white object-cover dark:border-slate-900" />
        ) : (
          <span key={m.id} title={m.fullName} className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:border-slate-900 dark:bg-indigo-500/20 dark:text-indigo-300">
            {initials || '?'}
          </span>
        );
      })}
      {members.length > max && (
        <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-600 dark:border-slate-900 dark:bg-slate-800 dark:text-slate-300">
          +{members.length - max}
        </span>
      )}
    </div>
  );
}

export function TrackChips({ keys, tracks }: { keys: string[]; tracks: HackathonTrack[] }) {
  const named = keys.map((k) => tracks.find((t) => t.key === k)).filter((t): t is HackathonTrack => Boolean(t));
  if (!named.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {named.map((t) => (
        <span key={t.key} className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{t.name}</span>
      ))}
    </div>
  );
}

export function ProjectLinks({ submission }: { submission: Pick<HackathonSubmission, 'repoUrl' | 'demoUrl' | 'videoUrl'> }) {
  const links = [
    { href: submission.demoUrl, label: 'Live demo', Icon: ExternalLink },
    { href: submission.repoUrl, label: 'Code', Icon: Code2 },
    { href: submission.videoUrl, label: 'Video', Icon: PlayCircle },
  ].filter((l) => l.href);
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map(({ href, label, Icon }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-indigo-300">
          <Icon className="h-3.5 w-3.5" /> {label}
        </a>
      ))}
    </div>
  );
}

/** Full project write-up — shared by the public gallery and the judges' page. */
export function ProjectDetails({ submission, tracks }: { submission: HackathonSubmission; tracks: HackathonTrack[] }) {
  return (
    <div className="space-y-3">
      {submission.tagline && <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{submission.tagline}</p>}
      <TrackChips keys={submission.trackKeys} tracks={tracks} />
      {submission.images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {submission.images.map((src) => (
            <a key={src} href={resolveEventImageUrl(src)} target="_blank" rel="noopener noreferrer">
              <img src={resolveEventImageUrl(src)} alt="" className="aspect-video w-full rounded-xl border border-slate-200 object-cover dark:border-slate-800" />
            </a>
          ))}
        </div>
      )}
      {submission.description && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{submission.description}</p>
      )}
      {submission.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {submission.techStack.map((t) => (
            <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">{t}</span>
          ))}
        </div>
      )}
      <ProjectLinks submission={submission} />
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300">{message}</div>;
}
