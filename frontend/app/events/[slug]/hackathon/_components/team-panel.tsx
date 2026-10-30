'use client';

import { useState } from 'react';
import { Copy, Crown, LogOut, UserMinus, Users } from 'lucide-react';

import { confirmDialog } from '../../../../../components/guildos/ui/confirm-dialog';
import {
  createHackathonTeam, joinHackathonTeam, leaveHackathonTeam, removeHackathonTeamMember, renameHackathonTeam,
  type HackathonHub,
} from '../../../../../components/guildos/api/hackathon-api';
import { CARD, INPUT, MemberAvatars, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../../../../components/guildos/hackathon/hackathon-ui';

/** Create / join / manage the viewer's team. `onChanged` reloads the hub. */
export function TeamPanel({ hub, userId, onChanged, onError }: { hub: HackathonHub; userId: string; onChanged: () => Promise<void>; onError: (message: string) => void }) {
  const { event, settings, viewer } = hub;
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [rename, setRename] = useState(viewer.team?.name ?? '');

  async function run(action: () => Promise<unknown>) {
    try {
      setBusy(true);
      onError('');
      await action();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (!viewer.signedIn) {
    return (
      <div className={CARD}>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Want to build?</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Sign in and register for the event to form a team and submit a project.</p>
        <a href={`/login?next=${encodeURIComponent(`/events/${event.slug}/hackathon`)}`} className={`mt-3 ${PRIMARY_BUTTON}`}>Sign in</a>
      </div>
    );
  }

  if (!viewer.isParticipant && !viewer.team) {
    return (
      <div className={CARD}>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Register to take part</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Only confirmed attendees can join a team. Register on the event page first.</p>
        <a href={`/events/${event.slug}`} className={`mt-3 ${PRIMARY_BUTTON}`}>Go to registration</a>
      </div>
    );
  }

  const team = viewer.team;
  if (!team) {
    return (
      <div className={CARD}>
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100"><Users className="h-4 w-4 text-indigo-500" /> Your team</h2>
        {settings.teamsLocked ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Teams are locked because {settings.resultsPublishedAt ? 'results are out' : 'the deadline has passed'}.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void run(() => createHackathonTeam(event.id, teamName)); }}>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Start a team <span className="font-normal">(going solo? you're a team of one)</span></p>
              <input className={INPUT} placeholder="Team name" maxLength={60} value={teamName} onChange={(e) => setTeamName(e.target.value)} />
              <button type="submit" disabled={busy || !teamName.trim()} className={`w-full ${PRIMARY_BUTTON}`}>Create team</button>
            </form>
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void run(() => joinHackathonTeam(event.id, inviteCode)); }}>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Join a team with its invite code</p>
              <input className={`${INPUT} font-mono uppercase tracking-widest`} placeholder="ABC123" maxLength={12} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
              <button type="submit" disabled={busy || !inviteCode.trim()} className={`w-full ${SECONDARY_BUTTON}`}>Join team</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  const isCaptain = team.captainId === userId;
  const full = team.members.length >= settings.teamSizeMax;

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Your team</p>
          {renaming ? (
            <form className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(async () => { await renameHackathonTeam(event.id, rename); setRenaming(false); }); }}>
              <input className={INPUT} maxLength={60} value={rename} onChange={(e) => setRename(e.target.value)} autoFocus />
              <button type="submit" disabled={busy || !rename.trim()} className={PRIMARY_BUTTON}>Save</button>
            </form>
          ) : (
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {team.name}
              {isCaptain && !settings.teamsLocked && (
                <button onClick={() => setRenaming(true)} className="ml-2 text-xs font-semibold text-indigo-600 hover:underline">Rename</button>
              )}
            </h2>
          )}
        </div>
        {team.inviteCode && !settings.teamsLocked && (
          <button
            onClick={() => void navigator.clipboard.writeText(team.inviteCode!).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => undefined)}
            title={full ? 'Your team is full' : 'Share this code with teammates'}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 px-3 py-2 font-mono text-sm font-bold tracking-widest text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300"
          >
            {team.inviteCode} <Copy className="h-3.5 w-3.5" /> <span className="font-sans text-xs font-semibold tracking-normal">{copied ? 'Copied' : full ? 'Full' : 'Invite'}</span>
          </button>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {team.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
            <MemberAvatars members={[m]} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
              {m.fullName}{m.id === userId ? ' (you)' : ''}
            </span>
            {m.id === team.captainId && <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><Crown className="h-3.5 w-3.5" /> Captain</span>}
            {isCaptain && m.id !== userId && !settings.teamsLocked && (
              <button
                title="Remove from team"
                disabled={busy}
                onClick={() => void (async () => {
                  if (!(await confirmDialog({ title: `Remove ${m.fullName}?`, message: 'They can rejoin with the invite code.', confirmLabel: 'Remove', tone: 'danger' }))) return;
                  await run(() => removeHackathonTeamMember(event.id, m.id));
                })()}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              >
                <UserMinus className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {team.members.length}/{settings.teamSizeMax} members
        {team.members.length < settings.teamSizeMin ? `. You need at least ${settings.teamSizeMin} to submit` : ''}
      </p>

      {!settings.teamsLocked && (
        <button
          disabled={busy}
          onClick={() => void (async () => {
            const last = team.members.length === 1;
            const ok = await confirmDialog({
              title: 'Leave this team?',
              message: last ? "You're the last member, so the team and its project will be deleted." : 'You can join another team afterwards.',
              confirmLabel: 'Leave team',
              tone: 'danger',
            });
            if (ok) await run(() => leaveHackathonTeam(event.id));
          })()}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:underline"
        >
          <LogOut className="h-3.5 w-3.5" /> Leave team
        </button>
      )}
    </div>
  );
}
