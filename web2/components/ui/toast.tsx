'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { spring } from '@/lib/motion';

type Toast = { id: number; text: string; icon?: React.ReactNode };
const Ctx = createContext<(text: string, icon?: React.ReactNode) => void>(() => undefined);

/** Small messages that slide up and bounce in at the bottom, then leave on their own. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string, icon?: React.ReactNode) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { id, text, icon }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3600);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <m.div key={t.id} layout initial={{ opacity: 0, y: 24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1, transition: spring.bouncy }} exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.18 } }}
              className="glass pointer-events-auto flex items-center gap-2.5 rounded-full border border-line px-4 py-2.5 text-[14px] font-semibold text-ink shadow-lift">
              {t.icon}{t.text}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
