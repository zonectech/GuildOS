'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { Users } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { ACCENTS, memberPreview, type Accent, type CommunityCard as Community } from '@/lib/api/communities';
import { phaseOf, shortWhen } from '@/lib/events';
import { spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { Crest } from '@/components/brand/crest';
import { SealText, Stamp } from '@/components/brand/stamp';
import { LiveBadge } from '@/components/events/event-card';

/** Verified communities get a small tick seal that draws itself in, with a plain explanation on hover/focus. */
export function VerifiedTick({ size = 18 }: { size?: number }) {
  return (
    <span className="group/tick relative inline-grid shrink-0 place-items-center" tabIndex={0} aria-label="Verified community">
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="text-green-text">
        <m.circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={spring.soft} style={{ originX: '50%', originY: '50%' }} />
        <circle cx="12" cy="12" r="7" fill="currentColor" />
        <m.path d="M8.6 12.2l2.3 2.3 4.6-4.9" fill="none" stroke="var(--paper)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.15 }} />
      </svg>
      <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 w-56 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-[12.5px] font-medium leading-snug text-paper opacity-0 shadow-lift transition-opacity group-hover/tick:opacity-100 group-focus/tick:opacity-100">
        Verified: a platform reviewer checked who runs this community and that they&apos;re allowed to.
      </span>
    </span>
  );
}

/** The community's logo, or its crest when there is none (or it fails to load). */
/**
 * A community's logo, round. If there's no logo or it fails to load,
 * show the community's initials on its accent colour (or its crest when no accent is known).
 */
export function CommunityLogo({ c, size = 48, className = '' }: { c: Pick<Community, 'name' | 'logo'> & { accent?: Accent }; size?: number; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (c.logo && failedSrc !== c.logo) {
    return <Image src={c.logo} alt={`${c.name} logo`} width={size <= 48 ? 48 : 96} height={size <= 48 ? 48 : 96} onError={() => setFailedSrc(c.logo)}
      className={`shrink-0 rounded-full bg-surface object-contain p-0.5 ${className}`} style={{ width: size, height: size }} />;
  }
  if (c.accent) {
    const initials = c.name.replace(/^\[[^\]]*\]\s*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
    return <span aria-hidden className={`grid shrink-0 place-items-center rounded-full font-display font-extrabold text-white ${className}`} style={{ width: size, height: size, background: ACCENTS[c.accent], fontSize: Math.round(size * 0.38) }}>{initials}</span>;
  }
  return <span className={`grid shrink-0 place-items-center rounded-full bg-surface ${className}`} style={{ width: size, height: size }}><Crest name={c.name} size={size} tilt={0} /></span>;
}

/** Member faces for a card, fetched only once the card is on screen. */
function useMemberFaces(id: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [faces, setFaces] = useState<{ id: string; name: string; avatar: string }[]>([]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); memberPreview(id).then(setFaces).catch(() => undefined); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [id]);
  return { ref, faces };
}

/** A community card: cover, logo, name and tick, school, category, members, next event. Live events ring it in coral. */
export const CATEGORIES = ['Tech', 'Faith', 'Career', 'Arts', 'Sports', 'Departmental', 'Social', 'Health', 'Entrepreneurship'];
// Older communities used longer or upper-case category names; match them to the chips.
const CAT_ALIAS: Record<string, string> = { technology: 'tech', religious: 'faith', religion: 'faith', business: 'entrepreneurship' };
export const catKey = (c: string) => { const k = c.trim().toLowerCase(); return CAT_ALIAS[k] ?? k; };
/** One spelling for every category: "TECH", "Technology" and "tech" all read "Tech". */
export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.toLowerCase() === catKey(c)) ?? c.trim().toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase());

