'use client';

import { useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';

import { inviteMembersByEmail } from '../../../../components/guildos/community-list-api';

/** Bulk email invites (up to 50) with the community's join link; existing members are skipped server-side. */
export function InviteEmailsModal({ communityId, onClose, onError }: { communityId: string; onClose: () => void; onError: (message: string) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  async function handleSend() {
    const emails = text.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    if (!emails.length) return;
    try {
      setBusy(true);
      setDone('');
      onError('');
      const result = await inviteMembersByEmail(communityId, emails);
      const parts = [`Sent ${result.sent} invite${result.sent === 1 ? '' : 's'}`];
      if (result.skippedMembers) parts.push(`${result.skippedMembers} already member${result.skippedMembers === 1 ? '' : 's'}`);
      if (result.failed.length) parts.push(`${result.failed.length} failed`);
      setDone(parts.join(' · ') + '.');
      // Leave only the failed addresses in the box so they can be fixed and retried.
      setText(result.failed.join('\n'));
    } catch (err) {
      setDone('');
      onError(err instanceof Error ? err.message : 'Unable to send invites');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
          <UserPlus className="h-4 w-4 text-indigo-500" /> Invite members by email
        </h3>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Paste up to 50 addresses (one per line, or separated by commas/spaces). Each gets a branded email
          with your community's join link. Existing members are skipped automatically.
        </p>
        {done ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{done}</p> : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'ada@student.edu.ng\nbayo@student.edu.ng'}
          className="mt-3 min-h-32 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 font-mono text-xs outline-none transition focus:border-indigo-400"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800">
            Close
          </button>
          <button
            onClick={() => void handleSend()}
            disabled={busy || !text.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            {busy ? 'Sending…' : 'Send invites'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Type-to-confirm guard for community deletion — destructive, so a plain confirm isn't enough. */
export function DeleteCommunityModal({ communityName, busy, onCancel, onConfirm }: { communityName: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const [nameInput, setNameInput] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onCancel()}>
      <div className="w-full max-w-sm rounded-3xl border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400">
          <Trash2 className="h-4 w-4" /> Delete {communityName}?
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          This permanently deletes the community, its posts and knowledge. It <span className="font-semibold text-slate-700 dark:text-slate-300">cannot be undone</span>.
          If you just want to wind it down, <span className="font-semibold text-slate-700 dark:text-slate-300">Archive</span> instead (reversible, keeps everything).
        </p>
        <label className="mt-4 block text-xs font-semibold text-slate-600 dark:text-slate-400">
          Type <span className="select-all font-bold text-slate-900 dark:text-slate-100">{communityName}</span> to confirm
        </label>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder={communityName}
          className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none transition focus:border-rose-400"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || nameInput.trim() !== communityName}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
          >
            {busy ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </div>
    </div>
  );
}
