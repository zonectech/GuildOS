'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { X } from 'lucide-react';
import { spring } from '@/lib/motion';
import { useIsDesktop } from '@/components/ui/sheet';

type Opts = { title?: string; onClick?: () => void };
type Toast = { id: number; text: string; icon?: React.ReactNode } & Opts;
type Show = (text: string, icon?: React.ReactNode, opts?: Opts) => void;
const Ctx = createContext<Show>(() => undefined);

const MAX = 3;
const LIFE_MS = 5000;

/**
 * Small messages: slide up from the bottom on phones, in from the top right on desktop.
 * They hide after 5 s, stack at most 3, and can be tapped (e.g. to open a chat).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const desktop = useIsDesktop();
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback<Show>((text, icon, opts) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-(MAX - 1)), { id, text, icon, ...opts }]);
    setTimeout(() => dismiss(id), LIFE_MS);
  }, [dismiss]);
  const from = desktop ? { opacity: 0, x: 48, scale: 0.96 } : { opacity: 0, y: 28, scale: 0.92 };
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className={desktop
        ? 'pointer-events-none fixed top-5 right-5 z-[90] flex w-[360px] flex-col items-end gap-2'
        : 'pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4'}>
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const body = (
              <>
                {t.icon ? <span className="shrink-0">{t.icon}</span> : null}
                <span className="min-w-0 text-left">{t.title ? <b className="block truncate text-[13px]">{t.title}</b> : null}<span className={t.title ? 'line-clamp-2 text-[13.5px] font-medium text-muted' : ''}>{t.text}</span></span>
              </>
            );
            return (
              <m.div key={t.id} layout initial={from} animate={{ opacity: 1, x: 0, y: 0, scale: 1, transition: spring.bouncy }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                className={`glass pointer-events-auto flex max-w-full items-center gap-2.5 border border-line text-[14px] font-semibold text-ink shadow-lift ${t.title ? 'w-full rounded-2xl px-3.5 py-3' : 'rounded-full px-4 py-2.5'}`}>
                {t.onClick ? <button type="button" onClick={() => { t.onClick?.(); dismiss(t.id); }} className="flex min-w-0 flex-1 items-center gap-2.5">{body}</button> : <span className="flex min-w-0 flex-1 items-center gap-2.5">{body}</span>}
                {t.title ? <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-mist"><X size={14} /></button> : null}
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
