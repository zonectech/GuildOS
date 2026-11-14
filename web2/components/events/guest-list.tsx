'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup } from 'motion/react';
import * as m from 'motion/react-m';
import { ChevronRight, Info, Search, Users } from 'lucide-react';
import type { Event, EventPhase, GuestListEntry, User } from '@/lib/api/types';
import { emptyGuestList, fetchGuestList, GUEST_PAGE, type LoadedGuestList } from '@/lib/api/guests';
import { phaseOf } from '@/lib/events';
import { countWord } from '@/lib/attendance';
import { spring } from '@/lib/motion';
import { Avatar } from '@/components/ui/avatar';
import { AvatarStack, type StackPerson } from '@/components/ui/avatar-stack';
import { Btn, Chip, Odometer } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';

const shownName = (g: GuestListEntry) => g.name;
const guestDetails = (g: GuestListEntry) =>
  [g.department, g.level, g.school].filter(Boolean).join(' · ');
const toStack = (g: GuestListEntry, phase: EventPhase): StackPerson => ({ id: g.id, name: shownName(g), avatar: g.avatar, checked: phase === 'LIVE' && g.checkedIn, stamped: g.attended });
const peopleWord = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;

/**
 * "Going · 128" with a big avatar stack, right below the event's key details.
 * `me` is the signed-in student once they register: their face flies into the front of the stack.
 * Signed-out visitors get the count and blank placeholder faces only: the list is never fetched for them.
 */
