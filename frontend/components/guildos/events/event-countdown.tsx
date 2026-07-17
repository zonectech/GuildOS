'use client';

import { useEffect, useState } from 'react';
import { Radio, Timer } from 'lucide-react';

function formatLeft(ms: number) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000) % 24;
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

/**
 * Live countdown chip for the event page hero:
 *  - upcoming  → "Starts in 2d 4h 12m" (ticks; every second inside the final hour)
 *  - start passed but doors not open → "Starting any moment"
 *  - live (CHECK_IN / CHECK_OUT) → pulsing "Live now"
 *  - over → renders nothing (the page already shows the final status)
 */
export function EventCountdown({ startDate, status }: { startDate: string | null; status: string }) {
  const [now, setNow] = useState(() => Date.now());
  const start = startDate ? new Date(startDate).getTime() : null;
  const live = status === 'CHECK_IN' || status === 'CHECK_OUT';
  const upcoming = !live && status === 'PUBLISHED' && start !== null;

  useEffect(() => {
    if (!live && !upcoming) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live, upcoming]);

  if (live) {
    return (
      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
        <Radio className="h-3.5 w-3.5 animate-pulse" /> Live now
      </span>
    );
  }
  if (!upcoming || start === null) return null;

  const msLeft = start - now;
  return (
    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 tabular-nums">
      <Timer className="h-3.5 w-3.5" />
      {msLeft > 0 ? `Starts in ${formatLeft(msLeft)}` : 'Starting any moment'}
    </span>
  );
}
