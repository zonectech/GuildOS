'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { Award, LayoutGrid, List, MapPin, Ticket } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { dateTile, phaseOf, placeLabel, shortWhen, typeStyle } from '@/lib/events';
import { spring } from '@/lib/motion';
import { rememberList } from '@/lib/back';
import { Avatar } from '@/components/ui/avatar';
import { DateTile } from '@/components/ui/bits';
import { Stamp } from '@/components/brand/stamp';
import { EventCover } from './cover';
import { GoingLine, LiveBadge } from './event-card';

export type EventView = 'tickets' | 'list' | 'cards';
const KEY = 'otr-events-view';
const VIEWS: { value: EventView; label: string; icon: typeof Ticket }[] = [
  { value: 'tickets', label: 'Tickets', icon: Ticket }, { value: 'list', label: 'List', icon: List }, { value: 'cards', label: 'Cards', icon: LayoutGrid },
];

/** The chosen view, remembered on this device. Tickets until someone picks another. */
export function useEventView() {
  const [view, setView] = useState<EventView>('tickets');
  useEffect(() => { try { const v = localStorage.getItem(KEY); if (v === 'tickets' || v === 'list' || v === 'cards') setView(v); } catch { /* storage blocked */ } }, []);
  const choose = (v: EventView) => { setView(v); try { localStorage.setItem(KEY, v); } catch { /* storage blocked */ } };
  return [view, choose] as const;
}

