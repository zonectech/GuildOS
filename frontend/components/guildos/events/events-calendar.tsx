'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type CalendarEntry = {
  id: string;
  title: string;
  slug: string;
  date: string; // ISO date of the event start
  endDate?: string | null; // multi-day events span start → end
  tone: 'registered' | 'saved';
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Visual month calendar for the my-events page. Registered events show as
 * indigo chips, saved-for-later ones as amber. Multi-day events appear on every
 * day they span. Pure client-side view over data the page already fetched.
 */
export function EventsCalendar({ entries }: { entries: CalendarEntry[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const start = new Date(entry.date);
      if (Number.isNaN(start.getTime())) continue;
      const end = entry.endDate ? new Date(entry.endDate) : start;
      const spanEnd = Number.isNaN(end.getTime()) || end < start ? start : end;
      // Cap the span at 31 days so a bad endDate can never wedge the loop.
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      for (let i = 0; i < 31 && cur <= spanEnd; i += 1) {
        const key = dayKey(cur);
        const list = map.get(key) ?? [];
        if (!list.some((e) => e.id === entry.id)) list.push(entry);
        map.set(key, list);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [entries]);

  // Build the visible grid: weeks starting Monday, spanning the whole month.
  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // back to Monday
    const out: Date[][] = [];
    const cur = new Date(gridStart);
    do {
      const week: Date[] = [];
      for (let i = 0; i < 7; i += 1) {
        week.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      out.push(week);
    } while (cur.getMonth() === cursor.getMonth());
    return out;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
  const todayKey = dayKey(today);

  return (
    <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-200 text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-slate-50 dark:bg-slate-900 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {d}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const key = dayKey(day);
          const inMonth = day.getMonth() === cursor.getMonth();
          const events = byDay.get(key) ?? [];
          return (
            <div key={key} className={`min-h-[72px] p-1 text-left align-top sm:min-h-[84px] ${inMonth ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900'}`}>
              <span
                className={`ml-1 inline-grid h-6 w-6 place-items-center rounded-full text-xs ${
                  key === todayKey ? 'bg-indigo-600 font-bold text-white' : inMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300'
                }`}
              >
                {day.getDate()}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {events.slice(0, 3).map((e) => (
                  <Link
                    key={e.id}
                    href={`/events/${e.slug}`}
                    title={e.title}
                    className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${
                      e.tone === 'registered' ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {e.title}
                  </Link>
                ))}
                {events.length > 3 ? <p className="px-1 text-[10px] text-slate-400 dark:text-slate-500">+{events.length - 3} more</p> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-200" /> Registered</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-200" /> Saved</span>
      </div>
    </section>
  );
}
