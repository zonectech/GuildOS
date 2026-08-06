'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck } from 'lucide-react';

/**
 * Clickable verification badge. Everyone is unverified for now —
 * verification (subscription / manual review) will be added later.
 */
export function VerifiedBadge({ verified = false }: { verified?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={verified ? 'Verified account' : 'Unverified account'}
        className="rounded-full transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <BadgeCheck className={`h-5 w-5 ${verified ? 'text-sky-500' : 'text-slate-300'}`} />
      </button>
      {open ? (
        <div className="absolute left-1/2 top-full z-20 mt-2 w-60 -translate-x-1/2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-left shadow-lg">
          <div className="flex items-center gap-2">
            <BadgeCheck className={`h-4 w-4 shrink-0 ${verified ? 'text-sky-500' : 'text-slate-400 dark:text-slate-500'}`} />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{verified ? 'Verified account' : 'Not verified'}</p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {verified
              ? 'This account has been verified by GuildOS.'
              : 'This account is not verified yet. Verification badges are coming soon.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