export function CommunityCard({ c, next, live }: { c: Community; next?: Event | null; live?: boolean }) {
  const { user } = useSession();
  const { ref, faces } = useMemberFaces(c.id);
  return (
    <m.div ref={ref} whileHover={{ y: -4, rotate: -0.6 }} whileTap={{ scale: 0.97 }} transition={spring.soft} className={`group relative rounded-[22px] ${live ? 'live-card' : ''}`}>
      <Link href={`/communities/${c.slug}`} className={`flex h-full flex-col overflow-hidden rounded-[22px] border bg-surface shadow-card transition-shadow hover:shadow-lift ${live ? 'border-coral/60' : 'border-line'}`}>
        <span className="relative h-24 overflow-hidden bg-[linear-gradient(135deg,var(--tint),var(--mist))]">
          {c.cover ? <Image src={c.cover} alt="" fill sizes="(min-width: 1024px) 30vw, 92vw" className="object-cover transition-transform duration-700 ease-out-soft group-hover:scale-105" /> : null}
          {live ? <span className="absolute top-2.5 right-2.5"><LiveBadge /></span> : null}
        </span>
        <span className="relative z-10 -mt-8 flex items-end gap-2 px-4"><span className="rounded-full bg-surface p-1 shadow-card"><CommunityLogo c={c} size={56} /></span></span>
        <span className="flex flex-1 flex-col gap-1.5 px-4 pt-2 pb-4">
          <b className="flex items-center gap-1.5 font-display text-[18px] leading-tight tracking-tight"><span className="truncate">{c.name}</span>{c.verified ? <VerifiedTick /> : null}</b>
          <span className="truncate text-[13px] text-muted">{c.school}</span>
          {c.category ? <span className="w-fit rounded-full bg-mist px-2.5 py-0.5 text-[11.5px] font-bold text-muted">{categoryLabel(c.category)}</span> : null}
          <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-[13px]">
            <span className="flex items-center gap-2 font-semibold text-muted">
              {user && faces.length ? <AvatarStack people={faces.slice(0, 4)} total={0} max={4} size={24} cascade={false} label={`${c.memberCount} members`} /> : <Users size={14} />}
              <span className="tabular-nums">{c.memberCount} member{c.memberCount === 1 ? '' : 's'}</span>
            </span>
          </span>
          <span className="truncate text-[12.5px] text-muted">{next ? <>Next event: <b className="font-semibold text-ink">{shortWhen(next).split(',').slice(0, 2).join(',')}</b></> : 'No upcoming events'}</span>
        </span>
      </Link>
    </m.div>
  );
}

const MEDAL: [string, 'gold' | 'ink' | 'coral'][] = [['1st', 'gold'], ['2nd', 'ink'], ['3rd', 'coral']];

/**
 * Most active this month: communities ranked by check-ins at their events over the last 30 days
 * (real counts). Bars grow with a spring, one after another; the top three get seals.
 */
export function Leaderboard({ rows }: { rows: { c: Community; checkIns: number }[] }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.checkIns), 1);
  return (
    <ol className="flex flex-col gap-2.5" aria-label="Most active communities this month">
      {rows.map(({ c, checkIns }, i) => (
        <m.li key={c.id} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ ...spring.soft, delay: i * 0.06 }}>
          <Link href={`/communities/${c.slug}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-mist">
            <span className="grid w-12 shrink-0 place-items-center">
            {i < 3 ? <Stamp label={MEDAL[i][0]} ink={MEDAL[i][1]} size={44} tilt={-10} center={<SealText>{String(i + 1)}</SealText>} title={`${MEDAL[i][0]} place`} />
                : <b className="text-[16px] text-muted tabular-nums">{i + 1}</b>}
            </span>
            <CommunityLogo c={c} size={36} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5"><b className="truncate text-[14.5px]">{c.name}</b>{c.verified ? <VerifiedTick size={15} /> : null}</span>
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-mist">
                <m.span className={`block h-full origin-left rounded-full ${i === 0 ? 'bg-gold' : 'bg-green-text'}`} initial={{ scaleX: 0 }} whileInView={{ scaleX: Math.max(0.04, checkIns / max) }} viewport={{ once: true }} transition={{ ...spring.soft, delay: 0.15 + i * 0.08 }} />
              </span>
            </span>
            <span className="w-20 shrink-0 text-right text-[13px] font-semibold text-muted tabular-nums">{checkIns} check-in{checkIns === 1 ? '' : 's'}</span>
          </Link>
        </m.li>
      ))}
    </ol>
  );
}

/** Live, or the next upcoming, event for each community (by host or co-host id). */
export function eventsByCommunity(events: Event[]) {
  const live = new Set<string>();
  const next = new Map<string, Event>();
  const checkIns = new Map<string, number>();
  const monthAgo = Date.now() - 30 * 86400e3;
  for (const e of events) {
    const id = e.community.id;
    const ph = phaseOf(e);
    if (ph === 'LIVE') live.add(id);
    if ((ph === 'BEFORE' || ph === 'LIVE') && e.startDate) {
      const cur = next.get(id);
      if (!cur || new Date(e.startDate) < new Date(cur.startDate as string)) next.set(id, e);
    }
    if (e.startDate && new Date(e.startDate).getTime() >= monthAgo) checkIns.set(id, (checkIns.get(id) ?? 0) + Math.max(e.checkedInCount, e.attendedCount));
  }
  return { live, next, checkIns };
}
