'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

type TagInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Optional quick-pick suggestions shown below the input. */
  suggestions?: readonly string[];
  /** Max number of tags allowed. */
  max?: number;
};

/**
 * Chip/tag input: type and press Enter (or comma) to add a tag, click × to remove.
 * Optional suggestion chips can be tapped to add. Case-insensitive de-dupe.
 */
export function TagInput({ value, onChange, placeholder, suggestions = [], max = 20 }: TagInputProps) {
  const [draft, setDraft] = useState('');

  function add(raw: string) {
    const tag = raw.trim().replace(/,+$/, '').trim();
    if (!tag) return;
    if (value.length >= max) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  }

  function remove(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  }

  const remaining = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-2 focus-within:border-indigo-400">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
            {tag}
            <button type="button" aria-label={`Remove ${tag}`} onClick={() => remove(tag)} className="text-indigo-400 hover:text-indigo-700">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
          value={draft}
          placeholder={value.length ? '' : (placeholder ?? 'Type and press Enter')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
        />
      </div>
      {remaining.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remaining.slice(0, 12).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              disabled={value.length >= max}
              className="rounded-full border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
