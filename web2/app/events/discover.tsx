'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { FlaskConical, PanelRightClose, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { listEvents } from '@/lib/api/events';
import { stampsOf } from '@/lib/api/session';
import { daysOf, phaseOf, sortEvents, typeStyle } from '@/lib/events';
import { spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { EventAgendaRow, EventCompactCard, EventTicket, ViewSkeleton, ViewSwitch, dayHeading, useEventView, type EventView } from '@/components/events/views';
import { LayoutGroup } from 'motion/react';
import { CheckGroup, CheckRow, HappeningNow, MiniCalendar, RadioGroup, Ticker } from '@/components/events/discover-bits';
import { Btn, Chip, SkeletonCard } from '@/components/ui/bits';
import { Sheet, useIsDesktop } from '@/components/ui/sheet';
import { Stamp } from '@/components/brand/stamp';
import { jumpTo, takeRestore } from '@/lib/back';
import { fmtDate } from '@/lib/format';

// Kept between visits, so coming back from an event shows the list at once, at the same spot.
let cached: Event[] | null = null;
// The filters too, so the list comes back exactly as it was left.
const kept = { search: '', day: '', when: 'NOW', place: '', types: [] as string[], certOnly: false, panel: true };

const WHEN = [{ value: 'NOW', label: 'Upcoming & live' }, { value: 'ENDED', label: 'Ended' }, { value: 'CANCELLED', label: 'Cancelled' }, { value: 'ALL', label: 'Any time' }];
const DEMO_OFF = 'otr-demo-banner-off';

export function Tabs() {
  const path = usePathname();
  const { user } = useSession();
  const tabs = [{ href: '/events', label: 'Discover', local: true }, ...(user ? [{ href: '/events/going', label: 'Going', local: true }, { href: '/events/saved', label: 'Saved', local: true }, { href: '/events/hosting', label: 'Hosting', local: true }] : [])];
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

/**
 * A section of events in the chosen view. Each event keeps one layoutId, so switching views moves it
 * smoothly to its new place and shape, 30ms after the one before it (instant with reduced motion).
 */
function Grid({ list, label, attended, view, action }: { list: Event[]; label?: string; attended: Set<string>; view: EventView; action?: React.ReactNode }) {
  const item = (e: Event, i: number, child: React.ReactNode) => (
    <m.div key={e.id} layout layoutId={`ev-${e.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.soft, delay: Math.min(i, 12) * 0.03 }}>{child}</m.div>
  );
  let body: React.ReactNode;
  if (view === 'tickets') {
    body = <div className="flex flex-col gap-3">{list.map((e, i) => item(e, i, <EventTicket event={e} attended={attended.has(e.id)} />))}</div>;
  } else if (view === 'cards') {
    body = <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">{list.map((e, i) => item(e, i, <EventCompactCard event={e} attended={attended.has(e.id)} />))}</div>;
  } else {
    // List: grouped by day under sticky headers, on a thin timeline.
    const days: { day: string; events: Event[] }[] = [];
    for (const e of list) { const d = dayHeading(e); const last = days[days.length - 1]; if (last && last.day === d) last.events.push(e); else days.push({ day: d, events: [e] }); }
    let n = 0;
    body = (
      <div className="flex flex-col">
        {days.map(({ day, events }) => (
          <div key={day} className="flex flex-col">
            <h3 className="glass sticky top-[58px] z-10 -mx-1 rounded-xl px-1 py-2 text-[13px] font-extrabold tracking-[.08em] text-muted uppercase lg:top-0">{day}</h3>
            <div className="relative flex flex-col">
              <span aria-hidden="true" className="absolute top-0 bottom-0 left-[10px] w-px bg-line" />
              {events.map((e) => item(e, n++, <EventAgendaRow event={e} attended={attended.has(e.id)} />))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      {label || action ? <div className="flex flex-wrap items-center justify-between gap-3">{label ? <h2 className="text-[22px] font-extrabold">{label}</h2> : <span />}{action}</div> : null}
      {body}
    </section>
  );
}

/** "Demo data": shown while sample events are on the site, until dismissed. */
function DemoBanner({ show }: { show: boolean }) {
  const [off, setOff] = useState(true);
  useEffect(() => { try { setOff(Boolean(localStorage.getItem(DEMO_OFF))); } catch { setOff(false); } }, []);
  const dismiss = () => { setOff(true); try { localStorage.setItem(DEMO_OFF, '1'); } catch { /* storage blocked */ } };
  return (
    <AnimatePresence>
      {show && !off ? (
        <m.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} role="status"
          className="flex items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--gold)_55%,var(--line))] bg-[color-mix(in_srgb,var(--gold)_14%,var(--surface))] px-4 py-2.5 text-[14px]">
          <FlaskConical size={18} className="shrink-0 text-[var(--stamp-gold)]" />
          <span className="flex-1"><b>Demo data.</b> Some events here are samples for testing (the AI Builders Club ones).</span>
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-mist"><X size={16} /></button>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

export function Discover() {
  const { user } = useSession();
  const [events, setEvents] = useState<Event[] | null>(cached);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(kept.search);
  const [day, setDay] = useState(kept.day);
  const [when, setWhen] = useState(kept.when);
  const [place, setPlace] = useState(kept.place);
  const [types, setTypes] = useState<string[]>(kept.types);
  const [certOnly, setCertOnly] = useState(kept.certOnly);
  const [panel, setPanel] = useState(kept.panel);
  const [sheet, setSheet] = useState(false);
  const [view, setView] = useEventView();
  const [attended, setAttended] = useState<Set<string>>(new Set());
  // At 1440px and wider the filters can sit on the right; narrower, they open as a drawer.
  const wide = useIsDesktop('(min-width: 1440px)');
  useEffect(() => { Object.assign(kept, { search, day, when, place, types, certOnly, panel }); }, [search, day, when, place, types, certOnly, panel]);

  const load = useCallback(() => { setError(''); listEvents().then((list) => { cached = list; setEvents(list); }).catch((e: Error) => setError(e.message)); }, []);
  useEffect(load, [load]);
  // The seal goes only on events this student attended (from their stamps).
  useEffect(() => {
    if (!user?.username) { setAttended(new Set()); return; }
    stampsOf(user.username).then((s) => setAttended(new Set(s.filter((x) => x.role === 'ATTENDED').map((x) => x.eventId)))).catch(() => undefined);
  }, [user?.username]);
  // Back from an event: return to where the list was.
  const hasEvents = events !== null;
  useEffect(() => {
    if (!hasEvents) return;
    const y = takeRestore(window.location.pathname + window.location.search);
    if (y === null) return;
    requestAnimationFrame(() => jumpTo(y));
    const t = setTimeout(() => jumpTo(y), 350);
    return () => clearTimeout(t);
  }, [hasEvents]);

  const all = events ?? [];
  const school = user?.school ?? '';
  const states = useMemo(() => [...new Set(all.filter((e) => e.mode !== 'VIRTUAL' && e.state).map((e) => e.state.trim()))].sort(), [all]);
  const typeList = useMemo(() => [...new Set(all.map((e) => e.type).filter(Boolean))].sort(), [all]);
  const placeOptions = [{ value: '', label: 'All locations' }, ...(all.some((e) => e.mode !== 'PHYSICAL') ? [{ value: 'ONLINE', label: 'Online' }] : []), ...states.map((s) => ({ value: s, label: s }))];

  const matches = (e: Event, withWhen: boolean) => {
    const ph = phaseOf(e);
    if (withWhen && when !== 'ALL' && !(when === 'NOW' ? ph === 'LIVE' || ph === 'BEFORE' : when === 'ENDED' ? ph === 'AFTER' : ph === 'CANCELLED')) return false;
    if (types.length && !types.includes(e.type)) return false;
    if (certOnly && e.certificate === 'NONE') return false;
    if (place && !(place === 'ONLINE' ? e.mode !== 'PHYSICAL' : e.state.trim() === place)) return false;
    const q = search.trim().toLowerCase();
    return !q || [e.title, e.summary, e.venue, e.type, e.community.name, e.community.school, e.state].some((v) => (v ?? '').toLowerCase().includes(q));
  };
  const marked = useMemo(() => new Set(all.filter((e) => matches(e, false)).flatMap(daysOf)), [all, types, certOnly, place, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = sortEvents(all, school).filter((e) => (day ? matches(e, false) && daysOf(e).includes(day) : matches(e, true)));
  const filtering = Boolean(search.trim() || day || types.length || place || certOnly) || when !== 'NOW';

  // Only events that are live right now; with none live, the next 3 coming up.
  const liveNow = sortEvents(all.filter((e) => phaseOf(e) === 'LIVE'), school).slice(0, 8);
  const now = liveNow.length ? liveNow : sortEvents(all.filter((e) => phaseOf(e) === 'BEFORE'), school).slice(0, 3);
  const atSchool = !filtering && school ? shown.filter((e) => (e.community.school ?? '').trim().toLowerCase() === school.trim().toLowerCase()) : [];
  const rest = shown.filter((e) => !atSchool.includes(e));
  // When nothing is coming up, show what just happened instead of an empty page.
  const recent = !filtering && !shown.length ? sortEvents(all.filter((e) => phaseOf(e) === 'AFTER'), school).slice(0, 6) : [];
  const reset = () => { setSearch(''); setDay(''); setWhen('NOW'); setPlace(''); setTypes([]); setCertOnly(false); };
  const pickedDay = day ? fmtDate(`${day}T12:00:00`) : '';
  const showPanel = wide && panel;
  const demo = all.some((e) => e.slug.startsWith('demo-'));

  const filters = (
    <div className="flex flex-col gap-4">
      <MiniCalendar value={day} onChange={setDay} marked={marked} />
      {!day ? <RadioGroup title="When" name="when" options={WHEN} value={when} onChange={setWhen} /> : null}
      <RadioGroup title="Location" name="place" options={placeOptions} value={place} onChange={setPlace} />
      <CheckGroup title="Type" all="All types" options={typeList.map((t) => ({ value: t, label: typeStyle(t).label }))} value={types} onChange={setTypes} />
      <fieldset className="flex flex-col gap-0.5 border-t border-line pt-4"><legend className="float-left mb-2 w-full font-display text-[16px] font-bold">Certificate</legend>
        <CheckRow on={certOnly} onClick={() => setCertOnly(!certOnly)}>Only events with a certificate</CheckRow>
      </fieldset>
    </div>
  );
  const filterButton = (
    <button type="button" onClick={() => (wide ? setPanel(!panel) : setSheet(true))} aria-expanded={wide ? panel : sheet}
      className="relative hidden h-12 shrink-0 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-[15px] font-semibold shadow-card hover:bg-mist lg:inline-flex">
      {showPanel ? <PanelRightClose size={17} /> : <SlidersHorizontal size={17} />}{showPanel ? 'Hide filters' : 'Filters'}
      {filtering && !showPanel ? <span className="absolute -top-1 -right-1 size-3 rounded-full bg-green-text ring-2 ring-paper" aria-label="Filters on" /> : null}
    </button>
  );

  return (
    <div className={`mx-auto grid max-w-[1400px] gap-8 px-4 pt-6 sm:px-6 lg:gap-10 lg:px-10 lg:pt-10 ${showPanel ? 'grid-cols-[minmax(0,1fr)_300px]' : ''}`}>
      <div className="mesh flex min-w-0 flex-col gap-7">
        <DemoBanner show={demo} />
        <header className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <m.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} className="text-[44px] font-extrabold sm:text-[56px]">Events</m.h1>
              <m.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { ...spring.soft, delay: 0.06 } }} className="mt-1 text-[16px] text-muted">Every event you attend counts. Go collect your stamps.</m.p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <label className="flex h-12 w-full items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 shadow-card focus-within:border-green-text sm:w-[320px]">
                <Search size={18} className="text-muted" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events, clubs, schools" aria-label="Search events" className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted" />
              </label>
              {filterButton}
            </div>
          </div>
          <Tabs />
        </header>

        {events && !filtering ? <Ticker events={all} /> : null}

        {/* Phones: quick chips and the Filters button. */}
        <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
          <button type="button" onClick={() => setSheet(true)} className="relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[14px] font-semibold">
            <SlidersHorizontal size={15} />Filters{filtering ? <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-green-text ring-2 ring-paper" aria-label="Filters on" /> : null}
          </button>
          {placeOptions.some((p) => p.value === 'ONLINE') ? <Chip on={place === 'ONLINE'} onClick={() => setPlace(place === 'ONLINE' ? '' : 'ONLINE')}>Online</Chip> : null}
          <Chip on={certOnly} onClick={() => setCertOnly(!certOnly)}>With certificate</Chip>
          {typeList.slice(0, 4).map((t) => <Chip key={t} on={types.includes(t)} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])}>{typeStyle(t).label}</Chip>)}
        </div>

        {error ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--coral)_14%,transparent)] px-4 py-3 text-[14px] font-semibold text-coral-text">
            <span>{events ? 'We couldn’t refresh the list. You’re seeing the last one we loaded.' : error}</span>
            <Btn size="sm" kind="secondary" onClick={load}>Try again</Btn>
          </div>
        ) : null}

        {events === null ? (
          error ? null : <ViewSkeleton view={view} />
        ) : (
          <>
            {!filtering ? <HappeningNow events={now} attended={attended} live={liveNow.length > 0} /> : null}
            <LayoutGroup>
            {day ? <h2 className="text-[22px] font-extrabold">On {pickedDay}</h2> : null}
            {atSchool.length ? <Grid list={atSchool} label="At your school" attended={attended} view={view} action={<ViewSwitch value={view} onChange={setView} />} /> : null}
            {rest.length ? <Grid list={rest} label={atSchool.length ? 'Everywhere else' : filtering ? 'Results' : 'Coming up'} attended={attended} view={view} action={atSchool.length ? undefined : <ViewSwitch value={view} onChange={setView} />} /> : null}
            {recent.length ? (
              <>
                <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[15px] text-muted">Nothing is coming up right now. Here&apos;s what happened recently.</p>
                <Grid list={recent} label="Recently ended" attended={attended} view={view} action={atSchool.length || rest.length ? undefined : <ViewSwitch value={view} onChange={setView} />} />
              </>
            ) : null}
            </LayoutGroup>
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

      {/* 1440px and wider: the filter panel on the right, which can be folded away. */}
      {showPanel ? (
        <m.aside initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={spring.soft}>
          <div className="sticky top-8 flex flex-col gap-3">
            <div className="rounded-[22px] border border-line bg-surface p-5 shadow-card">{filters}</div>
            {filtering ? <button type="button" onClick={reset} className="text-[14px] font-semibold text-green-text hover:underline">Clear all filters</button> : null}
          </div>
        </m.aside>
      ) : null}

      {/* Narrower screens: the filters open as a drawer (bottom sheet on phones). */}
      <Sheet open={sheet && !showPanel} onClose={() => setSheet(false)} title="Filters" width={380}>
        <div className="px-5 pb-4">{filters}</div>
        <div className="glass sticky bottom-0 flex gap-2 border-t border-line px-5 py-3">
          {filtering ? <Btn kind="secondary" onClick={reset}>Clear</Btn> : null}
          <Btn wide onClick={() => setSheet(false)}>Show {shown.length} event{shown.length === 1 ? '' : 's'}</Btn>
        </div>
      </Sheet>
    </div>
  );
}
