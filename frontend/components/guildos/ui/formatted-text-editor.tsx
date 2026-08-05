'use client';

import { useEffect, useState } from 'react';
import { MarkdownTextarea } from './markdown-textarea';
import { RichTextEditor } from './rich-text-editor';

export type FormattedTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

const MODE_KEY = 'guildos-editor-mode';
type Mode = 'rich' | 'markdown';

/**
 * Long-form text editor with a Rich (WYSIWYG) / Markdown escape-hatch toggle.
 * Markdown stays the stored format either way; the choice is remembered per browser.
 */
export function FormattedTextEditor({ value, onChange, className, placeholder }: FormattedTextEditorProps) {
  const [mode, setMode] = useState<Mode>('rich');

  useEffect(() => {
    try {
      if (window.localStorage.getItem(MODE_KEY) === 'markdown') setMode('markdown');
    } catch {
      /* storage unavailable */
    }
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }

  return (
    <div>
      <div className="mb-1 flex justify-end">
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          {(['rich', 'markdown'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                mode === m ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {m === 'rich' ? 'Rich' : 'Markdown'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'rich' ? (
        <RichTextEditor value={value} onChange={onChange} className={className} placeholder={placeholder} />
      ) : (
        <MarkdownTextarea value={value} onChange={onChange} className={className} placeholder={placeholder} />
      )}
    </div>
  );
}
