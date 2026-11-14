'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
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
      // Shared so code that jumps the page (returning to a list) moves Lenis too, not just the window.
      (window as unknown as { __lenis?: typeof lenis }).__lenis = lenis;
      let raf = 0;
      const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      stop = () => { cancelAnimationFrame(raf); lenis.destroy(); delete (window as unknown as { __lenis?: unknown }).__lenis; };
    });
    return () => stop();
  }, []);
}

/** After every page change, the smooth scroller re-measures the new page, so it never stops short. */
function useRemeasureOnNavigate() {
  const path = usePathname();
  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: { resize: () => void } }).__lenis;
    if (!lenis) return;
    lenis.resize();
    const t = setTimeout(() => lenis.resize(), 300);
    return () => clearTimeout(t);
  }, [path]);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useDesktopSmoothScroll();
  useRemeasureOnNavigate();
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
