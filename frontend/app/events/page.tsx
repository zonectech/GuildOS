'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Bookmark, CalendarDays, Ticket, GraduationCap, LayoutGrid, List, SlidersHorizontal, Sparkles } from 'lucide-react';

import { listEvents, getEvent, getMyBookmarkedEvents, type EventSummary } from '../../components/guildos/event-api';
import { getCurrentUser } from '../../components/guildos/auth-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { Button } from '../../components/guildos/ui/button';
import { SelectMenu } from '../../components/guildos/ui/select-menu';
import { EmptyState, PageHeader, PageShell } from '../../components/guildos/ui/page';
import { SearchField } from '../../components/guildos/ui/forms';
import { FilterPills } from '../../components/guildos/ui/filter-pills';
import { Tour, type TourStep } from '../../components/guildos/ui/tour';
import { LEARNING_TYPES, bucketOf, entryPriceOf, pickFeatured, similarEventScore, typeLabel, type EventBucket } from './_components/event-discovery';
import { EventGridCard, EventListRow, FeaturedEventCard } from './_components/event-cards';

/** First-visit walkthrough of event discovery. */
const EVENTS_TOUR: TourStep[] = [
  {
    target: 'event-filters',
    title: 'Find the right event fast',
    body: 'One tap for hackathons, workshops, free events or ones that issue certificates, and pick your state (or Online). "More filters" has price, format, date and university.',
  },
  {
    target: 'event-search',
    title: 'Search everything',
    body: 'Titles, venues, universities, states: one search box covers it all.',
  },
  {
    target: 'event-list',
    title: 'Events near you first',
    body: 'Events from your own university rank first. Switch between cards and a compact list with the toggle, then tap any event to register.',
  },
  {
    target: 'events-saved',
    title: 'Save for later',
    body: 'Bookmark events you’re not sure about yet. They wait for you here.',
  },
  {
    target: 'events-mine',
    title: 'Your tickets & passes',
    body: 'Registered events, QR door passes, and earned certificates all live in My events.',
  },
];

const STATUS_FILTERS = ['Upcoming & Live', 'Ended', 'Cancelled', 'All'] as const;
const VIEW_STORAGE_KEY = 'guildos-events-view';

type QuickType = 'All' | 'HACKATHON' | 'LEARNING' | 'FREE' | 'CERTIFICATE' | 'SAVED';

const PILL = 'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition';
const PILL_ON = 'border-indigo-600 bg-indigo-600 text-white';
const PILL_OFF = 'border-slate-300 bg-white text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400';

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`${PILL} ${active ? PILL_ON : PILL_OFF}`}>
      {children}
    </button>
  );
}

