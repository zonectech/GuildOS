'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { ArrowRight, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { listCommunities, myMemberships, suggestedCommunities, type CommunityCard as Community } from '@/lib/api/communities';
import { listEvents } from '@/lib/api/events';
import { page, rise, spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { CATEGORIES, catKey, CommunityCard, CommunityLogo, eventsByCommunity, Leaderboard, VerifiedTick } from '@/components/communities/bits';
import { Chip } from '@/components/ui/bits';
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
    return !s || [c.name, c.summary, c.school, c.category].some((v) => v.toLowerCase().includes(s));
  });
  const catCount = (k: string) => base.filter((c) => catKey(c.category) === k).length;
  const score = (c: Community) => (live.has(c.id) ? 1e6 : 0) + (checkIns.get(c.id) ?? 0) * 1000 + (next.get(c.id) ? 500 : 0) + c.memberCount;
  const shown = base.filter((c) => !cats.length || cats.includes(catKey(c.category))).sort((a, b) =>
    sort === 'members' ? b.memberCount - a.memberCount : sort === 'new' ? b.createdAt.localeCompare(a.createdAt) : sort === 'az' ? a.name.localeCompare(b.name) : score(b) - score(a));
  const filtering = Boolean(s || cats.length || schoolPick || withEvents);
  const clear = () => { setQ(''); setCats([]); setSchoolPick(''); setWithEvents(false); };
  const select = 'h-10 rounded-full border border-line bg-surface pr-8 pl-3.5 text-[13.5px] font-semibold outline-none focus:border-green-text';
  const yours = list.filter((c) => mine.includes(c.id));
  const board = list.map((c) => ({ c, checkIns: checkIns.get(c.id) ?? 0 })).filter((r) => r.checkIns > 0).sort((a, b) => b.checkIns - a.checkIns).slice(0, 5);
  const flip = (k: string) => setCats((x) => (x.includes(k) ? x.filter((y) => y !== k) : [...x, k]));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-10">
      <header className="mesh flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <m.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} className="text-[44px] font-extrabold sm:text-[56px]">Communities</m.h1>
            <p className="mt-1 text-[16px] text-muted">The clubs and societies behind every event. Join the ones you care about.</p>
          </div>
          <label className="flex h-12 w-full items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 shadow-card focus-within:border-green-text sm:w-[340px]">
            <Search size={18} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clubs, schools, topics" aria-label="Search communities" className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted" />
          </label>
        </div>
        <div className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-3 shadow-card sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal size={17} className="mr-1 text-muted" aria-hidden />
            <select aria-label="School" value={schoolPick} onChange={(e) => setSchoolPick(e.target.value)} className={`${select} max-w-[min(100%,260px)] ${schoolPick ? 'border-green-text text-green-text' : ''}`}>
              <option value="">All schools</option>
              {school ? <option value={MINE}>My school</option> : null}
              {schools.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <Chip on={withEvents} onClick={() => setWithEvents((v) => !v)}>Has events coming up</Chip>
            <span className="ml-auto flex items-center gap-2">
              {filtering ? <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-muted hover:text-ink"><X size={14} />Clear</button> : null}
              <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={select}>
                {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </span>
          </div>
          <div role="group" aria-label="Categories" className="no-bar -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
            {CATEGORIES.map((c) => {
              const k = c.toLowerCase(); const n = catCount(k);
              // Counts only once the list has loaded: "Tech 0" while it hasn't would be untrue.
              return <Chip key={c} on={cats.includes(k)} onClick={() => flip(k)}>{c}{all !== null ? <span className={`ml-1 tabular-nums ${cats.includes(k) ? 'opacity-70' : 'text-muted'}`}>{n}</span> : null}</Chip>;
            })}
          </div>
        </div>
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
  );
}
