'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, CalendarRange, LayoutList, Library, MapPin, Video, Ticket, Award, Bookmark } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import {
  cancelRegistration,
  getCalendarFeed,
  getMyCertificates,
  getMyEventRegistrations,
  getMyUpcomingEvents,
  getMyBookmarkedEvents,
  type CertificateSummary,
  type EventSummary,
  type MyRegistrationEntry,
  type UpcomingEventEntry,
} from '../../components/guildos/event-api';
import { getMyBookmarkedKnowledge, type KnowledgeResource } from '../../components/guildos/knowledge-api';
import { CertificateGallery } from '../../components/guildos/events/certificate-gallery';
import { EventsCalendar, type CalendarEntry } from '../../components/guildos/events/events-calendar';
import { CancelRegistrationDialog, STUDENT_CANCEL_REASONS } from '../../components/guildos/events/cancel-registration-dialog';
import { StudentNav } from '../../components/guildos/student-nav';
import { StudentNavRail } from '../../components/guildos/student-nav-rail';
import { confirmDialog } from '../../components/guildos/ui/confirm-dialog';
import { PageLoading } from '../../components/guildos/ui/loading';

function statusClass(status: string) {
  if (status === 'COMPLETED' || status === 'CHECKED_OUT') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CHECKED_IN') return 'bg-indigo-50 text-indigo-700';
  if (status === 'WAITLISTED' || status === 'PENDING_APPROVAL' || status === 'PARTIAL_ATTENDANCE') return 'bg-amber-50 text-amber-700';
  if (status === 'CANCELLED' || status === 'REJECTED') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300';
}

const ACTIVE = ['CONFIRMED', 'PENDING_APPROVAL', 'WAITLISTED', 'CHECKED_IN'];

