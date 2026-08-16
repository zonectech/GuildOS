'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, CalendarDays, MapPin, Users, Video, X } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import {
  getMyBookmarkedEvents,
  resolveEventImageUrl,
  toggleEventBookmark,
  type EventSummary,
} from '../../../components/guildos/event-api';
import { StudentNav } from '../../../components/guildos/student-nav';
import { StudentNavRail } from '../../../components/guildos/student-nav-rail';
import { Button } from '../../../components/guildos/ui/button';
import { EmptyState, PageHeader, PageShell } from '../../../components/guildos/ui/page';
import { PageLoading } from '../../../components/guildos/ui/loading';

const MODE_LABEL: Record<string, string> = { PHYSICAL: 'In person', HYBRID: 'Hybrid', VIRTUAL: 'Online' };

function dateBadge(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return { day: d.getDate(), month: d.toLocaleString('en-NG', { month: 'short' }) };
}

function whenLabel(value: string | null) {
  if (!value) return 'Date TBA';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date TBA';
  return `${d.toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

/** All the events the viewer saved for later — with one-tap unsave. */
export default function SavedEventsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login?next=%2Fevents%2Fsaved');
          return;
        }
        const response = await getMyBookmarkedEvents();
        setEvents(response.events);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load saved events');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleRemove(eventId: string) {
    try {
      setBusyId(eventId);
      setError('');
      await toggleEventBookmark(eventId);
      setEvents((prev) => prev.filter((e) => e._id !== eventId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove bookmark');
    } finally {
      setBusyId('');
    }
  }

  if (loading) {
    return <PageLoading label="Loading saved events…" />;
  }

  return (
    <PageShell nav={<StudentNav active="/events" />}>
      <div className="flex items-start gap-6">
        <StudentNavRail active="/events/saved" />
        <div className="min-w-0 flex-1 space-y-6">
      <PageHeader
        eyebrow="Events"
        title="Saved events"
        description="Everything you bookmarked to decide on later — tap Save on any event page to add more."
        action={
          <Button asChild href="/events" variant="secondary" className="shrink-0">
            <CalendarDays className="h-4 w-4" /> Discover events
          </Button>
        }
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {events.length ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{events.length} saved {events.length === 1 ? 'event' : 'events'}</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const badge = dateBadge(event.startDate);
              const spotsLeft = event.capacity > 0 ? Math.max(0, event.capacity - event.registrationCount) : null;
              return (
                <div key={event._id} className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
                  <button
                    onClick={() => void handleRemove(event._id)}
                    disabled={busyId === event._id}
                    title="Remove from saved"
                    className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-rose-600 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <Link href={`/events/${event.slug}`} className="flex flex-1 flex-col">
                    <div className="relative h-36 bg-gradient-to-br from-indigo-600 to-sky-500">
                      {event.bannerImage ? <img src={resolveEventImageUrl(event.bannerImage)} alt={event.title} className="h-full w-full object-cover" /> : null}
                      {badge ? (
                        <div className="absolute left-3 top-3 grid place-items-center rounded-xl bg-white/95 px-2.5 py-1 text-center shadow-sm backdrop-blur">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">{badge.month}</span>
                          <span className="text-lg font-bold leading-none text-slate-900 dark:text-slate-100">{badge.day}</span>
                        </div>
                      ) : null}
                      <span className="absolute bottom-3 left-3 rounded-full bg-black/40 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">{MODE_LABEL[event.mode] ?? event.mode}</span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="line-clamp-1 font-semibold text-slate-950 dark:text-white">{event.title}</h3>
                      <div className="mt-3 flex-1 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{whenLabel(event.startDate)}</span></p>
                        <p className="flex items-center gap-1.5">
                          {event.mode === 'VIRTUAL' ? <Video className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{event.mode === 'VIRTUAL' ? 'Online event' : event.venue || 'Venue TBA'}</span>
                        </p>
                        <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 shrink-0" /> {event.registrationCount} registered{spotsLeft !== null ? ` · ${spotsLeft === 0 ? 'Full' : `${spotsLeft} spots left`}` : ''}</p>
                      </div>
                      {(event.ticketPrice ?? 0) > 0 ? (
                        <p className="mt-3 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">₦{(event.ticketPrice ?? 0).toLocaleString('en-NG')}</p>
                      ) : null}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Bookmark className="h-8 w-8" />}
          description="Nothing saved yet — tap Save on any event page and it will wait for you here."
        />
      )}
        </div>
      </div>
    </PageShell>
  );
}
