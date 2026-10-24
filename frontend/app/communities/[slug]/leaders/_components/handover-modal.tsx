'use client';

import { useState } from 'react';
import { UserCog, XCircle } from 'lucide-react';

import { SelectMenu } from '../../../../../components/guildos/ui/select-menu';
import { handoverCommunityLeadership, type CommunityLeader, type HandoverResult } from '../../../../../components/guildos/community-list-api';
import { MemberAvatar } from '../../_components/leader-ui';

const HANDOVER_ROLES = [
  { value: '', label: 'No role change' },
  { value: 'PRESIDENT', label: 'President' },
  { value: 'VICE_PRESIDENT', label: 'Vice President' },
  { value: 'SECRETARY', label: 'Secretary' },
  { value: 'TREASURER', label: 'Treasurer' },
  { value: 'ORGANIZER', label: 'Organizer' },
  { value: 'COORDINATOR', label: 'Coordinator' },
];

/**
 * Handover, the incoming half: turn the current session's linked roster entries into REAL
 * Membership roles (and optionally transfer ownership) in one action.
 */
export function HandoverModal({
  communityId,
  leaders,
  onClose,
  onHandedOver,
}: {
  communityId: string;
  leaders: CommunityLeader[];
  onClose: () => void;
  onHandedOver: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [ownerLeaderId, setOwnerLeaderId] = useState('');
  const [result, setResult] = useState<HandoverResult | null>(null);
  const linkable = leaders.filter((l) => l.linkedUser);

  async function handleConfirm() {
    const assignments = Object.entries(roles)
      .filter(([, role]) => role)
      .map(([leaderId, role]) => ({ leaderId, role }));
    if (!assignments.length && !ownerLeaderId) {
      setError('Pick at least one role to assign (or a new owner)');
      return;
    }

    try {
      setBusy(true);
      setError('');
      setResult(await handoverCommunityLeadership(communityId, assignments, ownerLeaderId || null));
      await onHandedOver();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to hand over leadership');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {result ? 'Handover complete' : 'Hand over management roles'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {result.assigned} role{result.assigned === 1 ? '' : 's'} assigned — each appointee was notified and now
              has real management access.
            </p>
            <div className="space-y-2">
              {result.results.map((r) => (
                <div key={r.leaderId} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${r.status === 'ASSIGNED' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10'}`}>
                  <UserCog className={`h-4 w-4 shrink-0 ${r.status === 'ASSIGNED' ? 'text-emerald-600' : 'text-rose-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{r.name || 'Unknown'}</p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {r.status === 'ASSIGNED' ? `Now ${r.role.replace('_', ' ')}` : r.error}
                    </p>
                  </div>
                </div>
              ))}
              {ownerLeaderId && (
                <p className={`text-xs ${result.ownershipTransferred ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'}`}>
                  {result.ownershipTransferred
                    ? 'Ownership transferred — the new founder now controls the community.'
                    : `Ownership transfer failed: ${result.ownershipError}`}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The leadership roster is just a public listing — this gives the listed leaders <span className="font-semibold">real management
              roles</span> on GuildOS. Only leaders with linked GuildOS accounts can receive one (they'll be added as members automatically
              if they aren't yet). You can't assign a role at or above your own rank.
            </p>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300">{error}</div>
            )}

            {!linkable.length ? (
              <p className="rounded-xl bg-slate-50 dark:bg-slate-900 px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">None of the leaders in this view has a linked GuildOS account yet — tag their accounts first (edit a leader → "Tag their GuildOS account").</p>
            ) : (
              <div className="space-y-2">
                {linkable.map((leader) => (
                  <div key={leader.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                    <MemberAvatar fullName={leader.name} avatar={leader.photo} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{leader.name}</p>
                      {leader.title && <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">{leader.title}</p>}
                    </div>
                    <SelectMenu
                      aria-label="Role change"
                      className="w-40 shrink-0"
                      size="sm"
                      value={roles[leader.id] ?? ''}
                      onChange={(v) => setRoles((r) => ({ ...r, [leader.id]: v }))}
                      placeholder="No role change"
                      options={HANDOVER_ROLES}
                    />
                  </div>
                ))}

                <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2.5 dark:border-violet-500/30 dark:bg-violet-500/10">
                  <label className="text-[11px] font-semibold text-violet-800 dark:text-violet-300">Transfer ownership (founder only, optional)</label>
                  <SelectMenu
                    aria-label="Transfer ownership"
                    className="mt-1"
                    size="sm"
                    value={ownerLeaderId}
                    onChange={setOwnerLeaderId}
                    placeholder="Keep current owner"
                    options={[{ value: '', label: 'Keep current owner' }, ...linkable.map((l) => ({ value: l.id, label: l.name }))]}
                  />
                  <p className="mt-1 text-[10px] text-violet-600">You'll stay on as a leadership member; the successor becomes the founder.</p>
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => void handleConfirm()}
                disabled={busy}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? 'Assigning…' : 'Assign roles'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
