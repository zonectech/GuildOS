'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Bookmark, CalendarDays, MapPin, Video, Users, Ticket } from 'lucide-react';

import {
  listEvents,
  resolveEventImageUrl,
  type EventSummary,
} from '../../components/guildos/event-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { Button } from '../../components/guildos/ui/button';
import { EmptyState, PageHeader, PageShell } from '../../components/guildos/ui/page';
import { SearchField } from '../../components/guildos/ui/forms';
import { FilterPills } from '../../components/guildos/ui/filter-pills';

const MODE_LABEL: Record<string, string> = { PHYSICAL: 'In person', HYBRID: 'Hybrid', VIRTUAL: 'Online' };

/**
 * Student-facing lifecycle bucket:
 *  - LIVE       doors open right now (CHECK_IN / CHECK_OUT)
 *  - UPCOMING   published and still ahead — the ones you can register for
 *  - ENDED      finished (COMPLETED, archived-after-completion, or date passed)
 *  - CANCELLED  organizer cancelled it (reason shown on the event page)
 */
type EventBucket = 'LIVE' | 'UPCOMING' | 'ENDED' | 'CANCELLED';

function bucketOf(event: EventSummary): EventBucket {
  if (event.status === 'ARCHIVED' && event.cancellationReason) return 'CANCELLED';
  if (event.status === 'CHECK_IN' || event.status === 'CHECK_OUT') return 'LIVE';
  if (event.status === 'COMPLETED' || event.status === 'ARCHIVED') return 'ENDED';
  // PUBLISHED but the end date already passed = effectively over (finalizer will catch up).
  if (event.endDate && new Date(event.endDate).getTime() < Date.now()) return 'ENDED';
  return 'UPCOMING';
}

const STATUS_FILTERS = ['Upcoming & Live', 'Ended', 'Cancelled', 'All'] as const;

function typeLabel(t: string) {
  return t === 'All' ? 'All' : t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function dateBadge(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return { day: d.getDate(), month: d.toLocaleString(undefined, { month: 'short' }) };
}

function relativeHint(d: Date) {
  const today = new Date();
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000,
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff <= 30) return `In ${diff} days`;
  return '';
}

function whenLabel(value: string | null) {
  if (!value) return 'Date TBA';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date TBA';
  const base = `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const hint = relativeHint(d);
  return hint ? `${base} · ${hint}` : base;
}

export default function EventsDiscoveryPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('All');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('Upcoming & Live');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await listEvents();
        if (!cancelled) setEvents(response.events);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load events');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const types = useMemo(() => ['All', ...Array.from(new Set(events.map((e) => e.type).filter((type): type is string => Boolean(type))))], [events]);
  // Order that matches how students think: what's happening NOW first, then the
  // soonest upcoming; ended/cancelled (when filtered to) show most recent first.
  const sorted = useMemo(() => {
    const rank: Record<EventBucket, number> = { LIVE: 0, UPCOMING: 1, ENDED: 2, CANCELLED: 3 };
    return [...events].sort((a, b) => {
      const ba = bucketOf(a);
      const bb = bucketOf(b);
      if (rank[ba] !== rank[bb]) return rank[ba] - rank[bb];
      const ta = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const tb = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      // Upcoming/live: soonest first. Past: most recent first.
      return ba === 'ENDED' || ba === 'CANCELLED' ? tb - ta : ta - tb;
    });
  }, [events]);

  const filtered = sorted.filter((e) => {
    const bucket = bucketOf(e);
    if (statusFilter === 'Upcoming & Live' && bucket !== 'UPCOMING' && bucket !== 'LIVE') return false;
    if (statusFilter === 'Ended' && bucket !== 'ENDED') return false;
    if (statusFilter === 'Cancelled' && bucket !== 'CANCELLED') return false;
    if (activeType !== 'All' && e.type !== activeType) return false;
    if (!search.trim()) return true;
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return rx.test(e.title) || rx.test(e.shortDescription ?? '') || rx.test(e.venue ?? '') || rx.test(e.type ?? '');
  });

  return (
    <PageShell nav={<StudentNav active="/events" />}>
      <PageHeader
        eyebrow="Events"
        title="Discover events"
        description="Workshops, hackathons, and meetups from communities across GuildOS."
        action={
          <>
            <SearchField
              icon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events"
            />
            <Button asChild href="/events/saved" variant="secondary" className="shrink-0">
              <Bookmark className="h-4 w-4" /> Saved
            </Button>
            <Button asChild href="/my-events" variant="secondary" className="shrink-0">
              <Ticket className="h-4 w-4" /> My events
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills items={[...STATUS_FILTERS]} active={statusFilter} onChange={(v) => setStatusFilter(v as (typeof STATUS_FILTERS)[number])} />
        <select
          value={activeType}
          onChange={(e) => setActiveType(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:border-indigo-300"
          title="Filter by event type"
        >
          {types.map((t) => (
            <option key={t} value={t}>{t === 'All' ? 'All types' : typeLabel(t)}</option>
          ))}
        </select>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {filtered.length ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-400">{filtered.length} {filtered.length === 1 ? 'event' : 'events'}</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => {
              const badge = dateBadge(event.startDate);
              const spotsLeft = event.capacity > 0 ? Math.max(0, event.capacity - event.registrationCount) : null;
              const bucket = bucketOf(event);
              return (
                <Link
                  key={event._id}
                  href={`/events/${event.slug}`}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="relative h-36 bg-gradient-to-br from-indigo-600 to-sky-500">
                    {event.bannerImage ? <img src={resolveEventImageUrl(event.bannerImage)} alt={event.title} className="h-full w-full object-cover" /> : null}
                    {badge ? (
                      <div className="absolute left-3 top-3 grid place-items-center rounded-xl bg-white/95 px-2.5 py-1 text-center shadow-sm backdrop-blur">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">{badge.month}</span>
                        <span className="text-lg font-bold leading-none text-slate-900">{badge.day}</span>
                      </div>
                    ) : null}
                    <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">{MODE_LABEL[event.mode] ?? event.mode}</span>
                    {bucket === 'LIVE' ? (
                      <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">● Live now</span>
                    ) : bucket === 'CANCELLED' ? (
                      <span className="absolute bottom-3 left-3 rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">Cancelled</span>
                    ) : bucket === 'ENDED' ? (
                      <span className="absolute bottom-3 left-3 rounded-full bg-slate-900/70 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">Ended</span>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{typeLabel(event.type)}</p>
                    <h3 className="mt-1 line-clamp-1 font-semibold text-slate-950">{event.title}</h3>
                    <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">{event.shortDescription}</p>
                    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{whenLabel(event.startDate)}</span></p>
                      <p className="flex items-center gap-1.5">
                        {event.mode === 'VIRTUAL' ? <Video className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{event.mode === 'VIRTUAL' ? 'Online event' : event.venue || 'Venue TBA'}</span>
                      </p>
                      <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 shrink-0" /> {event.registrationCount} registered{spotsLeft !== null ? ` · ${spotsLeft === 0 ? 'Full' : `${spotsLeft} spots left`}` : ''}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          description={`No ${statusFilter === 'All' ? '' : `${statusFilter.toLowerCase()} `}events found${search.trim() || activeType !== 'All' ? ' for this filter' : ' yet'}. Check back soon.`}
        />
      )}
    </PageShell>
  );
}
