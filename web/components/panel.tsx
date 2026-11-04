'use client';
import { useEffect, useRef } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';

/** A row that opens a panel, with a tick once its required part is done. Same pattern as the event form. */
export function OptionRow({ label, value, done, required, onClick }: { label: string; value: string; done?: boolean; required?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="opt" onClick={onClick}>
      <span className="stack" style={{ gap: 1, textAlign: 'left' }}><b>{label}{required ? <em> *</em> : null}</b><span className="small">{value}</span></span>
      <span className="row" style={{ gap: 8 }}>
        {done ? <i className="tick" aria-label="Done"><Check size={13} strokeWidth={3} /></i> : null}
        <ChevronRight size={18} />
      </span>
    </button>
  );
}

/** A modal panel built on the native dialog element, so focus and Escape work without extra code. */
export function Panel({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="panel" onClose={onClose} aria-label={title}>
      <header><b>{title}</b><button type="button" className="x" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
      <div className="pb">{children}</div>
      <footer>{footer ?? <button type="button" className="btn p" onClick={onClose}>Done</button>}</footer>
    </dialog>
  );
}
