'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { PenLine, X } from 'lucide-react';
import { renderMarkdown } from '@/components/markdown';
import type { RichEditorProps } from './editor-impl';

// The editor is large, so it only loads when someone opens it.
const RichEditor = dynamic<RichEditorProps>(() => import('./editor-impl'), { ssr: false, loading: () => <div className="rte-loading" aria-hidden="true" /> });

const words = (md: string) => (md.replace(/[#*_`\[\]()>-]/g, ' ').match(/\S+/g) ?? []).length;

/**
 * A description that opens a full writing page: big text area, formatting toolbar and a word count.
 * In the form it shows a short preview that you tap to keep writing.
 */
export function DescriptionField({ label, value, onChange, placeholder, required, hint }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean; hint?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const count = words(value);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <div className="field">
      <span>{label}{required ? <em> *</em> : null}</span>
      <button type="button" className={`descprev${value.trim() ? '' : ' empty'}`} onClick={() => setOpen(true)} aria-label={`${value.trim() ? 'Edit' : 'Write'} ${label.toLowerCase()}`}>
        {value.trim() ? <div className="md descprev-text">{renderMarkdown(value)}</div> : <span className="muted">{placeholder}</span>}
        <span className="descprev-cta"><PenLine size={15} />{value.trim() ? `Edit · ${count} word${count === 1 ? '' : 's'}` : 'Start writing'}</span>
      </button>
      {hint ? <span className="small">{hint}</span> : null}

      <dialog ref={dialog} className="writer" aria-label={label} onClose={() => setOpen(false)}>
        <header className="writer-top">
          <button type="button" className="x" aria-label="Close" onClick={() => setOpen(false)}><X size={20} /></button>
          <b>{label}</b>
          <span className="small">{count} word{count === 1 ? '' : 's'}</span>
          <button type="button" className="btn p sm" onClick={() => setOpen(false)}>Done</button>
        </header>
        <div className="writer-body">
          {open ? <RichEditor value={value} onChange={onChange} placeholder={placeholder} autoFocus /> : null}
        </div>
      </dialog>
    </div>
  );
}
