'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getCurrentUser } from '../../components/guildos/auth-api';
import {
  cancelRegistration,
  getMyEventRegistrations,
  getMyUpcomingEvents,
  type MyRegistrationEntry,
  type UpcomingEventEntry,
} from '../../components/guildos/event-api';
import { StudentNav } from '../../components/guildos/student-nav';

function statusClass(status: string) {
  if (status === 'COMPLETED' || status === 'CHECKED_OUT') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CHECKED_IN') return 'bg-indigo-50 text-indigo-700';
  if (status === 'WAITLISTED' || status === 'PENDING_APPROVAL' || status === 'PARTIAL_ATTENDANCE') return 'bg-amber-50 text-amber-700';
  if (status === 'CANCELLED' || status === 'REJECTED') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

const ACTIVE = ['CONFIRMED', 'PENDING_APPROVAL', 'WAITLISTED', 'CHECKED_IN'];

export default function MyEventsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [upcoming, setUpcoming] = useState<UpcomingEventEntry[]>([]);
  const [registrations, setRegistrations] = useState<MyRegistrationEntry[]>([]);

  async function load() {
    const [up, regs] = await Promise.all([getMyUpcomingEvents(), getMyEventRegistrations()]);
    setUpcoming(up.events);
    setRegistrations(regs.registrations);
  }

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load your events');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleCancel(eventId: string) {
    if (!window.confirm('Cancel this registration?')) return;
    try {
      setBusyId(eventId);
      setError('');
      await cancelRegistration(eventId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel');
    } finally {
      setBusyId('');
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-4xl px-4 py-10"><p className="text-slate-500">Loading your events…</p></main>;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav active="/events" />
      <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">My Events</h1>
        <p className="mt-1 text-sm text-slate-500">Your upcoming events and registration history.</p>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Upcoming</h2>
        <div className="mt-4 space-y-3">
          {upcoming.length ? (
            upcoming.map((e) => (
              <a key={e.id} href={`/events/${e.slug}`} className="flex flex-col gap-1 rounded-2xl border border-slate-200 px-4 py-3 hover:border-indigo-300 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-slate-900">{e.title}</p>
                  <p className="text-sm text-slate-500">{e.startDate ? new Date(e.startDate).toLocaleString() : 'TBA'} · {e.venue || e.mode}</p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusClass(e.registrationStatus)}`}>{e.registrationStatus.replace(/_/g, ' ')}</span>
              </a>
            ))
          ) : (
            <p className="text-sm text-slate-500">No upcoming events.</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">All Registrations</h2>
        <div className="mt-4 space-y-3">
          {registrations.length ? (
            registrations.map(({ registration, event }) => (
              <div key={registration.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <a href={`/events/${event.slug}`} className="font-medium text-slate-900 hover:underline">{event.title}</a>
                  <p className="text-sm text-slate-500">
                    {event.startDate ? new Date(event.startDate).toLocaleDateString() : 'TBA'} · {registration.registrationType.replace(/_/g, ' ')}
                    {registration.certificateEligible ? ' · certificate eligible' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(registration.status)}`}>{registration.status.replace(/_/g, ' ')}</span>
                  {ACTIVE.includes(registration.status) ? (
                    <button onClick={() => void handleCancel(event.id)} disabled={busyId === event.id} className="rounded-xl border border-slate-300 px-3 py-1 text-sm text-slate-700 disabled:opacity-50">Cancel</button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">You haven&apos;t registered for any events yet.</p>
          )}
        </div>
      </section>
    </main>
    </div>
  );
}
