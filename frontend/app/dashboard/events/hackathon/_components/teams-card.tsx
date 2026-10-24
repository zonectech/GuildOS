'use client';

import { CheckCircle2, Clock, Users } from 'lucide-react';

import type { HackathonManage } from '../../../../../components/guildos/hackathon-api';
import { CARD, MemberAvatars } from '../../../../../components/guildos/hackathon/hackathon-ui';

export function TeamsCard({ teams, minSize }: { teams: HackathonManage['teams']; minSize: number }) {
  const submitted = teams.filter((t) => t.submissionId).length;
  return (
    <div className={CARD}>
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
        <Users className="h-4 w-4 text-indigo-500" /> Teams
        <span className="ml-auto text-xs font-semibold text-slate-500 dark:text-slate-400">{submitted}/{teams.length} submitted</span>
      </h2>
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {teams.length === 0 && <li className="py-2 text-sm text-slate-500 dark:text-slate-400">No teams yet. Registered attendees form them on the hackathon page.</li>}
        {teams.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            <MemberAvatars members={t.members} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{t.name}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t.members.map((m) => m.fullName).join(', ')}</p>
            </div>
            {t.submissionId ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Submitted</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                <Clock className="h-3.5 w-3.5" /> {t.members.length < minSize ? `Needs ${minSize - t.members.length} more` : 'Building'}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