function readStoredView(): 'grid' | 'list' {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export default function EventsDiscoveryPage() {
  return <Suspense fallback={<main className="p-8 text-sm text-slate-500" role="status">Loading events…</main>}><EventsDiscoveryPageInner /></Suspense>;
}

function EventsDiscoveryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceParam = searchParams.get('similarTo') || '';
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [scheduleNow, setScheduleNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setScheduleNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const [similarTo, setSimilarTo] = useState('');
  const [similarSource, setSimilarSource] = useState<EventSummary | null>(null);
  useEffect(() => { setSimilarTo(sourceParam); setSimilarSource(null); }, [sourceParam]);
  useEffect(() => {
    if (!similarTo || !loaded) return;
    let cancelled = false;
    const listed = events.find(e => e.slug === similarTo);
    if (listed) { setSimilarSource(listed); return; }
    void getEvent(similarTo).then(detail => { if (!cancelled) setSimilarSource(detail.event); }).catch(() => { if (!cancelled) setSimilarSource(null); });
    return () => { cancelled = true; };
  }, [similarTo, events, loaded]);
  const [userId, setUserId] = useState('');
  const [myUniversity, setMyUniversity] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('Upcoming & Live');
  const [quickType, setQuickType] = useState<QuickType>('All');
  const [stateFilter, setStateFilter] = useState('All'); // a state, 'ONLINE', or 'All'
  // "More filters"
  const [moreOpen, setMoreOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');
  const [priceFilter, setPriceFilter] = useState<'All' | 'FREE' | 'PAID'>('All');
  const [modeFilter, setModeFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState<'ANY' | 'WEEK' | 'MONTH'>('ANY');
  const [uniFilter, setUniFilter] = useState('All');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => setView(readStoredView()), []);

  function changeView(next: 'grid' | 'list') {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* private mode — the toggle still works for this visit */
    }
  }

  useEffect(() => {
    void getCurrentUser().then((user) => {
      setUserId(user?.id ?? '');
      setMyUniversity(user?.profile?.university?.trim() ?? '');
      if (user) {
        void getMyBookmarkedEvents()
          .then((r) => setSavedIds(new Set(r.events.map((e) => e._id))))
          .catch(() => undefined);
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await listEvents();
        if (!cancelled) setEvents(response.events);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load events');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const types = useMemo(() => Array.from(new Set(events.map((e) => e.type).filter((type): type is string => Boolean(type)))).sort(), [events]);
  /** Universities + states present in the loaded events — filters only offer real choices. */
  const universities = useMemo(
    () => Array.from(new Set(events.map((e) => e.communityUniversity?.trim()).filter((u): u is string => Boolean(u)))).sort(),
    [events],
  );
  // States ordered by how many events they have — the busiest campuses lead the pill row.
  const states = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      const s = e.state?.trim();
      if (s && e.mode !== 'VIRTUAL') counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);
  }, [events]);
  const hasOnline = useMemo(() => events.some((e) => e.mode !== 'PHYSICAL'), [events]);
  const hasHackathons = useMemo(() => events.some((e) => e.type === 'HACKATHON'), [events]);
  const hasLearning = useMemo(() => events.some((e) => LEARNING_TYPES.includes(e.type)), [events]);

  // Order that matches how students think: what's happening NOW first, then the
  // soonest upcoming — with events from YOUR university ahead of the rest at each
  // step; ended/cancelled (when filtered to) show most recent first.
  const sorted = useMemo(() => {
    const rank: Record<EventBucket, number> = { LIVE: 0, UPCOMING: 1, ENDED: 2, CANCELLED: 3 };
    const uni = myUniversity.toLowerCase();
    const mine = (e: EventSummary) => (uni && (e.communityUniversity ?? '').trim().toLowerCase() === uni ? 0 : 1);
    return [...events].sort((a, b) => {
      const ba = bucketOf(a, scheduleNow);
      const bb = bucketOf(b, scheduleNow);
      if (rank[ba] !== rank[bb]) return rank[ba] - rank[bb];
      if (similarSource && (ba === 'LIVE' || ba === 'UPCOMING')) {
        const relevance = similarEventScore(b, similarSource) - similarEventScore(a, similarSource);
        if (relevance) return relevance;
      }
      // "My university first" only matters for what's ahead — history stays chronological.
      if ((ba === 'LIVE' || ba === 'UPCOMING') && mine(a) !== mine(b)) return mine(a) - mine(b);
      const ta = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const tb = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      // Upcoming/live: soonest first. Past: most recent first.
      return ba === 'ENDED' || ba === 'CANCELLED' ? tb - ta : ta - tb;
    });
  }, [events, myUniversity, similarSource, scheduleNow]);

  const moreCount = [typeFilter !== 'All', priceFilter !== 'All', modeFilter !== 'All', dateFilter !== 'ANY', uniFilter !== 'All'].filter(Boolean).length;
  const anyFilter = Boolean(similarSource) || Boolean(search.trim()) || statusFilter !== 'Upcoming & Live' || quickType !== 'All' || stateFilter !== 'All' || moreCount > 0;

  const filtered = sorted.filter((e) => {
    if (similarTo && e.slug === similarTo) return false;
    const bucket = bucketOf(e, scheduleNow);
    if (statusFilter === 'Upcoming & Live' && bucket !== 'UPCOMING' && bucket !== 'LIVE') return false;
    if (statusFilter === 'Ended' && bucket !== 'ENDED') return false;
    if (statusFilter === 'Cancelled' && bucket !== 'CANCELLED') return false;
    if (quickType === 'HACKATHON' && e.type !== 'HACKATHON') return false;
    if (quickType === 'LEARNING' && !LEARNING_TYPES.includes(e.type)) return false;
    if (quickType === 'FREE' && entryPriceOf(e) > 0) return false;
    if (quickType === 'CERTIFICATE' && !e.certificateEnabled) return false;
    if (quickType === 'SAVED' && !savedIds.has(e._id)) return false;
    if (stateFilter === 'ONLINE' && e.mode === 'PHYSICAL') return false;
    if (stateFilter !== 'All' && stateFilter !== 'ONLINE' && (e.state ?? '').trim() !== stateFilter) return false;
    if (typeFilter !== 'All' && e.type !== typeFilter) return false;
    if (priceFilter === 'FREE' && entryPriceOf(e) > 0) return false;
    if (priceFilter === 'PAID' && entryPriceOf(e) === 0) return false;
    if (modeFilter !== 'All' && e.mode !== modeFilter) return false;
    if (uniFilter !== 'All' && (e.communityUniversity ?? '').trim() !== uniFilter) return false;
    if (dateFilter !== 'ANY') {
      if (!e.startDate) return false;
      const start = new Date(e.startDate).getTime();
      const horizon = Date.now() + (dateFilter === 'WEEK' ? 7 : 30) * 86400000;
      if (start > horizon) return false;
    }
    if (!search.trim()) return true;
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return rx.test(e.title) || rx.test(e.shortDescription ?? '') || rx.test(e.venue ?? '') || rx.test(e.type ?? '') || rx.test(e.communityUniversity ?? '') || rx.test(e.state ?? '');
  });

  // Featured shows on the unfiltered landing view only — once you filter, results win.
  const featured = useMemo(() => (anyFilter ? [] : pickFeatured(events, myUniversity)), [anyFilter, events, myUniversity, scheduleNow]);

  function resetFilters() {
    setSearch('');
    setSimilarTo('');
    setSimilarSource(null);
    router.replace('/events', { scroll: false });
    setStatusFilter('Upcoming & Live');
    setQuickType('All');
    setStateFilter('All');
    setTypeFilter('All');
    setPriceFilter('All');
    setModeFilter('All');
    setDateFilter('ANY');
    setUniFilter('All');
  }

  const toggleQuick = (next: QuickType) => setQuickType((current) => (current === next ? 'All' : next));

  return (
    <PageShell nav={<StudentNav active="/events" />}>
      <Tour steps={EVENTS_TOUR} storageKey="guildos-tour-events-v2" />
      <PageHeader
        eyebrow="Events"
        title="Discover events"
        description="Hackathons, workshops and meetups from communities on every campus."
        action={
          <>
            <span data-tour="event-search" className="flex min-w-0">
              <SearchField
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events"
              />
            </span>
            <span data-tour="events-saved" className="flex shrink-0">
              <Button asChild href="/events/saved" variant="secondary" className="shrink-0">
                <Bookmark className="h-4 w-4" /> Saved
              </Button>
            </span>
            <span data-tour="events-mine" className="flex shrink-0">
              <Button asChild href="/my-events" variant="secondary" className="shrink-0">
                <Ticket className="h-4 w-4" /> My events
              </Button>
            </span>
          </>
        }
      />

      {similarSource ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 dark:border-indigo-900 dark:bg-indigo-950/40"><div><p className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">More events like {similarSource.title}</p><p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">Similar topics and event types appear first. You can still explore every upcoming event.</p></div><button type="button" onClick={resetFilters} className="text-sm font-semibold text-indigo-700 underline underline-offset-4 dark:text-indigo-300">Show all events</button></div> : null}

      <div className="space-y-3" data-tour="event-filters">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPills items={[...STATUS_FILTERS]} active={statusFilter} onChange={(v) => setStatusFilter(v as (typeof STATUS_FILTERS)[number])} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={`${PILL} ${moreOpen || moreCount ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300' : PILL_OFF}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> More filters{moreCount ? ` · ${moreCount}` : ''}
            </button>
            <div className="inline-flex rounded-full border border-slate-300 p-0.5 dark:border-slate-700" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'grid'} aria-label="Card view" onClick={() => changeView('grid')} className={`rounded-full p-1.5 transition ${view === 'grid' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-pressed={view === 'list'} aria-label="List view" onClick={() => changeView('list')} className={`rounded-full p-1.5 transition ${view === 'list' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`}>
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* One-tap type pills */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Pill active={quickType === 'All'} onClick={() => setQuickType('All')}>All</Pill>
          {hasHackathons && <Pill active={quickType === 'HACKATHON'} onClick={() => toggleQuick('HACKATHON')}>Hackathons</Pill>}
          {hasLearning && <Pill active={quickType === 'LEARNING'} onClick={() => toggleQuick('LEARNING')}>Workshops &amp; trainings</Pill>}
          <Pill active={quickType === 'FREE'} onClick={() => toggleQuick('FREE')}>Free</Pill>
          <Pill active={quickType === 'CERTIFICATE'} onClick={() => toggleQuick('CERTIFICATE')}><GraduationCap className="h-3.5 w-3.5" /> Certificate</Pill>
          {userId && <Pill active={quickType === 'SAVED'} onClick={() => toggleQuick('SAVED')}><Bookmark className="h-3.5 w-3.5" /> Saved</Pill>}
        </div>

        {/* Where: busiest states first, plus Online */}
        {states.length > 0 || hasOnline ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <Pill active={stateFilter === 'All'} onClick={() => setStateFilter('All')}>Everywhere</Pill>
            {hasOnline && <Pill active={stateFilter === 'ONLINE'} onClick={() => setStateFilter(stateFilter === 'ONLINE' ? 'All' : 'ONLINE')}>Online</Pill>}
            {states.map((s) => (
              <Pill key={s} active={stateFilter === s} onClick={() => setStateFilter(stateFilter === s ? 'All' : s)}>{s}</Pill>
            ))}
          </div>
        ) : null}

        {moreOpen && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <SelectMenu
              aria-label="Filter by event type"
              className="w-48"
              size="sm"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[{ value: 'All', label: 'All types' }, ...types.map((t) => ({ value: t, label: typeLabel(t) }))]}
            />
            <SelectMenu
              aria-label="Filter by price"
              className="w-32"
              size="sm"
              value={priceFilter}
              onChange={(v) => setPriceFilter(v as typeof priceFilter)}
              options={[{ value: 'All', label: 'Any price' }, { value: 'FREE', label: 'Free' }, { value: 'PAID', label: 'Paid' }]}
            />
            <SelectMenu
              aria-label="Filter by format"
              className="w-36"
              size="sm"
              value={modeFilter}
              onChange={setModeFilter}
              options={[{ value: 'All', label: 'Any format' }, { value: 'PHYSICAL', label: 'In person' }, { value: 'HYBRID', label: 'Hybrid' }, { value: 'VIRTUAL', label: 'Online' }]}
            />
            <SelectMenu
              aria-label="Filter by date"
              className="w-36"
              size="sm"
              value={dateFilter}
              onChange={(v) => setDateFilter(v as typeof dateFilter)}
              options={[{ value: 'ANY', label: 'Any time' }, { value: 'WEEK', label: 'Next 7 days' }, { value: 'MONTH', label: 'Next 30 days' }]}
            />
            {universities.length > 1 ? (
              <SelectMenu
                aria-label="Filter by university"
                className="w-56"
                size="sm"
                value={uniFilter}
                onChange={setUniFilter}
                options={[{ value: 'All', label: 'All universities' }, ...universities.map((u) => ({ value: u, label: u }))]}
              />
            ) : null}
            {anyFilter && (
              <button type="button" onClick={resetFilters} className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}

      {featured.length > 0 && (
        <section aria-label="Featured events">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Sparkles className="h-4 w-4 text-amber-500" /> Featured
          </h2>
          <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
            {featured.map((event) => <FeaturedEventCard key={event._id} event={event} />)}
          </div>
        </section>
      )}

      {filtered.length ? (
        <div className="space-y-3" data-tour="event-list">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
            {anyFilter && (
              <button type="button" onClick={resetFilters} className="ml-2 font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Clear filters</button>
            )}
          </p>
          {view === 'list' ? (
            <div className="space-y-2">
              {filtered.map((event) => <EventListRow key={event._id} event={event} userId={userId} myUniversity={myUniversity} />)}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((event) => <EventGridCard key={event._id} event={event} userId={userId} myUniversity={myUniversity} />)}
            </div>
          )}
        </div>
      ) : loaded ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          description={anyFilter ? 'No events match these filters. Try clearing a few.' : 'No upcoming events yet. Check back soon, or start a community and host the first one.'}
        />
      ) : null}
    </PageShell>
  );
}