/** Tickets · List · Cards, as a segmented control with icons. */
export function ViewSwitch({ value, onChange }: { value: EventView; onChange: (v: EventView) => void }) {
  return (
    <div role="radiogroup" aria-label="View" className="flex rounded-xl border border-line bg-surface p-1 shadow-card">
      {VIEWS.map(({ value: v, label, icon: Icon }) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} title={label}
          className={`relative flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-semibold ${value === v ? 'text-ink' : 'text-muted hover:text-ink'}`}>
          {value === v ? <m.span layoutId="view-on" className="absolute inset-0 rounded-lg bg-mist" transition={spring.snap} /> : null}
          <Icon size={16} className="relative" /><span className="relative max-sm:sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}

const cleanTitle = (t: string) => t.replace(/^\[(DEMO|TEST)\]\s*/i, '');

/** The host's logo and name. A logo that fails to load falls back to the community's initials. */
function HostMark({ event }: { event: Event }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
      {event.community.logo && !broken
        ? <Image src={event.community.logo} alt="" width={18} height={18} onError={() => setBroken(true)} className="size-[18px] shrink-0 rounded-full object-cover" />
        : <Avatar name={event.community.name} size={18} ring={false} />}
      <span className="truncate font-semibold text-ink">{event.community.name}</span>
    </span>
  );
}

const CertChip = ({ event }: { event: Event }) => (event.certificate !== 'NONE' && phaseOf(event) !== 'CANCELLED'
  ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-tint px-2 py-0.5 text-[11.5px] font-bold text-green-text"><Award size={12} />Cert</span> : null);

/**
 * Tickets: a horizontal ticket stub. Date on the stub (and LIVE under it), a perforated tear line,
 * the details in the middle, a small cover on the right (hidden on very narrow phones).
 */
export function EventTicket({ event, attended }: { event: Event; attended?: boolean }) {
  const phase = phaseOf(event);
  const live = phase === 'LIVE';
  const past = phase === 'AFTER' || phase === 'CANCELLED';
  return (
    <m.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} transition={spring.soft} className={`group relative rounded-[20px] ${live ? 'live-card' : ''}`}>
      <Link href={`/events/${event.slug}`} onClick={rememberList} aria-label={`${event.title}, ${shortWhen(event)}`}
        className={`flex h-[110px] overflow-hidden rounded-[20px] border bg-surface shadow-card transition-shadow hover:shadow-lift ${live ? 'border-coral/60' : 'border-line'} ${past ? 'opacity-[.92]' : ''}`}>
        {/* Stub: tilts a touch on hover. */}
        <span className="relative flex w-[86px] shrink-0 flex-col items-center justify-center gap-1.5 bg-mist transition-transform duration-300 group-hover:-rotate-2">
          <DateTile value={event.startDate} tz={event.timezone} size="sm" />
          {live ? <LiveBadge className="scale-90" /> : phase === 'CANCELLED' ? <span className="text-[11px] font-bold text-muted">Cancelled</span> : phase === 'AFTER' ? <span className="text-[11px] font-bold text-muted">Past</span> : null}
          {attended ? (
            <span className="absolute -right-3 -bottom-2 z-10" title="You attended">
              <Stamp label={cleanTitle(event.title)} date={dateTile(event.startDate, event.timezone)} size={46} tilt={-14} title={`You attended ${event.title}`} />
            </span>
          ) : null}
        </span>
        {/* The tear line: dashes with half-circle notches top and bottom. */}
        <span aria-hidden="true" className="relative w-0 border-l-2 border-dashed border-line">
          <span className="absolute -top-2 -left-[9px] size-4 rounded-full border border-line bg-paper" />
          <span className="absolute -bottom-2 -left-[9px] size-4 rounded-full border border-line bg-paper" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-2.5">
          <b className="truncate font-display text-[17px] leading-tight tracking-tight">{event.title}</b>
          <span className="truncate text-[13px] text-muted">{shortWhen(event)} · {placeLabel(event)}</span>
          <span className="flex min-w-0 items-center gap-3">
            <HostMark event={event} />
            <span className="hidden min-w-0 sm:block"><GoingLine event={event} phase={phase} /></span>
            <CertChip event={event} />
          </span>
        </span>
        <span className="relative m-2.5 aspect-square shrink-0 overflow-hidden rounded-[14px] max-[380px]:hidden">
          <EventCover src={event.cover} title={event.title} type={event.type} sizes="90px" className={past ? 'saturate-[.55]' : ''} />
        </span>
      </Link>
    </m.div>
  );
}

/** List: one agenda row (~72px) on the day's timeline; a pulsing coral dot when live. */
export function EventAgendaRow({ event, attended }: { event: Event; attended?: boolean }) {
  const phase = phaseOf(event);
  const live = phase === 'LIVE';
  const time = event.startDate ? new Date(event.startDate).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: event.timezone }) : 'TBA';
  return (
    <m.div whileTap={{ scale: 0.98 }} transition={spring.snap} className="relative pl-7">
      <span aria-hidden="true" className={`absolute top-1/2 left-[5px] size-3 -translate-y-1/2 rounded-full border-2 border-paper ${live ? 'live-ring bg-coral' : phase === 'AFTER' || phase === 'CANCELLED' ? 'bg-line' : 'bg-green-text'}`} />
      <Link href={`/events/${event.slug}`} onClick={rememberList} className="flex h-[72px] items-center gap-3 rounded-2xl px-3 hover:bg-mist">
        <span className="w-[62px] shrink-0 text-[13.5px] font-bold tabular-nums">{time}{live ? <span className="block text-[11px] font-extrabold text-coral-text uppercase">Live</span> : null}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="truncate text-[15.5px]">{event.title}{attended ? <span className="ml-1.5 align-middle text-[11px] font-bold text-green-text">· Attended</span> : null}</b>
          <span className="flex min-w-0 items-center gap-1 truncate text-[13px] text-muted"><MapPin size={12} className="shrink-0" />{placeLabel(event)}</span>
        </span>
        <span className="hidden sm:block"><GoingLine event={event} phase={phase} /></span>
        <span className="relative size-12 shrink-0 overflow-hidden rounded-xl"><EventCover src={event.cover} title={event.title} type={event.type} sizes="48px" /></span>
      </Link>
    </m.div>
  );
}

