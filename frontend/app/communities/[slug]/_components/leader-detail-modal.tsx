'use client';

import { BadgeCheck, XCircle } from 'lucide-react';
import type { CommunityLeader } from '../../../../components/guildos/community-list-api';
import { MemberAvatar } from './leader-ui';

/** Read-only bio card for one roster entry. `children` renders below the bio (page-specific extras). */
export function LeaderDetailModal({
  leader,
  avatarSize = 'md',
  onClose,
  children,
}: {
  leader: CommunityLeader;
  avatarSize?: 'md' | 'lg';
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <MemberAvatar fullName={leader.name} avatar={leader.photo} size={avatarSize} />
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-900 dark:text-slate-100">{leader.name}</p>
              {(leader.title || leader.session) && (
                <p className="truncate text-xs font-medium text-indigo-600">
                  {leader.title}
                  {leader.title && leader.session ? ' · ' : ''}
                  {leader.session}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        {leader.linkedUser && (
          <a
            href={`/u/${leader.linkedUser.username}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30 dark:hover:bg-sky-500/25"
          >
            <BadgeCheck className="h-3.5 w-3.5" /> View GuildOS profile
          </a>
        )}
        {(leader.department || leader.level || leader.phone) && (
          <div className="mt-4 space-y-1 rounded-2xl bg-slate-50 dark:bg-slate-900 px-3.5 py-3 text-sm">
            {leader.department && (
              <p className="flex justify-between gap-3"><span className="text-slate-400 dark:text-slate-500">Department</span><span className="font-medium text-slate-700 dark:text-slate-300">{leader.department}</span></p>
            )}
            {leader.level && (
              <p className="flex justify-between gap-3"><span className="text-slate-400 dark:text-slate-500">Level</span><span className="font-medium text-slate-700 dark:text-slate-300">{leader.level}</span></p>
            )}
            {leader.phone && (
              <p className="flex justify-between gap-3"><span className="text-slate-400 dark:text-slate-500">Phone</span><a href={`tel:${leader.phone}`} className="font-medium text-indigo-600 hover:underline">{leader.phone}</a></p>
            )}
          </div>
        )}
        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{leader.bio || 'No bio added yet.'}</p>
        {children}
      </div>
    </div>
  );
}
