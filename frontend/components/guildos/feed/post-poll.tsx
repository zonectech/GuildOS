'use client';

import { useState } from 'react';
import { BarChart3, Check, Plus, X } from 'lucide-react';

import { votePoll, type FeedPost } from '../feed-api';
import { toast } from '../ui/toast';

export const MAX_POLL_OPTIONS = 6;
export const MIN_POLL_OPTIONS = 2;

/** Returns the trimmed, non-empty options — a valid poll needs at least two. */
export function cleanPollOptions(options: string[]) {
  return options.map((o) => o.trim()).filter(Boolean);
}

export function PollToggleButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? 'Remove poll' : 'Add poll'}
      title={active ? 'Remove poll' : 'Add poll'}
      className={`grid h-9 w-9 place-items-center rounded-full transition ${active ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300'}`}
    >
      <BarChart3 className="h-[18px] w-[18px]" />
    </button>
  );
}

export function PollEditor({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-500/5 p-3">
      <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Poll options</p>
      {options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={option}
            onChange={(e) => onChange(options.map((o, i) => (i === index ? e.target.value : o)))}
            maxLength={80}
            placeholder={`Option ${index + 1}`}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
          />
          {options.length > MIN_POLL_OPTIONS ? (
            <button
              type="button"
              onClick={() => onChange(options.filter((_, i) => i !== index))}
              aria-label={`Remove option ${index + 1}`}
              className="text-slate-400 hover:text-rose-500"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ))}
      {options.length < MAX_POLL_OPTIONS ? (
        <button
          type="button"
          onClick={() => onChange([...options, ''])}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800"
        >
          <Plus className="h-3.5 w-3.5" /> Add option
        </button>
      ) : null}
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Your post text is the poll question. At least two options are required.</p>
    </div>
  );
}

export function PostPoll({ post, onPatch }: { post: FeedPost; onPatch: (id: string, u: (p: FeedPost) => FeedPost) => void }) {
  const [busy, setBusy] = useState(false);
  const poll = post.poll;
  if (!poll || !poll.options.length) return null;
  const viewerVote = poll.viewerVote ?? null;
  const hasVoted = viewerVote !== null;

  async function vote(index: number) {
    if (busy) return;
    try {
      setBusy(true);
      const { post: updated } = await votePoll(post.id, index);
      onPatch(post.id, (p) => ({ ...p, poll: updated.poll ?? null }));
    } catch (err) {
      toast.error('Unable to vote', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-1.5">
      {poll.options.map((option, index) => {
        const pct = poll.totalVotes > 0 ? Math.round((option.count / poll.totalVotes) * 100) : 0;
        const chosen = viewerVote === index;
        return (
          <button
            key={index}
            type="button"
            onClick={() => void vote(index)}
            disabled={busy}
            title={chosen ? 'Tap to remove your vote' : 'Vote for this option'}
            className={`relative block w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition disabled:opacity-60 ${chosen ? 'border-indigo-400 dark:border-indigo-500/60 bg-indigo-50/60 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:border-indigo-300 dark:hover:border-indigo-600'}`}
          >
            {hasVoted ? (
              <span
                className={`absolute inset-y-0 left-0 ${chosen ? 'bg-indigo-200/60 dark:bg-indigo-500/25' : 'bg-slate-100 dark:bg-slate-800/70'}`}
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            ) : null}
            <span className="relative flex items-center justify-between gap-2">
              <span className={`flex items-center gap-1.5 ${chosen ? 'font-semibold text-indigo-800 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-300'}`}>
                {chosen ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                {option.text}
              </span>
              {hasVoted ? <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">{pct}%</span> : null}
            </span>
          </button>
        );
      })}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        {poll.totalVotes === 1 ? '1 vote' : `${poll.totalVotes} votes`}
        {hasVoted ? ' · tap your choice to change or remove it' : ''}
      </p>
    </div>
  );
}
