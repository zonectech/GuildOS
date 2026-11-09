'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as m from 'motion/react-m';
import { Search, SlidersHorizontal } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { listEvents } from '@/lib/api/events';
import { classic } from '@/lib/api/client';
import { daysOf, phaseOf, sortEvents, typeStyle } from '@/lib/events';
import { page, spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { EventCard } from '@/components/events/event-card';
import { CheckGroup, CheckRow, HappeningNow, MiniCalendar, Ticker } from '@/components/events/discover-bits';
import { Btn, Chip, SkeletonCard } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';
import { Stamp } from '@/components/brand/stamp';
import { jumpTo, takeRestore } from '@/lib/back';

// Kept between visits, so coming back from an event shows the list at once, at the same spot.
let cached: Event[] | null = null;
// The filters too, so the list comes back exactly as it was left.
const kept = { search: '', day: '', when: ['NOW'] as string[], places: [] as string[], types: [] as string[], certOnly: false };

type When = 'NOW' | 'ENDED' | 'CANCELLED';
const WHEN: { value: When; label: string }[] = [{ value: 'NOW', label: 'Upcoming & live' }, { value: 'ENDED', label: 'Ended' }, { value: 'CANCELLED', label: 'Cancelled' }];

export function Tabs() {
  const path = usePathname();
  const { user } = useSession();
  const tabs = [{ href: '/events', label: 'Discover', local: true }, ...(user ? [{ href: classic('/events/going'), label: 'Going' }, { href: classic('/events/saved'), label: 'Saved' }, { href: classic('/events/hosting'), label: 'Hosting' }] : [])];
  return (
    <nav aria-label="Events" className="no-bar flex gap-7 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const on = Boolean(t.local && path === t.href);
        const cls = `relative whitespace-nowrap pt-1 pb-3 text-[15px] font-semibold transition-colors ${on ? 'text-ink' : 'text-muted hover:text-ink'}`;
        const bar = on ? <m.span layoutId="tab-on" className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-ink" transition={spring.snap} /> : null;
        return t.local ? <Link key={t.label} href={t.href} aria-current={on ? 'page' : undefined} className={cls}>{t.label}{bar}</Link> : <a key={t.label} href={t.href} className={cls}>{t.label}</a>;
      })}
    </nav>
  );
}

/** A section of cards. Defined outside Discover so typing in search does not remount every card. */
function Grid({ list, label }: { list: Event[]; label?: string }) {
  return (
    <section className="flex flex-col gap-3">
      {label ? <h2 className="text-[22px] font-extrabold">{label}</h2> : null}
      <m.div variants={page} initial="hidden" animate="show" className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
        {list.map((e, i) => <EventCard key={e.id} event={e} priority={i < 2} />)}
      </m.div>
    </section>
  );
}

