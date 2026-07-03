'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import {
  getMyCertificates,
  listEvents,
  resolveEventImageUrl,
  type CertificateSummary,
  type EventSummary,
} from '../../components/guildos/event-api';
import { StudentNav } from '../../components/guildos/student-nav';

export default function EventsDiscoveryPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [certificates, setCertificates] = useState<CertificateSummary[]>([]);
  const [error, setError] = useState('');

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

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav active="/events" />
      <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Discover Events</h1>
          <p className="mt-1 text-sm text-slate-500">Register for events from communities across GuildOS.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/my-events" className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900">My Events</a>
        </div>
      </header>
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {certificates.length ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Your Certificates</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {certificates.map((c) => (
              <Link key={c.serial} href={`/certificates/${c.serial}`} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm hover:border-indigo-300">
                <p className="font-medium text-slate-900">{c.eventTitle}</p>
                <p className="text-slate-500">{c.communityName} · {new Date(c.issuedAt).toLocaleDateString()}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {events.length ? (
          events.map((event) => (
            <Link key={event._id} href={`/events/${event.slug}`} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
              <div className="h-36 bg-gradient-to-r from-indigo-600 to-sky-500">
                {event.bannerImage ? <img src={resolveEventImageUrl(event.bannerImage)} alt={event.title} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="p-5">
                <p className="text-xs font-medium text-indigo-600">{event.type.replace(/_/g, ' ')} · {event.mode}</p>
                <h3 className="mt-1 font-semibold text-slate-950">{event.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{event.shortDescription}</p>
                <p className="mt-3 text-sm text-slate-600">{event.startDate ? new Date(event.startDate).toLocaleDateString() : 'Date TBA'}</p>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-sm text-slate-500">No public events available yet.</p>
        )}
      </section>
    </main>
    </div>
  );
}
