'use client';

import { useMemo } from 'react';
import { Archive, Award, BadgeCheck, ChevronRight, PenLine, Plus } from 'lucide-react';

import type { CommunityLeader } from '../../../../components/guildos/community-list-api';
import { LeaderCardAction, MemberAvatar } from './leader-ui';

const LEADER_PREVIEW_LIMIT = 6;

/**
 * Currently serving = ACTIVE **and** belonging to the current session (the highest starting
 * year among active leaders' sessions). Stale ACTIVE rows in older sessions, plus ARCHIVED
 * (left early) and PAST (session dissolved), are only shown on the dedicated /leaders page.
 */
function currentlyServing(leaders: CommunityLeader[]) {
  let current: string | null = null;
  let bestYear = -1;
  for (const l of leaders) {
    if (l.status !== 'ACTIVE') continue;
    const m = /^(\d{4})\/\d{4}$/.exec(l.session.trim());
    const year = m ? Number(m[1]) : 0;
    if (year > bestYear) {
      bestYear = year;
      current = l.session.trim();
    }
  }
  return leaders.filter((l) => l.status === 'ACTIVE' && (current === null || l.session.trim() === current));
}

export function LeadershipCard({
  communitySlug,
  leaders,
  canManage,
  onAdd,
  onEdit,
  onArchive,
  onView,
}: {
  communitySlug: string;
  leaders: CommunityLeader[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (leader: CommunityLeader) => void;
  onArchive: (leaderId: string) => void;
  onView: (leader: CommunityLeader) => void;
}) {
  const activeLeaders = useMemo(() => currentlyServing(leaders), [leaders]);
  const visibleLeaders = activeLeaders.slice(0, LEADER_PREVIEW_LIMIT);

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-white">
        <Award className="h-4 w-4 text-indigo-500" /> Leadership Team
        {activeLeaders.length > 0 && (
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            {activeLeaders.length} {activeLeaders.length === 1 ? 'leader' : 'leaders'}
          </span>
        )}
        {canManage && (
          <button
            onClick={onAdd}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
          >
            <Plus className="h-3.5 w-3.5" /> Add leader
          </button>
        )}
      </h2>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Click a leader to read their bio. Session officers are re-listed every year — no GuildOS account required.</p>
      {activeLeaders.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibleLeaders.map((leader) => (
            <button
              key={leader.id}
              onClick={() => onView(leader)}
              className="group relative flex items-start gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 px-4 py-3.5 text-left transition hover:border-indigo-200 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm"
            >
              <MemberAvatar fullName={leader.name} avatar={leader.photo} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{leader.name}</p>
                  {leader.linkedUser && (
                    <span title="Has a GuildOS account" className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30">
                      <BadgeCheck className="h-3 w-3" /> On GuildOS
                    </span>
                  )}
                </div>
                {(leader.title || leader.session) && (
                  <p className="truncate text-xs font-medium text-indigo-600">
                    {leader.title}
                    {leader.title && leader.session ? ' · ' : ''}
                    {leader.session}
                  </p>
                )}
                {leader.bio && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{leader.bio}</p>
                )}
              </div>
              {canManage && (
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <LeaderCardAction
                    onClick={(e) => { e.stopPropagation(); onEdit(leader); }}
                    title="Edit leader"
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-500 dark:text-slate-400 transition hover:border-indigo-200 hover:text-indigo-600"
                  >
                    <PenLine className="h-3.5 w-3.5" />
                  </LeaderCardAction>
                  <LeaderCardAction
                    onClick={(e) => { e.stopPropagation(); onArchive(leader.id); }}
                    title="Archive (left the post early)"
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-500 dark:text-slate-400 transition hover:border-amber-200 hover:text-amber-600"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </LeaderCardAction>
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">No leadership members listed yet.</p>
          {canManage && (
            <button
              onClick={onAdd}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add your first leader
            </button>
          )}
        </div>
      )}
      {leaders.length > 0 && (
        <a
          href={`/communities/${communitySlug}/leaders`}
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
        >
          {activeLeaders.length > LEADER_PREVIEW_LIMIT ? `View full Leadership Team (${activeLeaders.length})` : 'Browse leaders by session'} <ChevronRight className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
