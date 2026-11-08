'use client';
import { useRef } from 'react';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { useMotionValue, useSpring, useTransform } from 'motion/react';
import { Award, MapPin } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { guestList, publicName } from '@/lib/api/guests';
import { phaseOf, placeLabel, shortWhen, typeStyle } from '@/lib/events';
import { rise, spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { rememberList } from '@/lib/back';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { DateTile } from '@/components/ui/bits';
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

export function goingLabel(count: number, names: string[]) {
  if (!count) return 'Nobody going yet';
  const shown = names.slice(0, 2);
  return shown.length ? `${count} going, including ${shown.join(' and ')}` : `${count} going`;
}

export function EventCard({ event, priority }: { event: Event; priority?: boolean }) {
  const { user } = useSession();
  const tilt = useTilt();
  const phase = phaseOf(event);
  const live = phase === 'LIVE';
  const guests = guestList(event);
  const people = guests.entries.filter((g) => g.visibility === 'VISIBLE').slice(0, 5).map((g) => ({ id: g.id, name: g.name, avatar: g.avatar }));
  const st = typeStyle(event.type);
  const past = phase === 'AFTER' || phase === 'CANCELLED';

  return (
    <m.article variants={rise} style={{ perspective: 900 }}>
      <m.div ref={tilt.ref} onPointerMove={tilt.onMove} onPointerLeave={tilt.onLeave} style={{ rotateX: tilt.rx, rotateY: tilt.ry, transformStyle: 'preserve-3d' }}
        whileHover={{ y: -4 }} transition={spring.soft}
        className="group relative overflow-hidden rounded-[22px] border border-line bg-surface shadow-card transition-shadow duration-300 hover:shadow-lift">
        <Link href={`/events/${event.slug}`} onClick={rememberList} className="absolute inset-0 z-10" aria-label={`${event.title}, ${shortWhen(event)}`} />
        <div className="relative aspect-[16/10] overflow-hidden">
          <div className="absolute inset-0 transition-transform duration-700 ease-out-soft group-hover:scale-[1.05]">
            <EventCover src={event.cover} title={event.title} type={event.type} sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 92vw" priority={priority} className={past ? 'opacity-90 saturate-[.55]' : ''} />
          </div>
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
            <DateTile value={event.startDate} tz={event.timezone} size="sm" />
            {live ? <span className="live-ring inline-flex items-center gap-1.5 rounded-full bg-coral px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-wide text-[#111714]"><span className="live-dot size-1.5 rounded-full bg-[#111714]" />Live</span>
              : phase === 'CANCELLED' ? <span className="rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-paper">Cancelled</span>
              : phase === 'AFTER' ? <span className="rounded-full bg-[rgb(17_23_20/.7)] px-2.5 py-1 text-[12px] font-bold text-white backdrop-blur">Past event</span> : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 p-4 pt-3.5">
          <span className="text-[12px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--green-text)' }}>{st.label}</span>
          <h3 className="line-clamp-2 text-[19px] font-extrabold leading-[1.15]">{event.title}</h3>
          <p className="text-[14px] text-muted">{shortWhen(event)}</p>
          <p className="flex items-center gap-1.5 truncate text-[14px] text-muted"><MapPin size={14} className="shrink-0" />{placeLabel(event)}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            {guests.count && phase !== 'CANCELLED' ? (
              <span className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                {/* Signed out: the count only. A blurred face on a small card just looks like a smudge. */}
                {user ? <AvatarStack people={people} total={0} max={4} size={26} cascade={false}
                  label={goingLabel(guests.count, people.slice(0, 2).map((p) => p.name))} /> : null}
                <span className="tabular-nums">{phase === 'AFTER' ? `${guests.count} attended` : `+${guests.count} going`}</span>
              </span>
            ) : <span className="text-[13px] font-semibold text-muted">{phase === 'CANCELLED' ? 'Called off' : phase === 'AFTER' ? 'No attendance recorded' : 'Be the first to go'}</span>}
            {event.certificate !== 'NONE' && phase !== 'CANCELLED' ? <span title={phase === 'AFTER' ? 'Certificate given' : 'Certificate'} className="inline-flex items-center gap-1 rounded-full bg-tint px-2 py-1 text-[12px] font-bold text-green-text"><Award size={13} />Cert</span> : null}
          </div>
          <span className="truncate text-[13px] text-muted">by <b className="font-semibold text-ink">{event.community.name}</b></span>
        </div>
      </m.div>
    </m.article>
  );
}

export { publicName };
