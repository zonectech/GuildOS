'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { ArrowRight, PanelRightClose, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { listCommunities, myMemberships, suggestedCommunities, type CommunityCard as Community } from '@/lib/api/communities';
import { listEvents } from '@/lib/api/events';
import { page, rise, spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { CATEGORIES, catKey, CommunityCard, CommunityLogo, eventsByCommunity, Leaderboard, VerifiedTick } from '@/components/communities/bits';
import { Btn, Chip } from '@/components/ui/bits';
import { CheckGroup, CheckRow, RadioGroup } from '@/components/events/discover-bits';
import { Sheet, useIsDesktop } from '@/components/ui/sheet';
import { ErrorState } from '@/components/ui/error-state';
import { Crest } from '@/components/brand/crest';

type Sort = 'active' | 'members' | 'new' | 'az';
const SORTS: [Sort, string][] = [['active', 'Most active'], ['members', 'Most members'], ['new', 'Newest'], ['az', 'A to Z']];
const MINE = '__mine__';

/** Communities: search, categories, your school, then your communities, suggestions, the leaderboard and everything. */
export function CommunitiesView() {
  const { user } = useSession();
  const [all, setAll] = useState<Community[] | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [mine, setMine] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<(Community & { reason: string })[]>([]);
  const [q, setQ] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [schoolPick, setSchoolPick] = useState('');
  const [sort, setSort] = useState<Sort>('active');
  const [withEvents, setWithEvents] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [panel, setPanel] = useState(true);
  const [sheet, setSheet] = useState(false);
  const wide = useIsDesktop();
  const showPanel = wide && panel;
  const [error, setError] = useState<unknown>(null);

  // A failed load shows the error and Try again, never an empty directory with zero counts.
  const load = useCallback(() => { setError(null); listCommunities().then(setAll).catch(setError); listEvents().then(setEvents).catch(() => undefined); }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!user) { setMine([]); setSuggested([]); return; }
    myMemberships(user.id).then((ms) => setMine(ms.map((x) => x.communityId))).catch(() => undefined);
    suggestedCommunities().then(setSuggested).catch(() => undefined);
  }, [user]);

  const { live, next, checkIns } = useMemo(() => eventsByCommunity(events), [events]);
  const list = useMemo(() => all ?? [], [all]);
  const norm = (s: string) => s.trim().toLowerCase().replace(/[,.]/g, '').replace(/\s+/g, ' ');
  const school = norm(user?.school ?? '');
  const schools = useMemo(() => [...new Map(list.filter((c) => c.school.trim()).map((c) => [norm(c.school), c.school.trim()])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [list]);
  const wantSchool = schoolPick === MINE ? school : schoolPick;
  const s = q.trim().toLowerCase();
  // Everything except the category chips, so each chip can show how many it would leave.
  const base = list.filter((c) => {
    if (wantSchool && norm(c.school) !== wantSchool) return false;
    if (withEvents && !next.get(c.id) && !live.has(c.id)) return false;
    if (verifiedOnly && !c.verified) return false;
    return !s || [c.name, c.summary, c.school, c.category].some((v) => v.toLowerCase().includes(s));
  });
  const catCount = (k: string) => base.filter((c) => catKey(c.category) === k).length;
  const score = (c: Community) => (live.has(c.id) ? 1e6 : 0) + (checkIns.get(c.id) ?? 0) * 1000 + (next.get(c.id) ? 500 : 0) + c.memberCount;
  const shown = base.filter((c) => !cats.length || cats.includes(catKey(c.category))).sort((a, b) =>
    sort === 'members' ? b.memberCount - a.memberCount : sort === 'new' ? b.createdAt.localeCompare(a.createdAt) : sort === 'az' ? a.name.localeCompare(b.name) : score(b) - score(a));
  const filtering = Boolean(s || cats.length || schoolPick || withEvents || verifiedOnly);
  const clear = () => { setQ(''); setCats([]); setSchoolPick(''); setWithEvents(false); setVerifiedOnly(false); };
  const select = 'h-10 rounded-full border border-line bg-surface pr-8 pl-3.5 text-[13.5px] font-semibold outline-none focus:border-green-text';
  const yours = list.filter((c) => mine.includes(c.id));
  const board = list.map((c) => ({ c, checkIns: checkIns.get(c.id) ?? 0 })).filter((r) => r.checkIns > 0).sort((a, b) => b.checkIns - a.checkIns).slice(0, 5);
  const filters = <div className="flex flex-col gap-4">
    <label className="flex flex-col gap-2"><span className="font-display text-[16px] font-bold">School</span>
      <select aria-label="School" value={schoolPick} onChange={(e) => setSchoolPick(e.target.value)} className={`${select} w-full min-w-0 max-w-full`}>
        <option value="">All schools</option>{school ? <option value={MINE}>My school</option> : null}
        {schools.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
    </label>
    <CheckGroup title="Category" all="All categories" options={CATEGORIES.map((c) => ({ value: c.toLowerCase(), label: `${c}${all !== null ? ` (${catCount(c.toLowerCase())})` : ''}` }))} value={cats} onChange={setCats} />
    <fieldset className="flex flex-col gap-0.5 border-t border-line pt-4"><legend className="float-left mb-2 w-full font-display text-[16px] font-bold">Community activity</legend>
      <CheckRow on={withEvents} onClick={() => setWithEvents((v) => !v)}>Has events coming up</CheckRow>
      <CheckRow on={verifiedOnly} onClick={() => setVerifiedOnly((v) => !v)}>Verified communities only</CheckRow>
    </fieldset>
    <RadioGroup title="Sort by" name="community-sort" options={SORTS.map(([value, label]) => ({ value, label }))} value={sort} onChange={(v) => setSort(v as Sort)} />
  </div>;

  return (
    <div className={`mx-auto grid max-w-[1400px] gap-8 px-4 pt-6 pb-16 sm:px-6 lg:gap-10 lg:px-10 lg:pt-10 ${showPanel ? 'grid-cols-[minmax(0,1fr)_300px]' : ''}`}>
      <div className="flex min-w-0 flex-col gap-8">
      <header className="mesh flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <m.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} className="text-[44px] font-extrabold sm:text-[56px]">Communities</m.h1>
            <p className="mt-1 text-[16px] text-muted">The clubs and societies behind every event. Join the ones you care about.</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto"><label className="flex h-12 w-full min-w-0 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 shadow-card focus-within:border-green-text sm:w-[320px]">
            <Search size={18} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clubs, schools, topics" aria-label="Search communities" className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted" />
          </label>
          <button type="button" onClick={() => setPanel((v) => !v)} aria-expanded={showPanel} aria-controls="community-filter-panel" className="relative hidden h-12 shrink-0 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-[15px] font-semibold shadow-card hover:bg-mist lg:inline-flex">
            {showPanel ? <PanelRightClose size={17} /> : <SlidersHorizontal size={17} />}{showPanel ? 'Hide filters' : 'Filters'}
            {filtering && !showPanel ? <span className="absolute -top-1 -right-1 size-3 rounded-full bg-green-text ring-2 ring-paper" aria-label="Filters on" /> : null}
          </button></div>
        </div>
        <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
          <button type="button" onClick={() => setSheet(true)} aria-expanded={sheet} className="relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[14px] font-semibold"><SlidersHorizontal size={15} />Filters{filtering ? <span className="size-2 rounded-full bg-green-text" aria-label="Filters on" /> : null}</button>
          {school ? <Chip on={schoolPick === MINE} onClick={() => setSchoolPick((v) => v === MINE ? '' : MINE)}>My school</Chip> : null}
          <Chip on={withEvents} onClick={() => setWithEvents((v) => !v)}>Has events coming up</Chip>
        </div>
        {filtering ? <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-muted"><span>{shown.length} matching communit{shown.length === 1 ? 'y' : 'ies'}</span><button type="button" onClick={clear} className="inline-flex items-center gap-1 font-semibold text-green-text hover:underline"><X size={14} />Clear filters</button></div> : null}
      </header>

      {error && all === null ? <ErrorState error={error} onRetry={load} title="Communities didn’t load." /> : error ? <ErrorState compact error={error} onRetry={load} /> : null}

      {!filtering && yours.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="yours-h">
          <h2 id="yours-h" className="text-[22px] font-extrabold">Your communities</h2>
          <div className="no-bar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {yours.map((c) => (
              <Link key={c.id} href={`/communities/${c.slug}`} className="flex w-[220px] shrink-0 items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card hover:bg-mist">
                <CommunityLogo c={c} size={44} />
                <span className="min-w-0"><b className="flex items-center gap-1 text-[14.5px]"><span className="truncate">{c.name}</span>{c.verified ? <VerifiedTick size={14} /> : null}</b><small className="block truncate text-[12.5px] text-muted">{next.get(c.id) ? 'Event coming up' : `${c.memberCount} members`}</small></span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!filtering && (suggested.length || board.length) ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {suggested.length ? (
            <section className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-5 shadow-card" aria-labelledby="sugg-h">
              <h2 id="sugg-h" className="flex items-center gap-2 text-[20px] font-extrabold"><Sparkles size={18} className="text-[var(--stamp-gold)]" />Suggested for you</h2>
              <div className="flex flex-col gap-1">
                {suggested.slice(0, 4).map((c) => (
                  <Link key={c.id} href={`/communities/${c.slug}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-mist">
                    <CommunityLogo c={c} size={40} />
                    <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px]">{c.name}</b><small className="block truncate text-[12.5px] text-muted">{c.reason || c.school}</small></span>
                    <ArrowRight size={16} className="shrink-0 text-muted" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {board.length ? (
            <section className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-5 shadow-card" aria-labelledby="board-h">
              <h2 id="board-h" className="text-[20px] font-extrabold">Most active this month</h2>
              <Leaderboard rows={board} />
            </section>
          ) : null}
        </div>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="all-h">
        <h2 id="all-h" className="text-[22px] font-extrabold">{filtering ? `${shown.length} result${shown.length === 1 ? '' : 's'}` : 'All communities'}</h2>
        {all === null ? (error ? null :
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="shimmer h-[270px] rounded-[22px]" />)}</div>
        ) : shown.length ? (
          <m.div variants={page} initial="hidden" animate="show" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">
            {shown.map((c) => <m.div key={c.id} variants={rise}><CommunityCard c={c} next={next.get(c.id)} live={live.has(c.id)} /></m.div>)}
          </m.div>
        ) : <p className="py-12 text-center text-[15.5px] text-muted">No communities match. <button type="button" onClick={clear} className="font-semibold text-green-text hover:underline">Clear filters</button></p>}
      </section>

      <Link href="/communities/request" className="group flex flex-wrap items-center gap-5 rounded-[24px] border border-line bg-[linear-gradient(120deg,var(--tint),var(--surface))] p-6 shadow-card">
        <m.span whileHover={{ rotate: 0 }} initial={{ rotate: -10 }} transition={spring.soft}><Crest name="Your community" size={84} tilt={0} /></m.span>
        <span className="min-w-0 flex-1"><b className="block font-display text-[22px]">Run a student community?</b><span className="text-[15px] text-muted">Request to create one. A reviewer checks it once, then you run events and every attendee gets your crest on their stamp.</span></span>
        <span className="inline-flex items-center gap-1.5 font-bold text-green-text">Request to create one<ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></span>
      </Link>
      </div>
      {showPanel ? <m.aside id="community-filter-panel" aria-label="Community filters" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={spring.soft}>
        <div className="sticky top-8 flex flex-col gap-3"><div className="rounded-[22px] border border-line bg-surface p-5 shadow-card">{filters}</div>{filtering ? <button type="button" onClick={clear} className="text-[14px] font-semibold text-green-text hover:underline">Clear all filters</button> : null}</div>
      </m.aside> : null}
      <Sheet open={sheet && !showPanel} onClose={() => setSheet(false)} title="Filters" width={380}>
        <div className="px-5 pb-4">{filters}</div>
        <div className="glass sticky bottom-0 flex gap-2 border-t border-line px-5 py-3">{filtering ? <Btn kind="secondary" onClick={clear}>Clear</Btn> : null}<Btn wide onClick={() => setSheet(false)}>Show {shown.length} communit{shown.length === 1 ? 'y' : 'ies'}</Btn></div>
      </Sheet>
    </div>
  );
}