function dateBadge(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return { day: d.getDate(), month: d.toLocaleString('en-NG', { month: 'short' }) };
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
  const base = `${d.toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
  const [saved, setSaved] = useState<EventSummary[]>([]);
  const [savedKnowledge, setSavedKnowledge] = useState<KnowledgeResource[]>([]);
  const [certificates, setCertificates] = useState<CertificateSummary[]>([]);
  const [calendarNotice, setCalendarNotice] = useState('');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  // Which event's cancel-reason dialog is open ('' = none).
  const [cancelTargetId, setCancelTargetId] = useState('');

  /**
   * Personal iCal subscription: copies the private feed URL. Pasted once into
   * Google/Apple/Outlook "add calendar from URL", every registered event (and each
   * day of a multi-day event) shows up and stays in sync automatically.
   */
  async function handleSubscribeCalendar() {
    try {
      setError('');
      const { path } = await getCalendarFeed();
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const url = `${apiBase}${path}`;
      await navigator.clipboard.writeText(url);
      setCalendarNotice('Calendar link copied! In Google Calendar: Other calendars → + → From URL → paste. On iPhone: Settings → Calendar → Accounts → Add Subscribed Calendar. Your events stay in sync automatically.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create your calendar link');
    }
  }

  async function load() {
    const [up, regs, marks, know, certs] = await Promise.all([
      getMyUpcomingEvents(),
      getMyEventRegistrations(),
      getMyBookmarkedEvents().catch(() => ({ events: [] as EventSummary[] })),
      getMyBookmarkedKnowledge().catch(() => ({ resources: [] as KnowledgeResource[] })),
      getMyCertificates().catch(() => ({ certificates: [] as CertificateSummary[] })),
    ]);
    setUpcoming(up.events);
    setRegistrations(regs.registrations);
    setSaved(marks.events);
    setSavedKnowledge(know.resources);
    setCertificates(certs.certificates);
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

  async function handleCancel(eventId: string, reason: string) {
    try {
      setBusyId(eventId);
      setError('');
      await cancelRegistration(eventId, reason);
      setCancelTargetId('');
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

  // Calendar entries: everything registered (not cancelled/rejected) + saved events.
  const calendarEntries: CalendarEntry[] = [];
  {
    const seen = new Set<string>();
    for (const { registration, event } of registrations) {
      if (!event.startDate || ['CANCELLED', 'REJECTED'].includes(registration.status)) continue;
      calendarEntries.push({ id: event.id, title: event.title, slug: event.slug, date: event.startDate, tone: 'registered' });
      seen.add(event.id);
    }
    for (const e of saved) {
      if (!e.startDate || seen.has(e._id)) continue;
      calendarEntries.push({ id: e._id, title: e.title, slug: e.slug, date: e.startDate, endDate: e.endDate, tone: 'saved' });
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav active="/events" />
      <main className="mx-auto flex max-w-6xl items-start gap-6 px-4 py-8">
        <StudentNavRail active="/my-events" />
        <div className="min-w-0 flex-1 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">My events</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your upcoming events and registration history.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5" role="tablist" aria-label="View">
              <button
                onClick={() => setView('list')}
                className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-medium transition ${view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                aria-selected={view === 'list'}
              >
                <LayoutList className="h-4 w-4" /> List
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-medium transition ${view === 'calendar' ? 'bg-slate-900 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                aria-selected={view === 'calendar'}
              >
                <CalendarRange className="h-4 w-4" /> Calendar
              </button>
            </div>
            <button onClick={() => void handleSubscribeCalendar()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"><CalendarDays className="h-4 w-4" /> Subscribe in calendar</button>
            <Link href="/events" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"><Ticket className="h-4 w-4" /> Discover events</Link>
          </div>
        </header>

        {calendarNotice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{calendarNotice}</div> : null}

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Upcoming', value: upcoming.length, icon: <CalendarDays className="h-5 w-5" />, tone: 'bg-indigo-50 text-indigo-600 ring-indigo-100' },
            { label: 'Registrations', value: registrations.length, icon: <Ticket className="h-5 w-5" />, tone: 'bg-sky-50 text-sky-600 ring-sky-100' },
            { label: 'Saved', value: saved.length, icon: <Bookmark className="h-5 w-5" />, tone: 'bg-amber-50 text-amber-600 ring-amber-100' },
            { label: 'Cert-eligible', value: certEligible, icon: <Award className="h-5 w-5" />, tone: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">{s.value}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
              <span className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset sm:grid ${s.tone}`}>{s.icon}</span>
            </div>
          ))}
        </div>

        {view === 'calendar' ? <EventsCalendar entries={calendarEntries} /> : null}

        {/* Upcoming */}
        {view === 'list' ? (
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><CalendarDays className="h-4 w-4" /> Upcoming</h2>
          <div className="mt-4 space-y-3">
            {upcoming.length ? (
              upcoming.map((e) => {
                const badge = dateBadge(e.startDate);
                return (
                  <Link key={e.id} href={`/events/${e.slug}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 transition hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                    {badge ? (
                      <div className="grid shrink-0 place-items-center rounded-xl bg-indigo-50 px-3 py-1.5 text-center">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">{badge.month}</span>
                        <span className="text-lg font-bold leading-none text-slate-900 dark:text-slate-100">{badge.day}</span>
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{e.title}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{whenLabel(e.startDate)}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        {e.mode === 'VIRTUAL' ? <Video className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{e.mode === 'VIRTUAL' ? 'Online event' : e.venue || e.mode}</span>
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusClass(e.registrationStatus)}`}>{e.registrationStatus.replace(/_/g, ' ')}</span>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No upcoming events. <Link href="/events" className="font-medium text-indigo-600 hover:underline">Discover events →</Link>
              </div>
            )}
          </div>
        </section>
        ) : null}

        {/* Saved */}
        {view === 'list' ? (
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Bookmark className="h-4 w-4" /> Saved for later</h2>
            <Link href="/events/saved" className="text-xs font-medium text-indigo-600 hover:underline">View all →</Link>
          </div>
          <div className="mt-4 space-y-3">
            {saved.length ? (
              saved.map((e) => {
                const badge = dateBadge(e.startDate);
                return (
                  <Link key={e._id} href={`/events/${e.slug}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 transition hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                    {badge ? (
                      <div className="grid shrink-0 place-items-center rounded-xl bg-amber-50 px-3 py-1.5 text-center">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">{badge.month}</span>
                        <span className="text-lg font-bold leading-none text-slate-900 dark:text-slate-100">{badge.day}</span>
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{e.title}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{whenLabel(e.startDate)}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        {e.mode === 'VIRTUAL' ? <Video className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{e.mode === 'VIRTUAL' ? 'Online event' : e.venue || e.mode}</span>
                      </p>
                    </div>
                    {(e.ticketPrice ?? 0) > 0 ? (
                      <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-950 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">₦{(e.ticketPrice ?? 0).toLocaleString('en-NG')}</span>
                    ) : null}
                  </Link>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Nothing saved yet — tap <span className="font-medium text-slate-700 dark:text-slate-300">Save</span> on any event page to keep it here for later.
              </div>
            )}
          </div>
        </section>
        ) : null}

        {/* Saved knowledge resources */}
        {view === 'list' && savedKnowledge.length ? (
          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Library className="h-4 w-4" /> Saved resources</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {savedKnowledge.map((r) => (
                <Link
                  key={r._id}
                  href={`/communities/${encodeURIComponent(r.communitySlug ?? '')}?tab=knowledge&resource=${encodeURIComponent(r._id)}`}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 transition hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{r.title}</p>
                  {r.summary ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{r.summary}</p> : null}
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{r.communityName ?? 'Knowledge Hub'} · {r.type === 'ARTICLE' ? 'Article' : r.type === 'LINK' ? 'Link' : 'File'}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* All registrations */}
        {view === 'list' ? (
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Ticket className="h-4 w-4" /> All registrations</h2>
          <div className="mt-4 space-y-3">
            {registrations.length ? (
              registrations.map(({ registration, event }) => (
                <div key={registration.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <Link href={`/events/${event.slug}`} className="font-medium text-slate-900 dark:text-slate-100 hover:underline">{event.title}</Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <CalendarDays className="h-3.5 w-3.5" /> {event.startDate ? new Date(event.startDate).toLocaleDateString('en-NG') : 'TBA'}
                      <span aria-hidden>·</span> {registration.registrationType.replace(/_/g, ' ')}
                      {registration.certificateEligible ? <span className="inline-flex items-center gap-1 text-emerald-600"><span aria-hidden>·</span> <Award className="h-3.5 w-3.5" /> certificate eligible</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(registration.status)}`}>{registration.status.replace(/_/g, ' ')}</span>
                    {ACTIVE.includes(registration.status) ? (
                      <button onClick={() => setCancelTargetId(event.id)} disabled={busyId === event.id} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1 text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">Cancel</button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                You haven&apos;t registered for any events yet. <Link href="/events" className="font-medium text-indigo-600 hover:underline">Browse events →</Link>
              </div>
            )}
          </div>
        </section>
        ) : null}

        {/* Certificates earned through events — the home this page always promised them. */}
        <CertificateGallery certificates={certificates} />
        </div>
      </main>

      <CancelRegistrationDialog
        open={Boolean(cancelTargetId)}
        title="Cancel this registration?"
        subtitle="Your spot goes back to the pool (the waitlist is promoted automatically). Paid tickets are not refunded by cancelling — transfer them instead."
        reasons={STUDENT_CANCEL_REASONS}
        busy={Boolean(busyId)}
        onClose={() => setCancelTargetId('')}
        onConfirm={(reason) => void handleCancel(cancelTargetId, reason)}
      />
    </div>
  );
}
