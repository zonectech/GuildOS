'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, MapPin, Video, Ticket, Award } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import {
  cancelRegistration,
  getMyEventRegistrations,
  getMyUpcomingEvents,
  type MyRegistrationEntry,
  type UpcomingEventEntry,
} from '../../components/guildos/event-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { confirmDialog } from '../../components/guildos/ui/confirm-dialog';
import { PageLoading } from '../../components/guildos/ui/loading';

function statusClass(status: string) {
  if (status === 'COMPLETED' || status === 'CHECKED_OUT') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CHECKED_IN') return 'bg-indigo-50 text-indigo-700';
  if (status === 'WAITLISTED' || status === 'PENDING_APPROVAL' || status === 'PARTIAL_ATTENDANCE') return 'bg-amber-50 text-amber-700';
  if (status === 'CANCELLED' || status === 'REJECTED') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

const ACTIVE = ['CONFIRMED', 'PENDING_APPROVAL', 'WAITLISTED', 'CHECKED_IN'];

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
    if (!(await confirmDialog({ title: 'Cancel this registration?', confirmLabel: 'Cancel registration', cancelLabel: 'Keep', tone: 'danger' }))) return;
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
    return <PageLoading label="Loading your events…" />;
  }

  const certEligible = registrations.filter((r) => r.registration.certificateEligible).length;

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav active="/events" />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">My events</h1>
            <p className="mt-1 text-sm text-slate-500">Your upcoming events and registration history.</p>
          </div>
          <Link href="/events" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"><Ticket className="h-4 w-4" /> Discover events</Link>
        </header>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Upcoming', value: upcoming.length, icon: <CalendarDays className="h-5 w-5" />, tone: 'bg-indigo-50 text-indigo-600 ring-indigo-100' },
            { label: 'Registrations', value: registrations.length, icon: <Ticket className="h-5 w-5" />, tone: 'bg-sky-50 text-sky-600 ring-sky-100' },
            { label: 'Cert-eligible', value: certEligible, icon: <Award className="h-5 w-5" />, tone: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums text-slate-950">{s.value}</p>
                <p className="truncate text-xs text-slate-500">{s.label}</p>
              </div>
              <span className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset sm:grid ${s.tone}`}>{s.icon}</span>
            </div>
          ))}
        </div>

        {/* Upcoming */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500"><CalendarDays className="h-4 w-4" /> Upcoming</h2>
          <div className="mt-4 space-y-3">
            {upcoming.length ? (
              upcoming.map((e) => {
                const badge = dateBadge(e.startDate);
                return (
                  <Link key={e.id} href={`/events/${e.slug}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-indigo-300 hover:bg-slate-50">
                    {badge ? (
                      <div className="grid shrink-0 place-items-center rounded-xl bg-indigo-50 px-3 py-1.5 text-center">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">{badge.month}</span>
                        <span className="text-lg font-bold leading-none text-slate-900">{badge.day}</span>
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{e.title}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{whenLabel(e.startDate)}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        {e.mode === 'VIRTUAL' ? <Video className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{e.mode === 'VIRTUAL' ? 'Online event' : e.venue || e.mode}</span>
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusClass(e.registrationStatus)}`}>{e.registrationStatus.replace(/_/g, ' ')}</span>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No upcoming events. <Link href="/events" className="font-medium text-indigo-600 hover:underline">Discover events →</Link>
              </div>
            )}
          </div>
        </section>

        {/* All registrations */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500"><Ticket className="h-4 w-4" /> All registrations</h2>
          <div className="mt-4 space-y-3">
            {registrations.length ? (
              registrations.map(({ registration, event }) => (
                <div key={registration.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <Link href={`/events/${event.slug}`} className="font-medium text-slate-900 hover:underline">{event.title}</Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" /> {event.startDate ? new Date(event.startDate).toLocaleDateString() : 'TBA'}
                      <span aria-hidden>·</span> {registration.registrationType.replace(/_/g, ' ')}
                      {registration.certificateEligible ? <span className="inline-flex items-center gap-1 text-emerald-600"><span aria-hidden>·</span> <Award className="h-3.5 w-3.5" /> certificate eligible</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(registration.status)}`}>{registration.status.replace(/_/g, ' ')}</span>
                    {ACTIVE.includes(registration.status) ? (
                      <button onClick={() => void handleCancel(event.id)} disabled={busyId === event.id} className="rounded-xl border border-slate-300 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                You haven&apos;t registered for any events yet. <Link href="/events" className="font-medium text-indigo-600 hover:underline">Browse events →</Link>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
