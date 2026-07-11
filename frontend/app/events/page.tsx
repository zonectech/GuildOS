'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, CalendarDays, MapPin, Video, Users, Ticket, Award, BadgeCheck, Download } from 'lucide-react';

import {
  getMyCertificates,
  listEvents,
  resolveEventImageUrl,
  type CertificateSummary,
  type EventSummary,
} from '../../components/guildos/event-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { Button } from '../../components/guildos/ui/button';
import { EmptyState, PageHeader, PageShell, Surface } from '../../components/guildos/ui/page';
import { SearchField } from '../../components/guildos/ui/forms';
import { FilterPills } from '../../components/guildos/ui/filter-pills';

const MODE_LABEL: Record<string, string> = { PHYSICAL: 'In person', HYBRID: 'Hybrid', VIRTUAL: 'Online' };

const CERT_TYPE_LABEL: Record<string, string> = {
  ATTENDANCE: 'Certificate of Attendance',
  COMPLETION: 'Certificate of Completion',
  LEADERSHIP: 'Certificate of Leadership',
  VOLUNTEER: 'Certificate of Volunteering',
};

const CERT_TYPE_ACCENT: Record<string, string> = {
  ATTENDANCE: 'from-indigo-600 to-sky-500',
  COMPLETION: 'from-emerald-600 to-teal-500',
  LEADERSHIP: 'from-amber-500 to-orange-500',
  VOLUNTEER: 'from-rose-500 to-pink-500',
};

function typeLabel(t: string) {
  return t === 'All' ? 'All' : t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function dateBadge(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return { day: d.getDate(), month: d.toLocaleString(undefined, { month: 'short' }) };
}

function whenLabel(value: string | null) {
  if (!value) return 'Date TBA';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date TBA';
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function EventsDiscoveryPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [certificates, setCertificates] = useState<CertificateSummary[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('All');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await listEvents();
        if (!cancelled) setEvents(response.events);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load events');
      }
      try {
        const mine = await getMyCertificates();
        if (!cancelled) setCertificates(mine.certificates);
      } catch {
        /* not logged in — ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const types = useMemo(() => ['All', ...Array.from(new Set(events.map((e) => e.type).filter((type): type is string => Boolean(type))))], [events]);
  const sorted = useMemo(
    () =>
      [...events].sort((a, b) => {
        const ta = a.startDate ? new Date(a.startDate).getTime() : Infinity;
        const tb = b.startDate ? new Date(b.startDate).getTime() : Infinity;
        return ta - tb;
      }),
    [events],
  );
  const filtered = sorted.filter((e) => {
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
            <Button asChild href="/my-events" variant="secondary" className="shrink-0">
              <Ticket className="h-4 w-4" /> My events
            </Button>
          </>
        }
      />

      <FilterPills items={types} active={activeType} onChange={setActiveType} getLabel={typeLabel} />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {certificates.length ? (
        <Surface className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-700">
                <Award className="h-4 w-4" />
                <h2 className="text-sm font-semibold">Your certificates</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{certificates.length}</span>
              </div>
              <p className="text-xs text-slate-400">Open a certificate to view, verify, or download it</p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {certificates.map((c) => {
                const revoked = c.status === 'REVOKED';
                return (
                  <Link
                    key={c.serial}
                    href={`/certificates/${c.serial}`}
                    className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${revoked ? 'border-red-200 opacity-70' : 'border-slate-200 hover:border-indigo-300'}`}
                  >
                    <div className={`h-1.5 bg-gradient-to-r ${CERT_TYPE_ACCENT[c.type] ?? 'from-indigo-600 to-sky-500'}`} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white ${CERT_TYPE_ACCENT[c.type] ?? 'from-indigo-600 to-sky-500'}`}>
                          <Award className="h-5 w-5" />
                        </div>
                        {revoked ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Revoked</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <BadgeCheck className="h-3 w-3" /> Verified
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{CERT_TYPE_LABEL[c.type] ?? 'Certificate'}</p>
                      <h3 className="mt-0.5 line-clamp-2 font-semibold text-slate-950">{c.eventTitle}</h3>
                      <p className="mt-1 truncate text-xs text-slate-500">{c.communityName}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
                        <span className="text-[11px] text-slate-400">Issued {new Date(c.issuedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100">
                          <Download className="h-3 w-3" /> View &amp; download
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
        </Surface>
      ) : null}

      {filtered.length ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-400">{filtered.length} {filtered.length === 1 ? 'event' : 'events'}</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => {
              const badge = dateBadge(event.startDate);
              const spotsLeft = event.capacity > 0 ? Math.max(0, event.capacity - event.registrationCount) : null;
              const live = event.status === 'CHECK_IN' || event.status === 'CHECK_OUT';
              const ended = event.status === 'COMPLETED' || event.status === 'ARCHIVED';
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
                    {live ? <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">● Live now</span> : ended ? <span className="absolute bottom-3 left-3 rounded-full bg-slate-900/70 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">Ended</span> : null}
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
          description={`No events found${search.trim() || activeType !== 'All' ? ' for this filter' : ' yet'}. Check back soon.`}
        />
      )}
    </PageShell>
  );
}
