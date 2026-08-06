'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { searchMentionTargets, type FeedTag } from '../feed-api';

/** Find an active "@token" immediately before the caret (no whitespace between). */
function activeMention(text: string, caret: number): { query: string; start: number } | null {
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === '@') {
      const before = i > 0 ? text[i - 1] : ' ';
      if (i === 0 || /\s/.test(before)) {
        const query = text.slice(i + 1, caret);
        if (/^[\w.-]*$/.test(query)) return { query, start: i };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i -= 1;
  }
  return null;
}

export const MentionTextarea = forwardRef<HTMLTextAreaElement, {
  value: string;
  onChange: (v: string) => void;
  tags: FeedTag[];
  onTagsChange: (t: FeedTag[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  /** Called with the image file when the user pastes an image from the clipboard. */
  onImagePaste?: (file: File) => void;
}>(function MentionTextarea({
  value,
  onChange,
  tags,
  onTagsChange,
  placeholder,
  rows = 2,
  className,
  onImagePaste,
}, forwardedRef) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [results, setResults] = useState<FeedTag[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  const mention = useMemo(() => activeMention(value, caret), [value, caret]);
  const query = mention?.query ?? null;

  useEffect(() => {
    if (query === null || query.length < 1) {
      setResults([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const t = setTimeout(() => {
      void searchMentionTargets(query)
        .then((r) => {
          if (!cancelled) {
            setResults(r);
            setOpen(r.length > 0);
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  function pick(tag: FeedTag) {
    if (!mention) return;
    const insert = `@${tag.type === 'COMMUNITY' ? tag.label : tag.handle || tag.label}`;
    const next = value.slice(0, mention.start) + insert + ' ' + value.slice(caret);
    onChange(next);
    if (!tags.some((t) => t.type === tag.type && t.id === tag.id)) onTagsChange([...tags, tag]);
    setOpen(false);
    setResults([]);
    const newCaret = mention.start + insert.length + 1;
    setTimeout(() => {
      const el = innerRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
        setCaret(newCaret);
      }
    }, 0);
  }

  function removeTag(tag: FeedTag) {
    onTagsChange(tags.filter((t) => !(t.type === tag.type && t.id === tag.id)));
  }

  return (
    <div className="relative">
      <textarea
        ref={(el) => {
          innerRef.current = el;
          if (typeof forwardedRef === 'function') forwardedRef(el);
          else if (forwardedRef) forwardedRef.current = el;
        }}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
        onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
        onPaste={(e) => {
          if (!onImagePaste) return;
          const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
          if (file) {
            e.preventDefault();
            onImagePaste(file);
          }
        }}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />

      {open && results.length ? (
        <div className="absolute left-2 top-full z-30 mt-1 w-72 max-w-[calc(100%-1rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.map((r) => (
            <button
              key={`${r.type}:${r.id}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-slate-50"
            >
              <span className="text-slate-400">{r.type === 'COMMUNITY' ? '#' : '@'}</span>
              <span className="truncate font-medium text-slate-900">{r.label}</span>
              {r.handle ? <span className="truncate text-slate-400">{r.type === 'COMMUNITY' ? r.handle : `@${r.handle}`}</span> : null}
              <span className="ml-auto shrink-0 text-[10px] uppercase text-slate-400">{r.type === 'COMMUNITY' ? 'Community' : 'Person'}</span>
            </button>
          ))}
        </div>
      ) : searching && query && query.length >= 1 ? (
        <div className="absolute left-2 top-full z-30 mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
          <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Searching…
        </div>
      ) : null}

      {tags.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={`${t.type}:${t.id}`} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
              {t.type === 'COMMUNITY' ? '#' : '@'}
              {t.handle || t.label}
              <button type="button" onClick={() => removeTag(t)} aria-label="Remove tag">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
});
