'use client';
import { useEffect } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import { SessionProvider } from '@/lib/session';
import { ToastProvider } from '@/components/ui/toast';

const loadFeatures = () => import('@/lib/motion-features').then((r) => r.default);

/** Smooth scrolling on desktops with a mouse only; phones keep native scrolling. Skipped for reduced motion. */
function useDesktopSmoothScroll() {
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || calm) return;
    let stop = () => undefined as void;
    void import('lenis').then(({ default: Lenis }) => {
      const lenis = new Lenis({ lerp: 0.12, smoothWheel: true });
      let raf = 0;
      const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      stop = () => { cancelAnimationFrame(raf); lenis.destroy(); };
    });
    return () => stop();
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useDesktopSmoothScroll();
  return (
    // reducedMotion="user": with "reduce motion" on, movement becomes simple fades.
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures} strict>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </LazyMotion>
    </MotionConfig>
  );
}
