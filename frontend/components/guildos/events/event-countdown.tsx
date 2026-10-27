'use client';

import { useEffect, useState } from 'react';
import { Radio, Timer } from 'lucide-react';
import { attendancePending, eventLifecycle, type EventSchedule } from './event-lifecycle';

function formatLeft(ms: number) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000) % 24;
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

/** Schedule-only status. Check-in and registration keep their separate organizer controls. */
export function EventCountdown(event: EventSchedule) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const lifecycle = eventLifecycle(event, now);
  if (lifecycle === 'DRAFT') return null;
  const live = lifecycle === 'LIVE';
  const label = live ? 'Live now'
    : lifecycle === 'CANCELLED' ? 'Cancelled'
    : lifecycle === 'POSTPONED' ? 'Postponed — awaiting a new date'
    : lifecycle === 'ANNOUNCED' ? 'Coming soon'
    : lifecycle === 'ENDED' ? attendancePending(event) ? 'Ended — attendance pending' : 'Ended — attendance finalized'
    : event.startDate && Number.isFinite(Date.parse(event.startDate)) ? 'Upcoming · Starts in ' + formatLeft(Math.max(0, Date.parse(event.startDate) - now)) : 'Upcoming · Date to be announced';
  return <span role="status" className={live
    ? 'mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white'
    : 'mt-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 tabular-nums dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300'}>
    {live ? <Radio className="h-3.5 w-3.5 animate-pulse" /> : <Timer className="h-3.5 w-3.5" />}{label}
  </span>;
}
