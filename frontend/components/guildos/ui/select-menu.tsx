'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Lock } from 'lucide-react';

export type SelectMenuOption = {
  value: string;
  label: string;
  /** Secondary line under the label. */
  description?: string;
  /** CSS background (colour/gradient) rendered as a small swatch. */
  swatch?: string;
  disabled?: boolean;
  /** Short badge shown after the label (e.g. "Premium"). Renders a lock icon too when disabled. */
  badge?: string;
};

type Props = {
  options: SelectMenuOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
};

/**
 * Styled dropdown (button + listbox popover) — a modern replacement for native
 * <select> where options carry descriptions, swatches, or locked states.
 * Closes on outside click / Escape; supports basic arrow-key navigation.
 */
export function SelectMenu({ options, value, onChange, placeholder = 'Choose…', className = '', 'aria-label': ariaLabel, disabled = false, size = 'md' }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Position the selected option into view when the menu opens — by scrolling ONLY the
  // list container. (scrollIntoView also scrolls ancestors/the page, which made menus
  // open pre-scrolled past the first options.)
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!list || !el) return;
    const top = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
    list.scrollTop = Math.max(0, top);
  }, [open]);

  function handleButtonKey(event: React.KeyboardEvent) {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const enabled = options.filter((o) => !o.disabled);
      if (!enabled.length) return;
      const index = enabled.findIndex((o) => o.value === value);
      const next = event.key === 'ArrowDown' ? enabled[Math.min(index + 1, enabled.length - 1)] : enabled[Math.max(index - 1, 0)];
      if (next) onChange(next.value);
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleButtonKey}
        className={`guild-field flex w-full items-center gap-2.5 rounded-2xl border text-left transition hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${
          size === 'sm' ? 'gap-1.5 rounded-lg px-2.5 py-1.5 text-xs' : 'px-3.5 py-2.5 text-sm'
        }`}
      >
        {selected?.swatch ? <span className="h-6 w-9 shrink-0 rounded-md border border-black/5" style={{ background: selected.swatch }} /> : null}
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="block truncate font-medium text-slate-900 dark:text-slate-100">{selected.label}</span>
              {selected.description ? <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{selected.description}</span> : null}
            </>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="guild-surface absolute left-0 right-0 z-30 mt-1.5 max-h-72 overflow-y-auto overscroll-contain rounded-2xl border p-1.5 shadow-lg [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-selected={isSelected || undefined}
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                  isSelected ? 'bg-indigo-50 dark:bg-indigo-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                } ${option.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {option.swatch ? <span className="h-6 w-9 shrink-0 rounded-md border border-black/5" style={{ background: option.swatch }} /> : null}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={`truncate font-medium ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-slate-100'}`}>{option.label}</span>
                    {option.badge ? (
                      <span className="guild-surface-muted inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {option.disabled ? <Lock className="h-2.5 w-2.5" /> : null}
                        {option.badge}
                      </span>
                    ) : null}
                  </span>
                  {option.description ? <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{option.description}</span> : null}
                </span>
                {isSelected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
