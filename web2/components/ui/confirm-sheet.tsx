'use client';
import { useState } from 'react';
import { Btn } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';

/**
 * The one way to ask "are you sure?". A bottom sheet on phones, a side panel on desktop, with the
 * action in red (or green when nothing is lost) and a plain way out. Replaces the browser's own
 * confirm and prompt boxes, which look like an error and can't be styled or read well.
 *
 * With `field`, it also asks for a short text (a reason, a title) and passes it to `onConfirm`.
 */
export function ConfirmSheet({
  open, onClose, title, body, confirmLabel, onConfirm, danger = true, cancelLabel = 'Not now', field, extra,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  /** May be async; the sheet shows progress and stays open if it throws. */
  onConfirm: (text: string) => unknown | Promise<unknown>;
  danger?: boolean;
  cancelLabel?: string;
  field?: { label: string; placeholder?: string; initial?: string; required?: boolean; maxLength?: number; multiline?: boolean };
  /** Another action shown above the confirm button (e.g. "Sync now"). */
  extra?: React.ReactNode;
}) {
  const [text, setText] = useState(field?.initial ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!busy) { setError(''); setText(field?.initial ?? ''); onClose(); } };
  async function go() {
    if (field?.required && !text.trim()) { setError(`${field.label} is required.`); return; }
    setBusy(true); setError('');
    try { await onConfirm(text.trim()); setText(field?.initial ?? ''); }
    catch (e) { setError(e instanceof Error ? e.message : 'That didn’t work. Try again.'); }
    finally { setBusy(false); }
  }
  const input = 'w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none focus:border-green-text';
  return (
    <Sheet open={open} onClose={close} title={title}>
      <div className="flex flex-col gap-4 px-5 pb-6">
        <div className="text-[15px] leading-relaxed">{body}</div>
        {field ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold">{field.label}{field.required ? null : <span className="font-normal text-muted"> (optional)</span>}</span>
            {field.multiline
              ? <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={field.placeholder} maxLength={field.maxLength ?? 500} rows={3} className={input} />
              : <input value={text} onChange={(e) => setText(e.target.value)} placeholder={field.placeholder} maxLength={field.maxLength ?? 120} className={`${input} h-12 py-0`} />}
          </label>
        ) : null}
        {error ? <p role="alert" className="rounded-2xl bg-[color-mix(in_srgb,var(--coral)_14%,transparent)] px-4 py-3 text-[14px] font-semibold text-coral-text">{error}</p> : null}
        {extra}
        <Btn wide size="lg" onClick={() => void go()} disabled={busy}
          className={danger ? '!bg-[var(--danger)] !shadow-none text-white hover:!bg-[var(--danger-hover)]' : ''}>{busy ? 'One moment…' : confirmLabel}</Btn>
        <Btn wide kind="secondary" onClick={close} disabled={busy}>{cancelLabel}</Btn>
      </div>
    </Sheet>
  );
}
