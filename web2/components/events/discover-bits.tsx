'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { ChevronLeft, ChevronRight, Radio, Sparkles, Users } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { dayKey, phaseOf, shortWhen } from '@/lib/events';
import { spring } from '@/lib/motion';
import { rememberList } from '@/lib/back';
import { EventCover } from './cover';

/**
 * The live ticker. Built only from real events (what is live, what starts today, what is busiest),
 * never from invented numbers.
 */
export function Ticker({ events }: { events: Event[] }) {
  const today = dayKey(new Date());
  const live = events.filter((e) => phaseOf(e) === 'LIVE');
  const todays = events.filter((e) => phaseOf(e) === 'BEFORE' && e.startDate && dayKey(new Date(e.startDate)) === today);
  const busiest = [...events].filter((e) => phaseOf(e) === 'BEFORE').sort((a, b) => b.goingCount - a.goingCount)[0];
  const items: { icon: React.ReactNode; text: React.ReactNode; href?: string }[] = [
    ...live.map((e) => ({ icon: <Radio size={14} className="text-coral-text" />, text: <><b>{e.community.name}</b> is live now: {e.title}</>, href: `/events/${e.slug}` })),
    ...(todays.length ? [{ icon: <Sparkles size={14} className="text-[var(--stamp-gold)]" />, text: <><b>{todays.length}</b> event{todays.length === 1 ? '' : 's'} starting later today</> }] : []),
    ...(busiest && busiest.goingCount ? [{ icon: <Users size={14} className="text-green-text" />, text: <>Busiest this week: <b>{busiest.title}</b>, {busiest.goingCount} going</>, href: `/events/${busiest.slug}` }] : []),
  ];
  if (!items.length) return null;
  const row = [...items, ...items, ...items];
  return (
    <div className="ticker relative overflow-hidden rounded-full border border-line bg-surface py-2 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]" aria-label="What's happening">
      <div className="ticker-track flex w-max gap-8 pl-8 text-[13.5px] text-muted motion-reduce:animate-none">
        {[...row, ...row].map((it, i) => (
          <span key={i} aria-hidden={i >= items.length ? true : undefined} className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            {it.icon}{it.href ? <Link href={it.href} onClick={rememberList} tabIndex={i >= items.length ? -1 : 0} className="hover:text-ink">{it.text}</Link> : it.text}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Live and soon-starting events, auto-advancing with snap. Pauses on touch, hover or focus. */
export function HappeningNow({ events }: { events: Event[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  // Whether the row can move each way. With everything on screen the arrows hide; at an end, that arrow greys out.
  const [can, setCan] = useState({ prev: false, next: false });
  useEffect(() => {
    const el = box.current; if (!el) return;
    const measure = () => setCan({ prev: el.scrollLeft > 4, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => { el.removeEventListener('scroll', measure); ro.disconnect(); };
  }, [events.length]);
  useEffect(() => {
    if (paused || events.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      const el = box.current; if (!el) return;
      const card = el.firstElementChild as HTMLElement | null;
      const step = (card?.offsetWidth ?? 300) + 14;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: 'smooth' });
    }, 4200);
    return () => clearInterval(t);
  }, [paused, events.length]);
  if (!events.length) return null;
  // One card at a time, to an exact card edge so the snap does not pull it back.
  const nudge = (dir: number) => {
    const el = box.current; if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    const left = el.scrollLeft;
    const edges = cards.map((c) => c.offsetLeft - cards[0].offsetLeft);
    const target = dir > 0 ? edges.find((x) => x > left + 4) : [...edges].reverse().find((x) => x < left - 4);
    el.scrollTo({ left: target ?? (dir > 0 ? el.scrollWidth : 0), behavior: 'smooth' });
  };
  return (
    <section aria-labelledby="now-h" className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <h2 id="now-h" className="flex items-center gap-2.5 text-[26px] font-extrabold">
          <span className="live-ring size-2.5 rounded-full bg-coral" />Happening now
        </h2>
        {can.prev || can.next ? (
          <div className="hidden gap-1.5 sm:flex">
            <button type="button" aria-label="Previous" disabled={!can.prev} onClick={() => nudge(-1)} className="grid size-9 place-items-center rounded-full border border-line bg-surface transition-opacity hover:bg-mist disabled:pointer-events-none disabled:opacity-35"><ChevronLeft size={18} /></button>
            <button type="button" aria-label="Next" disabled={!can.next} onClick={() => nudge(1)} className="grid size-9 place-items-center rounded-full border border-line bg-surface transition-opacity hover:bg-mist disabled:pointer-events-none disabled:opacity-35"><ChevronRight size={18} /></button>
          </div>
        ) : null}
      </div>
      <div ref={box} className="no-bar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-px-4 px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0"
        onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
        {events.map((e) => {
          const live = phaseOf(e) === 'LIVE';
          return (
            <Link key={e.id} href={`/events/${e.slug}`} onClick={rememberList} className="group relative aspect-[5/6] w-[min(78vw,300px)] shrink-0 snap-start overflow-hidden rounded-[24px] shadow-card">
              <div className="absolute inset-0 transition-transform duration-700 ease-out-soft group-hover:scale-105"><EventCover src={e.cover} title={e.title} type={e.type} sizes="300px" label={false} /></div>
              <div className="absolute inset-0 bg-gradient-to-t from-[rgb(10_13_11/.88)] via-[rgb(10_13_11/.25)] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4 text-white">
                <span className={`w-fit rounded-full px-2.5 py-1 text-[11.5px] font-extrabold uppercase tracking-wide ${live ? 'live-ring bg-coral text-[#111714]' : 'bg-white/90 text-[#111714]'}`}>{live ? '● Live now' : 'Starting soon'}</span>
                <b className="line-clamp-2 font-display text-[21px] leading-tight tracking-tight">{e.title}</b>
                <span className="text-[13px] text-white/80">{shortWhen(e)} · {e.goingCount} going</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
/** Month calendar: dots on days with events; tap a day to pick it (it ripples), tap again to clear. */
export function MiniCalendar({ value, onChange, marked }: { value: string; onChange: (d: string) => void; marked: Set<string> }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const today = dayKey(new Date());
  const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  const shift = (n: number) => setMonth((x) => new Date(x.getFullYear(), x.getMonth() + n, 1));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <b className="font-display text-[17px]">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b>
        <span className="flex gap-0.5">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid size-8 place-items-center rounded-full hover:bg-mist"><ChevronLeft size={17} /></button>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid size-8 place-items-center rounded-full hover:bg-mist"><ChevronRight size={17} /></button>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center" role="grid" aria-label="Pick a day">
        {WEEK.map((w, i) => <span key={i} className="pb-1 text-[11.5px] font-semibold text-muted">{w}</span>)}
        {days.map((d) => {
          const key = dayKey(d); const on = key === value; const out = d.getMonth() !== month.getMonth();
          return (
            <button key={key} type="button" aria-pressed={on} aria-label={d.toDateString()} onClick={() => onChange(on ? '' : key)}
              className={`relative mx-auto grid size-9 place-items-center rounded-full text-[13.5px] font-semibold ${out ? 'text-muted/50' : ''} ${key === today && !on ? 'bg-mist' : ''} ${on ? 'text-paper' : 'hover:bg-mist'}`}>
              {on ? <m.span layoutId="cal-on" className="absolute inset-0 rounded-full bg-ink" transition={spring.snap} /> : null}
              {on ? <m.span className="absolute inset-0 rounded-full border-2 border-ink" initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 1.7, opacity: 0 }} transition={{ duration: 0.5 }} /> : null}
              <span className="relative">{d.getDate()}</span>
              {marked.has(key) ? <span className={`absolute bottom-1 size-1 rounded-full ${on ? 'bg-paper' : 'bg-green-text'}`} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Checkbox rows, branded: nothing ticked means everything shows, so "All" is ticked when the list is empty. */
export function CheckGroup({ title, all, options, value, onChange }: { title: string; all: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  if (!options.length) return null;
  const flip = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset className="flex flex-col gap-0.5 border-t border-line pt-4">
      <legend className="float-left mb-2 w-full font-display text-[16px] font-bold">{title}</legend>
      <CheckRow on={!value.length} onClick={() => onChange([])}>{all}</CheckRow>
      {options.map((o) => <CheckRow key={o.value} on={value.includes(o.value)} onClick={() => flip(o.value)}>{o.label}</CheckRow>)}
    </fieldset>
  );
}

export function CheckRow({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-lg py-1.5 text-[14.5px] ${on ? 'font-semibold text-ink' : 'text-muted hover:text-ink'}`}>
      <input type="checkbox" checked={on} onChange={onClick} className="peer sr-only" />
      <m.span animate={{ scale: on ? [1, 1.18, 1] : 1 }} transition={{ duration: 0.28, ease: "easeOut" }}
        className={`grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-green-text ${on ? 'border-green bg-green text-white' : 'border-line bg-surface'}`}>
        {on ? <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 6.3l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
      </m.span>
      {children}
    </label>
  );
}
