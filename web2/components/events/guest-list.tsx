'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup } from 'motion/react';
import * as m from 'motion/react-m';
import { ChevronRight, Info, Search, Users } from 'lucide-react';
import type { Event, EventPhase, GuestListEntry, User } from '@/lib/api/types';
import { GUEST_PAGE, guestList, hostsOf, publicName } from '@/lib/api/guests';
import { VIEWER_SAMPLE } from '@/lib/api/mock/guests';
import { classic } from '@/lib/api/client';
import { phaseOf } from '@/lib/events';
import { spring } from '@/lib/motion';
import { Avatar, MiniStamp } from '@/components/ui/avatar';
import { AvatarStack, type StackPerson } from '@/components/ui/avatar-stack';
import { Btn, Chip, Odometer } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';

const shownName = (g: GuestListEntry) => (g.visibility === 'DEPARTMENT_ONLY' ? '?' : g.name);
const toStack = (g: GuestListEntry, phase: EventPhase): StackPerson => ({ id: g.id, name: shownName(g), avatar: g.avatar, checked: phase === 'LIVE' && g.checkedIn, stamped: phase === 'AFTER' });

/**
 * "Going · 128" with a big avatar stack, right below the event's key details.
 * `me` is the signed-in student once they register: their face flies into the front of the stack.
 */
export function GuestSection({ event, viewer, me }: { event: Event; viewer: User | null; me: boolean }) {
  const phase = phaseOf(event);
  const list = useMemo(() => guestList(event), [event]);
  const [open, setOpen] = useState(false);
  const people = list.entries.slice(0, 8).map((g) => toStack(g, phase));
  const stack = me && viewer ? [{ id: 'me', name: viewer.fullName, avatar: viewer.avatar }, ...people].slice(0, 8) : people;
  const count = list.count;
  const word = phase === 'AFTER' ? 'Attended' : 'Going';
  const names = list.entries.filter((g) => g.visibility === 'VISIBLE').slice(0, 2).map((g) => g.name);
  const label = count ? `${count} people ${phase === 'AFTER' ? 'attended' : 'going'}${names.length ? `, including ${names.join(' and ')}` : ''}` : phase === 'AFTER' ? 'No attendance recorded' : 'Nobody yet';

  if (phase === 'CANCELLED') return null;
  return (
    <section aria-labelledby="guests-h" className="rounded-[24px] border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 id="guests-h" className="flex items-baseline gap-2 text-[22px] font-extrabold">
          {word}<span className="text-muted">·</span><Odometer value={count} className="text-green-text" />
        </h2>
        {list.preview ? <span title="The people shown are placeholders until guest lists are connected to the backend. The count is real." className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-[11.5px] font-bold text-muted"><Info size={12} />Sample guests</span> : null}
      </div>

      {viewer && count ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {list.highlights.department ? <Highlight>{list.highlights.department} from your department</Highlight> : null}
          {list.highlights.level ? <Highlight>{list.highlights.level} from your level</Highlight> : null}
          {list.highlights.attendedWithBefore ? <Highlight>{list.highlights.attendedWithBefore} you&apos;ve attended events with</Highlight> : null}
        </div>
      ) : null}

      {count || me ? (
        <button type="button" onClick={() => (viewer ? setOpen(true) : undefined)} disabled={!viewer} aria-haspopup="dialog"
          className="group mt-4 flex w-full items-center justify-between gap-3 rounded-2xl p-1 text-left enabled:hover:bg-mist">
          <AvatarStack people={stack} total={count + (me ? 1 : 0)} max={8} size={44} label={label} blurred={!viewer} />
          {viewer ? <span className="flex items-center gap-1 text-[14px] font-semibold text-green-text">See all<ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></span> : null}
        </button>
      ) : <p className="mt-3 text-[15px] text-muted">{phase === 'AFTER' ? 'No attendance was recorded for this event.' : 'Nobody yet. Be the first, and your face leads the list.'}</p>}

      {!viewer && count ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mist px-4 py-3">
          <span className="text-[14px] font-semibold">{phase === 'AFTER' ? 'Sign in to see who attended' : 'Sign in to see who’s going'}</span>
          <Btn size="sm" href={`/login?next=${encodeURIComponent(`/events/${event.slug}`)}`}>Sign in</Btn>
        </div>
      ) : null}

      {phase === 'LIVE' && count ? <CheckedInBar done={event.checkedInCount} total={count} /> : null}

      {viewer ? <GuestSheet open={open} onClose={() => setOpen(false)} event={event} phase={phase} entries={list.entries} viewer={viewer} /> : null}
    </section>
  );
}

const Highlight = ({ children }: { children: React.ReactNode }) => (
  <m.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={spring.bouncy} className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-[13px] font-bold text-green-text">
    <Users size={13} />{children}
  </m.span>
);

/** "86 of 128 checked in", the bar filling with a spring as people are scanned in. */
function CheckedInBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex justify-between text-[13.5px] font-semibold"><span><span className="tabular-nums">{done}</span> of <span className="tabular-nums">{total}</span> checked in</span><span className="text-muted tabular-nums">{Math.round(pct)}%</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label="Checked in">
        <m.div className="h-full origin-left rounded-full bg-green-text" initial={{ scaleX: 0 }} animate={{ scaleX: pct / 100 }} transition={spring.soft} />
      </div>
    </div>
  );
}

type Tab = 'GOING' | 'CHECKED_IN' | 'HOSTS';
type Filter = 'SCHOOL' | 'DEPARTMENT' | 'LEVEL';

