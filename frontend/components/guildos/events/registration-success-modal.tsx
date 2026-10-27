'use client';
import { useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { Check, Compass, X } from 'lucide-react';

export function RegistrationSuccessModal({ open, eventTitle, discoverHref, onClose }: { open: boolean; eventTitle: string; discoverHref: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!open) { if (element.open) element.close(); return; }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!element.open) element.showModal();
    return () => { document.body.style.overflow = previous; if (element.open) element.close(); };
  }, [open]);
  return <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === dialog.current) onClose(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
    <div className="relative p-7 text-center sm:p-8">
      <button type="button" aria-label="Close registration confirmation" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
      <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Check className="h-8 w-8" strokeWidth={3} /></span>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Registration successful</p>
      <h2 id={titleId} className="mt-2 text-2xl font-bold">You’re in!</h2>
      <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Your place at <span className="font-semibold text-slate-900 dark:text-white">{eventTitle}</span> is confirmed. Find your registration details in My events.</p>
      <div className="mt-7 flex flex-col gap-3">
        <Link autoFocus href={discoverHref} onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"><Compass className="h-4 w-4" /> Discover more events</Link>
        <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Stay on this event</button>
      </div>
    </div>
  </dialog>;
}
