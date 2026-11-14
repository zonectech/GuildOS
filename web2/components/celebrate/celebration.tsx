'use client';
import { useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { spring } from '@/lib/motion';

/**
 * Full-screen moment, only for the big ones (community approved, event published, attendance finalized):
 * the seal slams down with a squash, a soft ink ring spreads, confetti bursts. Tap anywhere or the button to continue.
 */
export function Celebration({ open, seal, title, body, action, onClose }: {
  open: boolean; seal: React.ReactNode; title: string; body: React.ReactNode; action: React.ReactNode; onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { void import('./confetti').then((c) => c.burst({ y: 0.32 })); if (navigator.vibrate) navigator.vibrate([12, 40, 18]); }, 380);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => { clearTimeout(t); document.removeEventListener('keydown', key); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <m.div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[110] grid place-items-center bg-[rgb(10_13_11/.62)] px-6 backdrop-blur-md"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="flex max-w-md flex-col items-center gap-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="relative grid place-items-center">
              {/* Ink spreading where the seal lands. */}
              <m.span aria-hidden="true" className="absolute size-48 rounded-full bg-green-text/30" initial={{ scale: 0, opacity: 0.6 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ delay: 0.36, duration: 0.9, ease: 'easeOut' }} />
              <m.div initial={{ scale: 2.6, rotate: -32, y: -70, opacity: 0 }} animate={{ scale: [2.6, 0.84, 1.06, 1], rotate: -8, y: 0, opacity: 1 }}
                transition={{ duration: 0.62, times: [0, 0.58, 0.8, 1], ease: 'easeOut' }}>
                {seal}
              </m.div>
            </div>
            <m.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { ...spring.soft, delay: 0.55 } }} className="text-[34px] font-extrabold text-white">{title}</m.h2>
            <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { ...spring.soft, delay: 0.65 } }} className="text-[16px] text-white/80">{body}</m.div>
            <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { ...spring.soft, delay: 0.75 } }}>{action}</m.div>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
