'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { useMotionValue, useSpring, useTransform } from 'motion/react';
import { Award, MapPin } from 'lucide-react';
import type { Event, EventPhase } from '@/lib/api/types';
import { emptyGuestList, fetchGuestList, type LoadedGuestList } from '@/lib/api/guests';

/** Faces per event, kept for the visit so scrolling back doesn't refetch. */
const FACES = new Map<string, LoadedGuestList>();
import { dateTile, phaseOf, placeLabel, shortWhen, typeStyle } from '@/lib/events';
import { countWord } from '@/lib/attendance';
import { rise, spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { rememberList } from '@/lib/back';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { DateTile } from '@/components/ui/bits';
import { Stamp } from '@/components/brand/stamp';
import { EventCover } from './cover';

/** Lift and tilt toward the cursor, on devices with a mouse only (max 6°). */
function useTilt() {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0); const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), spring.soft);
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), spring.soft);
  const fine = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onMove = (e: React.PointerEvent) => {
    if (!fine() || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5); y.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { x.set(0); y.set(0); };
  return { ref, rx, ry, onMove, onLeave };
}

/** The coral LIVE badge, the same on every card and page. */
export function LiveBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`live-ring inline-flex items-center gap-1.5 rounded-full bg-coral px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-wide text-[#111714] ${className}`}>
      <span className="live-dot size-1.5 rounded-full bg-[#111714]" />Live
    </span>
  );
}

/**
 * Who is going, worded the same on every card: up to four faces (initials from names), then "+N going"
 * only for people not pictured. Nobody yet: "Be the first to go". Signed out: the count, no faces.
 */
export function GoingLine({ event, phase }: { event: Event; phase: EventPhase }) {
  const { user } = useSession();
  const ref = useRef<HTMLSpanElement>(null);
  const [faces, setFaces] = useState<LoadedGuestList | null>(() => FACES.get(event.id) ?? null);
  // Faces load only once the card is on screen (and only for signed-in students); counts are always real.
  useEffect(() => {
    const el = ref.current;
    if (!el || !user || faces || event.id === 'preview' || phase === 'CANCELLED' || event.external) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      fetchGuestList(event, user).then((l) => { FACES.set(event.id, l); setFaces(l); }).catch(() => undefined);
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [user, faces, event, phase]);
  if (phase === 'CANCELLED') return <span className="text-[13px] font-semibold text-muted">Called off</span>;
  // External listings: no head count from us, just where registration happens.
  if (event.external) return <span className="truncate text-[13px] font-semibold text-muted">{event.externalRegistration ? `Registration on ${event.externalRegistration.label}` : 'Registration on another site'}</span>;
  const guests = faces ?? emptyGuestList(event);
  const verb = countWord(event);
  if (!guests.count) return <span ref={ref} className="text-[13px] font-semibold text-muted">{verb === 'attended' ? 'No attendance recorded' : verb === 'registered' ? 'Attendance not final yet' : 'Be the first to go'}</span>;
  const pictured = user ? guests.entries.slice(0, Math.min(4, guests.count)).map((g) => ({ id: g.id, name: g.name, avatar: g.avatar })) : [];
  const others = guests.count - pictured.length;
  const names = pictured.slice(0, 2).map((p) => p.name);
  const label = `${guests.count} ${verb}${names.length ? `, including ${names.join(' and ')}` : ''}`;
  return (
    <span ref={ref} className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-muted" aria-label={label}>
      {pictured.length ? <AvatarStack people={pictured} total={0} max={4} size={26} cascade={false} label={label} /> : null}
      <span className="truncate tabular-nums">{others > 0 && pictured.length ? `+${others} ${verb}` : `${guests.count} ${verb}`}</span>
    </span>
  );
}

/** The seal, only on events the signed-in student attended (attendance finalized). */
export function AttendedSeal({ event, size = 64 }: { event: Event; size?: number }) {
  return (
    <m.span initial={{ scale: 1.6, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: -12, opacity: 1 }} transition={spring.bouncy}
      className="absolute right-3 bottom-3 rounded-full bg-paper/85 p-0.5 shadow-card backdrop-blur" title="You attended">
      <Stamp label={event.title.replace(/^\[(DEMO|TEST)\]\s*/i, '')} date={dateTile(event.startDate, event.timezone)} size={size} tilt={0} title={`You attended ${event.title}`} />
    </m.span>
  );
}

export function EventCard({ event, priority, attended }: { event: Event; priority?: boolean; attended?: boolean }) {
  const tilt = useTilt();
  const phase = phaseOf(event);
  const live = phase === 'LIVE';
  const st = typeStyle(event.type);
  const past = phase === 'AFTER' || phase === 'CANCELLED';

  return (
    <m.article variants={rise} style={{ perspective: 900 }} className={`relative rounded-[22px] ${live ? 'live-card' : ''}`}>
      <m.div ref={tilt.ref} onPointerMove={tilt.onMove} onPointerLeave={tilt.onLeave} style={{ rotateX: tilt.rx, rotateY: tilt.ry, transformStyle: 'preserve-3d' }}
        whileHover={{ y: -4 }} transition={spring.soft}
        className={`group relative overflow-hidden rounded-[22px] border bg-surface shadow-card transition-shadow duration-300 hover:shadow-lift ${live ? 'border-coral/60' : 'border-line'}`}>
        <Link href={`/events/${event.slug}`} onClick={rememberList} className="absolute inset-0 z-10" aria-label={`${event.title}, ${shortWhen(event)}`} />
        <div className="relative aspect-[16/10] overflow-hidden">
          <div className="absolute inset-0 transition-transform duration-700 ease-out-soft group-hover:scale-[1.05]">
            <EventCover src={event.cover} title={event.title} type={event.type} sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 92vw" priority={priority} className={past ? 'opacity-90 saturate-[.55]' : ''} />
          </div>
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
            <DateTile value={event.startDate} tz={event.timezone} size="sm" />
            {live ? <LiveBadge />
              : phase === 'CANCELLED' ? <span className="rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-paper">Cancelled</span>
              : phase === 'AFTER' ? <span className="rounded-full bg-[rgb(17_23_20/.7)] px-2.5 py-1 text-[12px] font-bold text-white backdrop-blur">Past event</span> : null}
          </div>
          {attended ? <AttendedSeal event={event} /> : null}
        </div>
        <div className="flex flex-col gap-2 p-4 pt-3.5">
          <span className="text-[12px] font-bold uppercase tracking-[.1em] text-green-text">{st.label}</span>
          <h3 className="line-clamp-2 text-[19px] font-extrabold leading-[1.15]">{event.title}</h3>
          <p className="text-[14px] text-muted">{shortWhen(event)}</p>
          <p className="flex items-center gap-1.5 truncate text-[14px] text-muted"><MapPin size={14} className="shrink-0" />{placeLabel(event)}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <GoingLine event={event} phase={phase} />
            {event.certificate !== 'NONE' && phase !== 'CANCELLED' && !event.external ? <span title="Certificate for attendees, issued after the organizer finalizes attendance" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-tint px-2 py-1 text-[12px] font-bold text-green-text"><Award size={13} />Cert</span> : null}
          </div>
          <span className="truncate text-[13px] text-muted">by <b className="font-semibold text-ink">{event.community.name}</b></span>
        </div>
      </m.div>
    </m.article>
  );
}
