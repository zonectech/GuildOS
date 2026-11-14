'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { X } from 'lucide-react';
import { spring } from '@/lib/motion';

export function useIsDesktop(query = '(min-width: 1024px)') {
  const [desk, setDesk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDesk(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return desk;
}

/**
 * A bottom sheet on phones (drag the handle down to close) and a side panel on desktop.
 * Escape and tapping the backdrop close it; the page behind does not scroll while it is open.
 */
export function Sheet({ open, onClose, title, children, side = 'right', width = 440 }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; side?: 'right' | 'left'; width?: number;
}) {
  const desk = useIsDesktop();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    panel.current?.focus();
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', key); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={title}>
          <m.div className="absolute inset-0 bg-[rgb(10_13_11/.45)] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          {desk ? (
            <m.div ref={panel} tabIndex={-1} className={`absolute inset-y-3 ${side === 'right' ? 'right-3' : 'left-3'} flex flex-col overflow-hidden rounded-[26px] border border-line bg-raised shadow-lift outline-none`}
              style={{ width }} initial={{ x: side === 'right' ? width + 40 : -width - 40 }} animate={{ x: 0, transition: spring.sheet }} exit={{ x: side === 'right' ? width + 40 : -width - 40, transition: { duration: 0.22 } }}>
              <Head title={title} onClose={onClose} />
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent>{children}</div>
            </m.div>
          ) : (
            <m.div ref={panel} tabIndex={-1} className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-line bg-raised shadow-lift outline-none"
              initial={{ y: '100%' }} animate={{ y: 0, transition: spring.sheet }} exit={{ y: '100%', transition: { duration: 0.22 } }}
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 110 || i.velocity.y > 600) onClose(); }}>
              <div className="flex justify-center pt-2.5 pb-1" aria-hidden="true"><span className="h-1.5 w-11 rounded-full bg-line" /></div>
              <Head title={title} onClose={onClose} />
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]" onPointerDownCapture={(e) => e.stopPropagation()}>{children}</div>
            </m.div>
          )}
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function Head({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3">
      <h2 className="text-[22px] font-extrabold">{title}</h2>
      <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-mist text-muted transition-colors hover:text-ink"><X size={18} /></button>
    </div>
  );
}
