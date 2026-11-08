'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as m from 'motion/react-m';
import { ArrowLeft, Share2, X } from 'lucide-react';
import { spring } from '@/lib/motion';
import { useIsDesktop } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { EventView } from './event-view';

/**
 * An event opened from a list shows on top of it, with its own URL. Closing goes back in history, so the
 * list underneath never unmounts and keeps its scroll position. Opening the URL directly shows the full page.
 */
export function EventOverlay({ slug }: { slug: string }) {
  const router = useRouter();
  const desk = useIsDesktop();
  const toast = useToast();
  const box = useRef<HTMLDivElement>(null);
  const close = () => router.back();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') router.back(); };
    document.addEventListener('keydown', key);
    box.current?.focus();
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', key); };
  }, [router]);

  const share = async () => {
    const url = `${window.location.origin}/events/${slug}`;
    try { if (navigator.share) await navigator.share({ url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { /* dismissed */ }
  };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Event">
      <m.div className="absolute inset-0 bg-[rgb(10_13_11/.5)] backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={close} />
      <m.div ref={box} tabIndex={-1} data-lenis-prevent
        initial={desk ? { opacity: 0, scale: 0.94, y: 24 } : { y: '100%' }}
        animate={desk ? { opacity: 1, scale: 1, y: 0, transition: spring.sheet } : { y: 0, transition: spring.sheet }}
        className="absolute inset-x-0 bottom-0 top-[max(2.5dvh,12px)] overflow-y-auto overscroll-contain rounded-t-[28px] bg-paper shadow-lift outline-none lg:inset-x-auto lg:top-6 lg:bottom-6 lg:left-1/2 lg:w-[min(1120px,calc(100vw-80px))] lg:-translate-x-1/2 lg:rounded-[30px] lg:border lg:border-line">
        <div className="glass sticky top-0 z-20 flex items-center justify-between border-b border-[color-mix(in_srgb,var(--line)_70%,transparent)] px-3 py-2.5 lg:px-5">
          <button type="button" onClick={close} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[14.5px] font-semibold hover:bg-mist"><ArrowLeft size={18} />Events</button>
          <div className="flex gap-1">
            <button type="button" onClick={share} aria-label="Share" className="grid size-10 place-items-center rounded-full hover:bg-mist"><Share2 size={18} /></button>
            <button type="button" onClick={close} aria-label="Close" className="grid size-10 place-items-center rounded-full hover:bg-mist"><X size={19} /></button>
          </div>
        </div>
        <EventView slug={slug} scroller={box} />
      </m.div>
    </div>
  );
}