/** Cards: compact (~280px). Cover at 2:1 with the type label and date on it, then the essentials. */
export function EventCompactCard({ event, attended }: { event: Event; attended?: boolean }) {
  const phase = phaseOf(event);
  const live = phase === 'LIVE';
  const past = phase === 'AFTER' || phase === 'CANCELLED';
  return (
    <m.div whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} transition={spring.soft} className={`group relative rounded-[20px] ${live ? 'live-card' : ''}`}>
      <Link href={`/events/${event.slug}`} onClick={rememberList} aria-label={`${event.title}, ${shortWhen(event)}`}
        className={`flex flex-col overflow-hidden rounded-[20px] border bg-surface shadow-card transition-shadow hover:shadow-lift ${live ? 'border-coral/60' : 'border-line'}`}>
        <span className="relative aspect-[2/1] overflow-hidden">
          <span className="absolute inset-0 transition-transform duration-700 ease-out-soft group-hover:scale-105"><EventCover src={event.cover} title={event.title} type={event.type} sizes="(min-width: 1024px) 30vw, 92vw" className={past ? 'saturate-[.55]' : ''} /></span>
          <span className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
            <DateTile value={event.startDate} tz={event.timezone} size="sm" />
            {live ? <LiveBadge /> : <span className="rounded-full bg-[rgb(17_23_20/.68)] px-2.5 py-1 text-[11.5px] font-bold text-white backdrop-blur">{phase === 'CANCELLED' ? 'Cancelled' : phase === 'AFTER' ? 'Past event' : typeStyle(event.type).label}</span>}
          </span>
          {attended ? <span className="absolute right-2 bottom-2" title="You attended"><Stamp label={cleanTitle(event.title)} date={dateTile(event.startDate, event.timezone)} size={52} tilt={-12} title={`You attended ${event.title}`} /></span> : null}
        </span>
        <span className="flex flex-col gap-1.5 p-3.5">
          <b className="line-clamp-2 font-display text-[17px] leading-[1.18] tracking-tight">{event.title}</b>
          <span className="truncate text-[13px] text-muted">{shortWhen(event)} · {placeLabel(event)}</span>
          <span className="mt-0.5 flex min-w-0 items-center justify-between gap-2">
            <HostMark event={event} />
            <span className="flex shrink-0 items-center gap-2"><GoingLine event={event} phase={phase} /><CertChip event={event} /></span>
          </span>
        </span>
      </Link>
    </m.div>
  );
}

/** "Today", "Tomorrow" or "Thu 12 Nov", in the event's own timezone. */
export function dayHeading(e: Event) {
  if (!e.startDate) return 'Date to be announced';
  const tz = e.timezone || 'Africa/Lagos';
  const key = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz });
  const d = new Date(e.startDate);
  if (key(d) === key(new Date())) return 'Today';
  if (key(d) === key(new Date(Date.now() + 86400e3))) return 'Tomorrow';
  if (key(d) === key(new Date(Date.now() - 86400e3))) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz });
}

/** Loading placeholders shaped like the current view. */
export function ViewSkeleton({ view }: { view: EventView }) {
  if (view === 'tickets') return <div className="flex flex-col gap-3">{Array.from({ length: 5 }, (_, i) => <div key={i} className="shimmer h-[110px] rounded-[20px]" />)}</div>;
  if (view === 'list') return <div className="flex flex-col gap-2"><div className="shimmer h-5 w-24 rounded" />{Array.from({ length: 5 }, (_, i) => <div key={i} className="shimmer ml-7 h-[60px] rounded-2xl" />)}</div>;
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="overflow-hidden rounded-[20px] border border-line bg-surface"><div className="shimmer aspect-[2/1]" /><div className="space-y-2 p-3.5"><div className="shimmer h-4 w-3/4 rounded" /><div className="shimmer h-3 w-1/2 rounded" /><div className="shimmer h-6 w-full rounded-full" /></div></div>)}</div>;
}