export function Discover() {
  const { user } = useSession();
  const [events, setEvents] = useState<Event[] | null>(cached);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(kept.search);
  const [day, setDay] = useState(kept.day);
  const [when, setWhen] = useState<string[]>(kept.when);
  const [places, setPlaces] = useState<string[]>(kept.places);
  const [types, setTypes] = useState<string[]>(kept.types);
  const [certOnly, setCertOnly] = useState(kept.certOnly);
  useEffect(() => { Object.assign(kept, { search, day, when, places, types, certOnly }); }, [search, day, when, places, types, certOnly]);
  const [sheet, setSheet] = useState(false);

  useEffect(() => { listEvents().then((list) => { cached = list; setEvents(list); }).catch((e: Error) => { setError(e.message); setEvents((x) => x ?? []); }); }, []);
  // Back from an event: return to where the list was.
  const hasEvents = events !== null;
  useEffect(() => {
    if (!hasEvents) return;
    const y = takeRestore(window.location.pathname + window.location.search);
    if (y === null) return;
    // Once now, and again after the cards have settled into place.
    requestAnimationFrame(() => jumpTo(y));
    const t = setTimeout(() => jumpTo(y), 350);
    return () => clearTimeout(t);
  }, [hasEvents]);

  const all = events ?? [];
  const school = user?.school ?? '';
  const states = useMemo(() => [...new Set(all.filter((e) => e.mode !== 'VIRTUAL' && e.state).map((e) => e.state.trim()))].sort(), [all]);
  const typeList = useMemo(() => [...new Set(all.map((e) => e.type).filter(Boolean))].sort(), [all]);
  const placeOptions = [...(all.some((e) => e.mode !== 'PHYSICAL') ? [{ value: 'ONLINE', label: 'Online' }] : []), ...states.map((s) => ({ value: s, label: s }))];

  const matches = (e: Event, withWhen: boolean) => {
    const ph = phaseOf(e);
    if (withWhen && when.length && !when.some((w) => (w === 'NOW' ? ph === 'LIVE' || ph === 'BEFORE' : w === 'ENDED' ? ph === 'AFTER' : ph === 'CANCELLED'))) return false;
    if (types.length && !types.includes(e.type)) return false;
    if (certOnly && e.certificate === 'NONE') return false;
    if (places.length && !places.some((p) => (p === 'ONLINE' ? e.mode !== 'PHYSICAL' : e.state.trim() === p))) return false;
    const q = search.trim().toLowerCase();
    return !q || [e.title, e.summary, e.venue, e.type, e.community.name, e.community.school, e.state].some((v) => (v ?? '').toLowerCase().includes(q));
  };
  const marked = useMemo(() => new Set(all.filter((e) => matches(e, false)).flatMap(daysOf)), [all, types, certOnly, places, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = sortEvents(all, school).filter((e) => (day ? matches(e, false) && daysOf(e).includes(day) : matches(e, true)));
  const filtering = Boolean(search.trim() || day || types.length || places.length || certOnly) || when.length !== 1 || when[0] !== 'NOW';

  const now = sortEvents(all.filter((e) => phaseOf(e) === 'LIVE' || (phaseOf(e) === 'BEFORE' && e.startDate && new Date(e.startDate).getTime() - Date.now() < 48 * 3600e3)), school).slice(0, 8);
  const atSchool = !filtering && school ? shown.filter((e) => (e.community.school ?? '').trim().toLowerCase() === school.trim().toLowerCase()) : [];
  const rest = shown.filter((e) => !atSchool.includes(e));
  // When nothing is coming up, show what just happened instead of an empty page.
  const recent = !filtering && !shown.length ? sortEvents(all.filter((e) => phaseOf(e) === 'AFTER'), school).slice(0, 6) : [];
  const reset = () => { setSearch(''); setDay(''); setWhen(['NOW']); setPlaces([]); setTypes([]); setCertOnly(false); };
  const pickedDay = day ? new Date(`${day}T00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

  const filters = (
    <div className="flex flex-col gap-4">
      <MiniCalendar value={day} onChange={setDay} marked={marked} />
      {!day ? <CheckGroup title="When" all="Any time" options={WHEN} value={when} onChange={setWhen} /> : null}
      <CheckGroup title="Location" all="All locations" options={placeOptions} value={places} onChange={setPlaces} />
      <CheckGroup title="Type" all="All types" options={typeList.map((t) => ({ value: t, label: typeStyle(t).label }))} value={types} onChange={setTypes} />
      <fieldset className="flex flex-col gap-0.5 border-t border-line pt-4"><legend className="float-left mb-2 w-full font-display text-[16px] font-bold">Certificate</legend>
        <CheckRow on={certOnly} onClick={() => setCertOnly(!certOnly)}>Only events with a certificate</CheckRow>
      </fieldset>
    </div>
  );

  return (
    <div className="mx-auto grid max-w-[1320px] gap-8 px-4 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 lg:px-10 lg:pt-10">
      <div className="mesh flex min-w-0 flex-col gap-7">
        <header className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <m.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} className="text-[44px] font-extrabold sm:text-[56px]">Events</m.h1>
              <m.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { ...spring.soft, delay: 0.06 } }} className="mt-1 text-[16px] text-muted">Every event you attend counts. Go collect your stamps.</m.p>
            </div>
            <label className="flex h-12 w-full items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 shadow-card focus-within:border-green-text sm:w-[320px]">
              <Search size={18} className="text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events, clubs, schools" aria-label="Search events" className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted" />
            </label>
          </div>
          <Tabs />
        </header>

        {events && !filtering ? <Ticker events={all} /> : null}

        {/* Phones: quick chips and the Filters button. */}
        <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
          <button type="button" onClick={() => setSheet(true)} className="relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[14px] font-semibold">
            <SlidersHorizontal size={15} />Filters{filtering ? <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-green-text ring-2 ring-paper" aria-label="Filters on" /> : null}
          </button>
          {placeOptions.some((p) => p.value === 'ONLINE') ? <Chip on={places.includes('ONLINE')} onClick={() => setPlaces(places.includes('ONLINE') ? places.filter((p) => p !== 'ONLINE') : [...places, 'ONLINE'])}>Online</Chip> : null}
          <Chip on={certOnly} onClick={() => setCertOnly(!certOnly)}>With certificate</Chip>
          {typeList.slice(0, 4).map((t) => <Chip key={t} on={types.includes(t)} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])}>{typeStyle(t).label}</Chip>)}
        </div>

        {error ? <p className="rounded-2xl bg-[color-mix(in_srgb,var(--coral)_14%,transparent)] px-4 py-3 text-[14px] font-semibold text-coral-text">{error}</p> : null}

        {events === null ? (
          <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}</div>
        ) : (
          <>
            {!filtering ? <HappeningNow events={now} /> : null}
            {day ? <h2 className="text-[22px] font-extrabold">On {pickedDay}</h2> : null}
            {atSchool.length ? <Grid list={atSchool} label="At your school" /> : null}
            {rest.length ? <Grid list={rest} label={atSchool.length ? 'Everywhere else' : filtering ? undefined : 'Coming up'} /> : null}
            {recent.length ? (
              <>
                <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[15px] text-muted">Nothing is coming up right now. Here&apos;s what happened recently.</p>
                <Grid list={recent} label="Recently ended" />
              </>
            ) : null}
            {!shown.length && !recent.length ? (
              <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 py-16 text-center">
                <m.span animate={{ rotate: [-10, -4, -10], y: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}><Stamp state="empty" size={110} tilt={0} /></m.span>
                <p className="max-w-xs text-[16px] text-muted">{day ? `Nothing on ${pickedDay}.` : filtering ? 'No events match those filters.' : 'No events yet. Check back soon.'}</p>
                {filtering ? <Btn kind="secondary" size="sm" onClick={reset}>Clear filters</Btn> : null}
              </m.div>
            ) : null}
          </>
        )}
      </div>

      {/* Desktop: filter panel on the right. */}
      <aside className="hidden lg:block">
        <div className="sticky top-8 flex flex-col gap-3">
          {user ? <Btn wide kind="secondary" href={classic('/events/new')}>New event</Btn> : null}
          <div className="rounded-[22px] border border-line bg-surface p-5 shadow-card">{filters}</div>
          {filtering ? <button type="button" onClick={reset} className="text-[14px] font-semibold text-green-text hover:underline">Clear all filters</button> : null}
        </div>
      </aside>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filters">
        <div className="px-5 pb-4">{filters}</div>
        <div className="glass sticky bottom-0 flex gap-2 border-t border-line px-5 py-3">
          {filtering ? <Btn kind="secondary" onClick={reset}>Clear</Btn> : null}
          <Btn wide onClick={() => setSheet(false)}>Show {shown.length} event{shown.length === 1 ? '' : 's'}</Btn>
        </div>
      </Sheet>
    </div>
  );
}