/** The full list: a bottom sheet on phones, a side panel on desktop. */
function GuestSheet({ open, onClose, event, phase, entries, viewer }: { open: boolean; onClose: () => void; event: Event; phase: EventPhase; entries: GuestListEntry[]; viewer: User }) {
  const tabs: { value: Tab; label: string }[] = phase === 'AFTER' ? [{ value: 'GOING', label: 'Attended' }, { value: 'HOSTS', label: 'Hosts' }]
    : phase === 'LIVE' ? [{ value: 'GOING', label: 'Going' }, { value: 'CHECKED_IN', label: 'Checked in' }, { value: 'HOSTS', label: 'Hosts' }]
    : [{ value: 'GOING', label: 'Going' }, { value: 'HOSTS', label: 'Hosts' }];
  const [tab, setTab] = useState<Tab>('GOING');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [q, setQ] = useState('');
  const [pages, setPages] = useState(1);
  const [person, setPerson] = useState<GuestListEntry | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const hosts = useMemo(() => hostsOf(event), [event]);

  const flip = (f: Filter) => setFilters((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));
  const base = tab === 'HOSTS' ? hosts : tab === 'CHECKED_IN' ? entries.filter((g) => g.checkedIn) : entries;
  const list = base.filter((g) => {
    if (filters.includes('SCHOOL') && viewer.school && g.school.toLowerCase() !== viewer.school.toLowerCase()) return false;
    if (filters.includes('DEPARTMENT') && g.department !== VIEWER_SAMPLE.department) return false;
    if (filters.includes('LEVEL') && g.level !== VIEWER_SAMPLE.level) return false;
    return !q.trim() || publicName(g).toLowerCase().includes(q.trim().toLowerCase());
  });
  const visible = list.slice(0, pages * GUEST_PAGE);

  // Load the next page of 30 as the end of the list scrolls into view.
  useEffect(() => {
    const el = end.current; if (!el || visible.length >= list.length) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setPages((p) => p + 1); }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible.length, list.length]);
  useEffect(() => setPages(1), [tab, filters, q]);

  return (
    <Sheet open={open} onClose={() => { setPerson(null); onClose(); }} title="Guest list" width={460}>
      <div className="flex flex-col gap-3 px-5 pb-6">
        <div role="tablist" className="flex gap-1 rounded-2xl bg-mist p-1">
          {tabs.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)} className={`relative flex-1 rounded-xl py-2 text-[14px] font-bold ${tab === t.value ? 'text-ink' : 'text-muted'}`}>
              {tab === t.value ? <m.span layoutId="guest-tab" className="absolute inset-0 rounded-xl bg-surface shadow-card" transition={spring.snap} /> : null}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        <label className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-green-text">
          <Search size={17} className="text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search guests" className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted" />
        </label>
        {tab !== 'HOSTS' ? (
          <div className="no-bar -mx-5 flex gap-2 overflow-x-auto px-5">
            {viewer.school ? <Chip on={filters.includes('SCHOOL')} onClick={() => flip('SCHOOL')}>My school</Chip> : null}
            <Chip on={filters.includes('DEPARTMENT')} onClick={() => flip('DEPARTMENT')}>My department</Chip>
            <Chip on={filters.includes('LEVEL')} onClick={() => flip('LEVEL')}>My level</Chip>
          </div>
        ) : null}
        <p className="text-[12.5px] text-muted">People who chose to hide are counted but not listed. Names here are sample placeholders until guest lists are connected.</p>

        <LayoutGroup>
          <ul className="flex flex-col">
            <AnimatePresence initial={false}>
              {visible.map((g) => (
                <m.li key={g.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring.soft}>
                  <button type="button" onClick={() => setPerson(person?.id === g.id ? null : g)} aria-expanded={person?.id === g.id}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-mist">
                    <Avatar name={shownName(g)} src={g.avatar} size={44} checked={phase === 'LIVE' && g.checkedIn} stamped={phase === 'AFTER' && !g.isHost} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[15px]">{publicName(g)}{g.isHost ? <span className="ml-1.5 rounded-full bg-tint px-2 py-0.5 text-[11px] font-bold text-green-text">Host</span> : null}</b>
                      <small className="block truncate text-[13px] text-muted">{g.visibility === 'DEPARTMENT_ONLY' ? g.level : `${g.department} · ${g.level}`} · {g.school}</small>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2 py-1 text-[12px] font-bold tabular-nums" title={`${g.stampCount} stamps`}><MiniStamp size={14} />{g.stampCount}</span>
                  </button>
                  <AnimatePresence>{person?.id === g.id ? <MiniProfile g={g} /> : null}</AnimatePresence>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        </LayoutGroup>
        {!list.length ? <p className="py-8 text-center text-[15px] text-muted">Nobody matches.</p> : null}
        <div ref={end} />
      </div>
    </Sheet>
  );
}

/** Tap a person: who they are, how active they are, and what you have in common. */
function MiniProfile({ g }: { g: GuestListEntry }) {
  const anon = g.visibility === 'DEPARTMENT_ONLY';
  return (
    <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring.soft} className="overflow-hidden">
      <div className="mx-2 mb-2 flex items-center gap-4 rounded-2xl border border-line bg-raised p-4 shadow-card">
        <Avatar name={shownName(g)} src={g.avatar} size={64} />
        <div className="min-w-0 flex-1 text-[13.5px]">
          <b className="block truncate text-[16px]">{publicName(g)}</b>
          <span className="block text-muted">{g.school}</span>
          <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1 font-bold"><MiniStamp size={14} />{g.stampCount} stamps</span>
            {!anon ? <span><b>{g.eventsInCommon}</b> events in common</span> : null}
          </span>
          {!anon && g.topCommunities.length ? <span className="mt-1 block truncate text-muted">Active in {g.topCommunities.join(', ')}</span> : null}
        </div>
      </div>
    </m.div>
  );
}
