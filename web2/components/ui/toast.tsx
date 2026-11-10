'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { X } from 'lucide-react';
import { spring } from '@/lib/motion';
import { useIsDesktop } from '@/components/ui/sheet';

/** `key`: toasts with the same key (e.g. one conversation) replace each other instead of stacking. */
type Opts = { title?: string; subtitle?: string; onClick?: () => void; key?: string };
type Toast = { id: number; text: string; icon?: React.ReactNode } & Opts;
type Show = (text: string, icon?: React.ReactNode, opts?: Opts) => void;
const Ctx = createContext<Show>(() => undefined);

const MAX = 3;
const LIFE_MS = 5000;
const OFFSET = 8;

/**
 * Small messages: bottom right on desktop, above the bottom bar on phones (clear of page controls). They hide after
 * 5 s and stack at most 3: older ones sit 8px behind and slightly smaller, so they never overlap
 * exactly. Each has one close button; tapping a toast with an action opens it.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const desktop = useIsDesktop();
  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id)); timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);
  const show = useCallback<Show>((text, icon, opts) => {
    const id = Date.now() + Math.random();
    setToasts((list) => {
      const replaced = opts?.key ? list.filter((t) => t.key === opts.key) : [];
      for (const t of replaced) { clearTimeout(timers.current.get(t.id)); timers.current.delete(t.id); }
      const rest = list.filter((t) => !replaced.includes(t));
      return [...rest.slice(-(MAX - 1)), { id, text, icon, ...opts }];
    });
    timers.current.set(id, setTimeout(() => dismiss(id), LIFE_MS));
  }, [dismiss]);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className={desktop
        ? 'pointer-events-none fixed right-6 bottom-6 z-[90] w-[360px]'
        : 'pointer-events-none fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[90]'}>
        <div className="relative">
          <AnimatePresence initial={false}>
            {toasts.map((t, i) => {
              const depth = toasts.length - 1 - i; // 0 = newest, in front
              const rich = Boolean(t.title);
              const body = (
                <>
                  {t.icon ? <span className="shrink-0">{t.icon}</span> : null}
                  <span className="min-w-0 flex-1 text-left">
                    {t.title ? <b className="block truncate text-[13.5px]">{t.title}</b> : null}
                    {t.subtitle ? <span className="block truncate text-[12px] font-semibold text-muted">{t.subtitle}</span> : null}
                    <span className={rich ? 'mt-0.5 line-clamp-2 text-[13.5px] font-medium' : ''}>{t.text}</span>
                  </span>
                </>
              );
              return (
                <m.div key={t.id} layout
                  initial={desktop ? { opacity: 0, x: 48, scale: 0.96 } : { opacity: 0, y: 28, scale: 0.92 }}
                  animate={{ opacity: depth > 2 ? 0 : 1 - depth * 0.08, x: 0, y: -depth * OFFSET, scale: 1 - depth * 0.04, transition: spring.bouncy }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                  style={{ zIndex: 10 - depth, position: depth === 0 ? 'relative' : 'absolute', inset: depth === 0 ? undefined : 'auto 0 0 0', transformOrigin: 'bottom center' }}
                  className={`glass pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl border border-line px-3.5 py-3 text-[14px] font-semibold text-ink shadow-lift ${depth ? 'pointer-events-none' : ''}`}>
                  {t.onClick ? <button type="button" onClick={() => { t.onClick?.(); dismiss(t.id); }} className="flex min-w-0 flex-1 items-center gap-2.5">{body}</button> : <span className="flex min-w-0 flex-1 items-center gap-2.5">{body}</span>}
                  <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-mist"><X size={14} /></button>
                </m.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
