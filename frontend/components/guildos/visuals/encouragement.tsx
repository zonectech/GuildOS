'use client';

import { useEffect, useState } from 'react';
import { PeopleCluster } from './illustrated-people';

/** Rotating one-liners with a little crowd beside them. Static for reduced-motion users. */
export function Encouragement({ lines, tone = 'light', size = 30 }: { lines: string[]; tone?: 'light' | 'card'; size?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (lines.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % lines.length), 3800);
    return () => window.clearInterval(timer);
  }, [lines.length]);

  return (
    <div className={`flex items-center gap-3 ${tone === 'card' ? 'rounded-2xl bg-indigo-50/80 px-3 py-2.5 dark:bg-indigo-500/10' : ''}`}>
      <PeopleCluster count={4} size={size} offset={index} />
      <p key={index} className="min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200" style={{ animation: 'rise .45s ease both' }} aria-live="polite">
        {lines[index]}
      </p>
    </div>
  );
}
