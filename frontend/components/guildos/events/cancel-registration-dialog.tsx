'use client';

import { useState } from 'react';

/**
 * Reason-required cancellation dialog, shared by:
 * - students cancelling their own registration (event page + My events)
 * - organizers removing an attendee (attendees dashboard)
 * Picking "Other" opens a free-text box; the chosen reason travels with the
 * cancellation so the other side always knows WHY, not just that it happened.
 */

export const STUDENT_CANCEL_REASONS = [
  'Schedule conflict',
  'No longer able to attend',
  'Event date or venue changed',
  'Registered by mistake',
  'Other',
] as const;

export const ORGANIZER_CANCEL_REASONS = [
  'Event is overbooked',
  'Does not meet the attendance requirements',
  'Duplicate registration',
  'Behaviour or policy violation',
  'Other',
] as const;

export function CancelRegistrationDialog({
  open,
  title,
  subtitle,
  reasons,
  confirmLabel = 'Cancel registration',
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  reasons: readonly string[];
  confirmLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [picked, setPicked] = useState('');
  const [otherText, setOtherText] = useState('');

  if (!open) return null;

  const isOther = picked === 'Other';
  const finalReason = isOther ? otherText.trim() : picked;
  const canConfirm = Boolean(finalReason) && !busy;

  function reset() {
    setPicked('');
    setOtherText('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !busy && (reset(), onClose())}>
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}

        <div className="mt-4 space-y-1.5">
          {reasons.map((reason) => (
            <label
              key={reason}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${
                picked === reason ? 'border-indigo-300 bg-indigo-50/60 font-medium text-slate-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="cancel-reason"
                checked={picked === reason}
                onChange={() => setPicked(reason)}
                className="accent-indigo-600"
              />
              {reason}
            </label>
          ))}
        </div>

        {isOther ? (
          <textarea
            autoFocus
            value={otherText}
            onChange={(e) => setOtherText(e.target.value.slice(0, 200))}
            placeholder="Tell us why (required)…"
            className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-400"
          />
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => { reset(); onClose(); }}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Keep registration
          </button>
          <button
            onClick={() => { onConfirm(finalReason); reset(); }}
            disabled={!canConfirm}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
          >
            {busy ? 'Cancelling…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
