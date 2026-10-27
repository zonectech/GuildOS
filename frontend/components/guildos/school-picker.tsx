'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search } from 'lucide-react';

/** Short names students actually type, mapped to the names in our list. */
const SCHOOL_ALIASES: Record<string, string> = {
  unilag: 'University of Lagos',
  oau: 'Obafemi Awolowo University Ile-Ife',
  abu: 'Ahmadu Bello University',
  ui: 'University of Ibadan',
  unn: 'University of Nigeria',
  uniben: 'University of Benin',
  unilorin: 'University of Ilorin',
  unijos: 'University of Jos',
  uniport: 'University of Port Harcourt',
  unical: 'University of Calabar',
  uniuyo: 'University of Uyo',
  lasu: 'Lagos State University',
  futa: 'Federal University of Technology, Akure',
  futminna: 'Federal University of Technology, Minna',
  buk: 'Bayero University Kano',
  unizik: 'Nnamdi Azikiwe University',
  lautech: 'Ladoke Akintola University of Technology',
  funaab: 'University of Agriculture Abeokuta',
  noun: 'National Open University of Nigeria',
  aun: 'ABTI American University of Nigeria',
};

const NOT_LISTED = '__not_listed__';
const MAX_RESULTS = 60;

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

type Props = {
  /** School names to choose from (without "Other"). */
  options: string[];
  /** The saved school name ('' when none yet). */
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  required?: boolean;
};

/**
 * Searchable school field. Works on phones (the native <datalist> it replaces
 * barely shows on mobile browsers), understands short names like UNILAG or OAU,
 * and when the school isn't listed asks for its full name instead of saving "Other".
 */
export function SchoolPicker({ options, value, onChange, loading = false, required = false }: Props) {
  const known = useMemo(() => new Set(options.map((o) => o.toLowerCase())), [options]);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [notListed, setNotListed] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const otherRef = useRef<HTMLInputElement | null>(null);

  // A saved value that isn't one of ours (from an earlier "Other") opens in not-listed mode.
  useEffect(() => {
    if (value && options.length && !known.has(value.toLowerCase())) setNotListed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return options.slice(0, MAX_RESULTS);
    const alias = SCHOOL_ALIASES[q.replace(/ /g, '')];
    const words = q.split(' ');
    const matches = options.filter((name) => {
      const n = normalize(name);
      return words.every((w) => n.includes(w));
    });
    const ordered = alias && options.includes(alias) ? [alias, ...matches.filter((m) => m !== alias)] : matches;
    return ordered.slice(0, MAX_RESULTS);
  }, [options, query]);

  function measure() {
    const b = inputRef.current?.getBoundingClientRect();
    if (b) setAnchor({ left: b.left, top: b.top, bottom: b.bottom, width: b.width });
  }

  useEffect(() => {
    if (!open) return;
    measure();
    const onScroll = () => measure();
    const onDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (inputRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  function pick(name: string) {
    if (name === NOT_LISTED || name.toLowerCase() === 'other') {
      setNotListed(true);
      setOpen(false);
      // Carry over what they typed if it isn't one of ours, so they don't type it twice.
      const typed = query.trim();
      onChange(typed && !known.has(typed.toLowerCase()) && typed.toLowerCase() !== 'other' ? typed : '');
      setTimeout(() => otherRef.current?.focus(), 50);
      return;
    }
    setNotListed(false);
    setQuery(name);
    onChange(name);
    setOpen(false);
  }

  const list =
    open && anchor && typeof document !== 'undefined'
      ? createPortal(
          (() => {
            const spaceBelow = window.innerHeight - anchor.bottom - 12;
            const flipUp = spaceBelow < 200 && anchor.top > spaceBelow;
            const maxHeight = Math.min(300, Math.max(140, flipUp ? anchor.top - 12 : spaceBelow));
            return (
              <div
                ref={listRef}
                role="listbox"
                aria-label="Schools"
                style={{
                  position: 'fixed',
                  left: anchor.left,
                  width: anchor.width,
                  maxHeight,
                  ...(flipUp ? { bottom: window.innerHeight - anchor.top + 6 } : { top: anchor.bottom + 6 }),
                }}
                className="guild-surface z-[90] overflow-y-auto overscroll-contain rounded-lg border p-1.5 shadow-lg"
              >
                {results.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No match for &ldquo;{query.trim()}&rdquo;.</p>
                ) : (
                  results.map((name) => (
                    <button
                      key={name}
                      type="button"
                      role="option"
                      aria-selected={name === value}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(name)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${name === value ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}
                    >
                      <span className="min-w-0 flex-1">{name}</span>
                      {name === value ? <Check className="h-4 w-4 shrink-0" /> : null}
                    </button>
                  ))
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(NOT_LISTED)}
                  className="mt-1 flex w-full items-center rounded-xl border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:border-slate-800 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                >
                  My school isn&apos;t listed
                </button>
              </div>
            );
          })(),
          document.body,
        )
      : null;

  return (
    <div className="space-y-3">
      <div className="auth-field">
        <span>University or institution</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            placeholder={loading ? 'Loading schools…' : 'Search, e.g. UNILAG or University of Ibadan'}
            autoComplete="off"
            value={notListed ? 'My school isn’t listed' : query}
            readOnly={notListed}
            required={required && !notListed}
            style={{ paddingLeft: '2.4rem' }}
            onFocus={() => {
              if (notListed) {
                setNotListed(false);
                setQuery('');
                onChange('');
              }
              setOpen(true);
            }}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              setOpen(true);
              // An exact name match counts as picked; anything else waits for a choice.
              const exact = options.find((o) => o.toLowerCase() === next.trim().toLowerCase());
              onChange(exact ?? '');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && open && results[0]) {
                event.preventDefault();
                pick(results[0]);
              }
              if (event.key === 'Escape') setOpen(false);
            }}
          />
        </div>
        {!notListed && query.trim() && !value && !open ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Pick your school from the list, or choose &ldquo;My school isn&apos;t listed&rdquo;.</p>
        ) : null}
      </div>

      {notListed ? (
        <label className="auth-field">
          <span>Your school&apos;s full name</span>
          <input
            ref={otherRef}
            type="text"
            placeholder="e.g. University of Port Harcourt"
            autoComplete="organization"
            value={value}
            required={required}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      ) : null}
      {list}
    </div>
  );
}
