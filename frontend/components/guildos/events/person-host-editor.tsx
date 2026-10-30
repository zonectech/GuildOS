'use client';
import { useEffect, useState } from 'react';
import { invitePersonHost, listPersonHosts, removePersonHost, type PersonHostInvitation } from '../api/event-api';
export function PersonHostEditor({ eventId, ensureSaved, onError }: { eventId: string; ensureSaved: () => Promise<string>; onError: (message: string) => void }) {
  const [invitations, setInvitations] = useState<PersonHostInvitation[]>([]);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { if (!eventId) return; let active = true; void listPersonHosts(eventId).then(r => { if(active) setInvitations(r.invitations); }).catch(() => { if(active) setNotice('Personal co-host invitations could not be loaded.'); }); return () => { active = false; }; }, [eventId]);
  async function invite() {
    setBusy(true); setNotice('');
    try {
      const id = await ensureSaved();
      const name = username.trim().replace(/^.*\/(?:u|profile)\//, '').split(/[?#/]/)[0].replace(/^@/, '');
      await invitePersonHost(id, name);
      setInvitations((await listPersonHosts(id)).invitations);
      setUsername(''); setNotice('Invitation sent. Their profile appears after they accept.');
    } catch(error) { onError(error instanceof Error ? error.message : 'Unable to invite co-host'); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true);
    try { await removePersonHost(await ensureSaved(), id); setInvitations(items => items.filter(i => i.id !== id)); }
    catch(error) { onError(error instanceof Error ? error.message : 'Unable to remove co-host'); } finally { setBusy(false); }
  }
  return <div><h3 className="text-sm font-semibold text-slate-900 dark:text-white">People as co-hosts</h3><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Invite a person using their GuildOS username or profile link. They must accept before appearing publicly. This credits their role; it does not grant event management access.</p><div className="mt-3 flex flex-wrap gap-2"><input aria-label="Personal co-host username" className="ev-input min-w-0 flex-1 basis-48" value={username} onChange={e => setUsername(e.target.value)} placeholder="@username or GuildOS profile link"/><button type="button" disabled={busy || !username.trim()} onClick={() => void invite()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Please wait…' : 'Invite person'}</button></div>{notice ? <p role="status" className="mt-2 text-xs text-slate-500 dark:text-slate-400">{notice}</p> : null}<ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">{invitations.map(invite => <li key={invite.id} className="flex flex-wrap items-center gap-3 py-3"><span className="min-w-0 flex-1 text-sm text-slate-900 dark:text-white">{invite.person?.name || 'Profile unavailable'}</span><span className="text-xs capitalize text-slate-500 dark:text-slate-400">{invite.status.toLowerCase()}</span><button type="button" disabled={busy} onClick={() => void remove(invite.id)} className="text-xs text-rose-600 disabled:opacity-50 dark:text-rose-400">Remove</button></li>)}</ul></div>;
}
