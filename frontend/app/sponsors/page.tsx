'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Handshake, MapPin, Users, Video } from 'lucide-react';

import {
  listSponsorshipOpenEvents,
  resolveEventImageUrl,
  type SponsorshipOpenEvent,
} from '../../components/guildos/event-api';

function whenLabel(value: string | null) {
  if (!value) return 'Date TBA';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date TBA';
  return `${d.toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function typeLabel(t: string) {
  return t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SponsorshipBrowsePage() {
  const [events, setEvents] = useState<SponsorshipOpenEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await listSponsorshipOpenEvents();
        if (!cancelled) setEvents(response.events);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load sponsorship listings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <header className="bg-gradient-to-br from-indigo-700 to-sky-600 px-4 py-14 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur"><Handshake className="h-4 w-4" /> Sponsor student events</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Put your brand in front of verified student audiences</h1>
          <p className="mt-3 max-w-2xl text-sm text-indigo-100 sm:text-base">
            Every event on GuildOS tracks real registrations and verified attendance — so you know exactly what reach you&apos;re paying for.
            Pick an event, choose a package, and the organizers will get back to you.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-3xl bg-white dark:bg-slate-900" />)}
          </div>
        ) : events.length ? (
          <>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{events.length} event{events.length === 1 ? '' : 's'} seeking sponsorship</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <Link
                  key={event._id}
                  href={`/events/${event.slug}`}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="relative h-32 bg-gradient-to-br from-indigo-600 to-sky-500">
                    {event.bannerImage ? <img src={resolveEventImageUrl(event.bannerImage)} alt={event.title} className="h-full w-full object-cover" /> : null}
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 shadow-sm backdrop-blur">Seeking sponsors</span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{typeLabel(event.type)}</p>
                    <h3 className="mt-1 line-clamp-1 font-semibold text-slate-950 dark:text-white">{event.title}</h3>
                    {event.community ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        by {event.community.name}
                        {event.respondsQuickly ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700" title="This organizer typically responds to sponsorship inquiries within 72 hours">⚡ Responds quickly</span>
                        ) : null}
                      </p>
                    ) : null}
                    {event.sponsorshipPitch ? <p className="mt-2 line-clamp-2 flex-1 text-sm text-slate-500 dark:text-slate-400">{event.sponsorshipPitch}</p> : <span className="flex-1" />}
                    {event.sponsorshipPackages.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {event.sponsorshipPackages.slice(0, 3).map((pkg) => (
                          <span key={pkg.name} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700">
                            {pkg.name}{pkg.price ? ` · ${pkg.price}` : ''}
                          </span>
                        ))}
                        {event.sponsorshipPackages.length > 3 ? (
                          <span className="rounded-full bg-slate-100 dark:bg-slate-950 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">+{event.sponsorshipPackages.length - 3} more</span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:text-slate-400">
                      <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{whenLabel(event.startDate)}</span></p>
                      <p className="flex items-center gap-1.5">
                        {event.mode === 'VIRTUAL' ? <Video className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{event.mode === 'VIRTUAL' ? 'Online event' : event.venue || 'Venue TBA'}</span>
                      </p>
                      <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 shrink-0" /> {event.registrationCount} registered</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
            <Handshake className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No events are seeking sponsorship right now. Check back soon.</p>
          </div>
        )}
      </main>
    </div>
  );
}
