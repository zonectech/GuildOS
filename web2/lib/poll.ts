'use client';
import { useEffect, useRef } from 'react';

/**
 * Runs `check` every `base` ms while the tab is visible. Pauses when the tab is hidden or the phone is
 * locked, and backs off (up to 4×) while nothing changes. `check` returns true when something changed.
 */
export function usePoll(check: () => Promise<boolean>, base: number, enabled = true) {
  const fn = useRef(check);
  fn.current = check;
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = base;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState !== 'visible') return; // resumes on visibilitychange
      const changed = await fn.current().catch(() => false);
      delay = changed ? base : Math.min(delay * 1.5, base * 4);
      timer = setTimeout(tick, delay);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') { clearTimeout(timer); delay = base; void tick(); }
      else clearTimeout(timer);
    };
    timer = setTimeout(tick, base);
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [base, enabled]);
}