export function GuestSection({ event, viewer, me }: { event: Event; viewer: User | null; me: boolean }) {
  const phase = phaseOf(event);
  const [list, setList] = useState<LoadedGuestList>(() => emptyGuestList(event));
  useEffect(() => {
    if (!viewer) { setList(emptyGuestList(event)); return; }
    fetchGuestList(event, viewer).then(setList).catch(() => undefined);
    // Only reload when something it shows can have changed: who is looking, their place, the head count.
    // (The event object itself is replaced on every 15-second check, even when nothing changed.)
  }, [event.id, event.goingCount, event.checkedInCount, event.finalized, viewer?.id, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(false);
  const count = list.count;
  // Your face leads the row while you hold a place. Once attendance is finalized the row is the list of
  // people who attended, so you are in it only if the server says you are.
  const meFirst = me && !event.finalized;
  // Your own entry comes from the server too; when you're shown up front, don't show it twice.
  const people = list.entries.filter((g) => !(meFirst && viewer && g.id === viewer.id)).slice(0, 8).map((g) => toStack(g, phase));
  // Visitors: nameless dots, one per guest (up to 5), so nothing about who is going reaches the page.
  const placeholders: StackPerson[] = Array.from({ length: Math.min(count, 5) }, (_, i) => ({ id: `p${i}`, name: '·'.repeat(i + 1) }));
  const stack = !viewer ? placeholders : meFirst ? [{ id: 'me', name: viewer.fullName, avatar: viewer.avatar }, ...people].slice(0, 8) : people;
  // "Attended" only once the organizer has finalized; until then people are going, then registered.
  const verb = countWord(event);
  const word = verb === 'attended' ? 'Attended' : verb === 'registered' ? 'Registered' : 'Going';
  const waiting = verb === 'registered';
  const nobody = verb === 'attended' ? 'No attendance was recorded for this event.' : waiting ? 'Nobody registered for this event.' : 'Nobody yet. Be the first, and your face leads the list.';
  const names = viewer ? list.entries.filter((g) => g.visibility === 'VISIBLE').slice(0, 2).map((g) => g.name) : [];
  const label = count ? `${peopleWord(count)} ${verb}${names.length ? `, including ${names.join(' and ')}` : ''}` : verb === 'attended' ? 'No attendance recorded' : 'Nobody yet';

  // External listings have no guest list here: registration and attendance live on the other site.
  if (phase === 'CANCELLED' || event.external) return null;
  return (
    <section aria-labelledby="guests-h" className="rounded-[24px] border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 id="guests-h" className="flex items-baseline gap-2 text-[22px] font-extrabold">
          {word}<span className="text-muted">·</span><Odometer value={count} className="text-green-text" />
        </h2>
        {!list.listVisible ? <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-[11.5px] font-bold text-muted"><Info size={12} />Guest list hidden by the hosts</span> : null}
      </div>

      {viewer && count ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {list.highlights.department ? <Highlight>{list.highlights.department} from your department</Highlight> : null}
          {list.highlights.level ? <Highlight>{list.highlights.level} from your level</Highlight> : null}
          {list.highlights.attendedWithBefore ? <Highlight>{list.highlights.attendedWithBefore} you&apos;ve attended events with</Highlight> : null}
        </div>
      ) : null}

      {!viewer ? (
        count ? <div className="mt-4 p-1"><AvatarStack people={stack} total={count} max={5} size={44} label={label} blurred /></div>
          : <p className="mt-3 text-[15px] text-muted">{nobody}</p>
      ) : list.entries.length > 0 || (list.listVisible && meFirst) ? (
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
          className="group mt-4 flex w-full items-center justify-between gap-3 rounded-2xl p-1 text-left hover:bg-mist">
          <AvatarStack people={stack} total={Math.max(count, meFirst ? 1 : 0)} max={8} size={44} label={label} />
          {list.entries.length > 0 ? <span className="flex items-center gap-1 text-[14px] font-semibold text-green-text">See all<ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></span> : null}
        </button>
      ) : !list.listVisible ? null : count > 0 && list.entries.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted">The attendee total is available, but guest names aren&apos;t available yet.</p>
      ) : <p className="mt-3 text-[15px] text-muted">{nobody}</p>}

      {waiting && count ? <p className="mt-3 flex items-start gap-2 text-[13.5px] text-muted"><Info size={14} className="mt-0.5 shrink-0" />Attendance isn&apos;t final yet. The organizer still has to confirm who attended.</p> : null}

      {!viewer && count ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mist px-4 py-3">
          <span className="text-[14px] font-semibold">{verb === 'attended' ? 'Sign in to see who attended' : waiting ? 'Sign in to see who registered' : 'Sign in to see who’s going'}</span>
          <Btn size="sm" href={`/login?next=${encodeURIComponent(`/events/${event.slug}`)}`}>Sign in</Btn>
        </div>
      ) : null}

      {phase === 'LIVE' && count ? <CheckedInBar done={event.checkedInCount} total={count} /> : null}

      {viewer ? <GuestSheet open={open} onClose={() => setOpen(false)} phase={phase} listName={word} entries={list.entries} viewer={viewer} /> : null}
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

type Tab = 'GOING' | 'CHECKED_IN';
type Filter = 'SCHOOL' | 'DEPARTMENT' | 'LEVEL';

/** The full list: a bottom sheet on phones, a side panel on desktop. */
function GuestSheet({ open, onClose, phase, listName, entries, viewer }: { open: boolean; onClose: () => void; phase: EventPhase; listName: string; entries: GuestListEntry[]; viewer: User }) {
  const tabs: { value: Tab; label: string }[] = phase === 'AFTER' ? [{ value: 'GOING', label: listName }]
    : phase === 'LIVE' ? [{ value: 'GOING', label: 'Going' }, { value: 'CHECKED_IN', label: 'Checked in' }]
    : [{ value: 'GOING', label: 'Going' }];
  const [tab, setTab] = useState<Tab>('GOING');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [q, setQ] = useState('');
  const [pages, setPages] = useState(1);
  const end = useRef<HTMLDivElement>(null);

  const flip = (f: Filter) => setFilters((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));
  const base = tab === 'CHECKED_IN' ? entries.filter((g) => g.checkedIn) : entries;
  const list = base.filter((g) => {
    if (filters.includes('SCHOOL') && viewer.school && g.school.toLowerCase() !== viewer.school.toLowerCase()) return false;
    if (filters.includes('DEPARTMENT') && (g.department || '').toLowerCase() !== (viewer.department || '').toLowerCase()) return false;
    if (filters.includes('LEVEL') && (g.level || '') !== (viewer.level || '')) return false;
    return !q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase());
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
    <Sheet open={open} onClose={onClose} title="Guest list" width={460}>
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
        <div className="no-bar -mx-5 flex gap-2 overflow-x-auto px-5">
          {viewer.school ? <Chip on={filters.includes('SCHOOL')} onClick={() => flip('SCHOOL')}>My school</Chip> : null}
          <Chip on={filters.includes('DEPARTMENT')} onClick={() => flip('DEPARTMENT')}>My department</Chip>
          <Chip on={filters.includes('LEVEL')} onClick={() => flip('LEVEL')}>My level</Chip>
        </div>
        <p className="text-[12.5px] text-muted">{entries.some((g) => g.visibility === 'HIDDEN') ? 'As a host you see everyone. People marked hidden are not shown to other students.' : 'People who chose to hide are counted but not listed.'}</p>

        <LayoutGroup>
          <ul className="flex flex-col">
            <AnimatePresence initial={false}>
              {visible.map((g) => (
                <m.li key={g.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring.soft}
                  className="flex items-center gap-3 rounded-2xl px-2 py-2.5">
                  <Avatar name={shownName(g)} src={g.avatar} size={44} checked={phase === 'LIVE' && g.checkedIn} stamped={g.attended} />
                  <span className="min-w-0 flex-1">
                    <b className="flex items-center gap-1.5 text-[15px]"><span className="truncate">{g.name}</span>{g.visibility === 'HIDDEN' ? <span className="shrink-0 rounded-full bg-mist px-2 py-0.5 text-[11px] font-bold text-muted">Hidden from other students</span> : null}</b>
                    <small className="block truncate text-[13px] text-muted">{guestDetails(g)}</small>
                  </span>
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
