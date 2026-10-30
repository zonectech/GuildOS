'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';

/** Keep fields mounted between visits so unsaved editor and upload state survives. */
export function EditorModal({ open, title, onClose, children, error }: { open: boolean; title: string; onClose: () => void; children: ReactNode; error?: string }) {
 const [mounted,setMounted]=useState(false); const panel=useRef<HTMLDivElement>(null); const titleId=useId(); const closeRef=useRef(onClose); closeRef.current=onClose;
 useEffect(()=>setMounted(true),[]);
 useEffect(()=>{
  if(!open || !mounted)return;
  const previous=document.activeElement as HTMLElement | null; const overflow=document.body.style.overflow; document.body.style.overflow='hidden';
  const controls=()=>Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')??[]).filter(el=>el.getClientRects().length>0);
  controls()[0]?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeRef.current();}if(e.key==='Tab'){const all=controls();if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus();}}};
  document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus();};
 },[open,mounted]);
 if(!mounted)return null;
 return createPortal(<div className={open?'fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6':'hidden'} aria-hidden={!open}><button type="button" tabIndex={-1} onClick={onClose} aria-label={'Close '+title} className="absolute inset-0 bg-slate-950/60"/><div ref={panel} role="dialog" aria-modal={open?true:undefined} aria-labelledby={titleId} className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-xl"><header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 id={titleId} className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2><button type="button" onClick={onClose} aria-label={'Close '+title} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4"/></button></header><div className="min-h-0 overflow-y-auto p-5">{error?<p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>:null}<div className="space-y-5 [&>section]:border-0 [&>section]:p-0 [&>section]:shadow-none">{children}</div></div><footer className="shrink-0 border-t border-slate-200 px-5 py-3 dark:border-slate-800"><button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900">Done</button><span className="ml-3 text-xs text-slate-500 dark:text-slate-400">Changes stay in this editor until you save.</span></footer></div></div>,document.body);
}

/** required: shows the red star. done: the section is filled in, so it shows a green tick. */
export function EditorOption({ label, value, onClick, done = false, required = false }: { label: string; value: string; onClick: () => void; done?: boolean; required?: boolean }) {
 return <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-4 border-b border-slate-200 px-1 py-4 text-left last:border-0 hover:text-indigo-600 dark:border-slate-800 dark:hover:text-indigo-300"><span className="flex shrink-0 items-center gap-2 text-sm font-medium">{done ? <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-emerald-600 text-white"><Check className="h-3 w-3" strokeWidth={3} aria-hidden /><span className="sr-only">Done:</span></span> : null}<span>{label}{required ? <span className="text-rose-500"> *</span> : null}</span></span><span className="min-w-0 truncate text-right text-sm text-slate-500 dark:text-slate-400">{value} <span aria-hidden className="ml-2">›</span></span></button>;
}
