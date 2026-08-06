import Link from 'next/link';
import { CalendarDays } from 'lucide-react';

export type DashboardEventItem = {
  id: string;
  title: string;
  slug: string;
  communityName: string;
  dateLabel: string;
  venue: string;
  registered: number;
  statusLabel: string;
  statusTone: 'live' | 'scheduled' | 'draft';
};

const toneStyles: Record<DashboardEventItem['statusTone'], string> = {
  live: 'bg-emerald-50 text-emerald-700',
  scheduled: 'bg-indigo-50 text-indigo-700',
  draft: 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400',
};

export function DashboardUpcomingEvents({ events, createHref = '/dashboard/events/create' }: { events: DashboardEventItem[]; createHref?: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Upcoming Events</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Publish, manage attendance, and launch projector mode.</p>
        </div>
        <Link href={createHref} className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800">
          Create event
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {events.length ? (
          events.map((event) => (
            <article key={event.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/70">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-slate-950 dark:text-white">{event.title}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{event.dateLabel} · {event.venue || 'Venue TBA'} · {event.communityName}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span className="rounded-full bg-slate-100 dark:bg-slate-950 px-3 py-1">{event.registered} registered</span>
                  <span className={`rounded-full px-3 py-1 ${toneStyles[event.statusTone]}`}>{event.statusLabel}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/events/${event.slug}`} className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800">Manage</Link>
                <Link href="/dashboard/events/scanner" className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800">Check-in Scanner</Link>
                <Link href="/dashboard/events/projector" className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100">Projector Mode</Link>
              </div>
            </article>
          ))
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
            <CalendarDays className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No upcoming events yet.</p>
            <Link href={createHref} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">Create your first event</Link>
          </div>
        )}
      </div>
    </section>
  );
}