'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { AnimatePresence, useScroll, useTransform } from 'motion/react';
import { Check, Clock, ExternalLink, MessageCircle, Search, Settings2, Share2, Star, AtSign } from 'lucide-react';
import type { Event, Stamp as StampT } from '@/lib/api/types';
import { ACCENTS, canManage, getCommunity, join, leave, memberPreview, people, ratings, ROLE_LABEL, type CommunityPage, type Person } from '@/lib/api/communities';
import { listEvents } from '@/lib/api/events';
import { stampsOf } from '@/lib/api/session';
import { dateTile, phaseOf } from '@/lib/events';
import { renderMarkdown } from '@/lib/markdown';
import { page, rise, spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { CommunityLogo, VerifiedTick } from '@/components/communities/bits';
import { HideHostProvider, EventCompactCard, EventTicket } from '@/components/events/views';
import { Avatar } from '@/components/ui/avatar';
import { ContactButton } from '@/components/inbox/contact';
import { ChatIcon, chatLabel } from '@/components/brand/chat-icon';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { Btn, CountUp, SkeletonCard } from '@/components/ui/bits';
import { Stamp } from '@/components/brand/stamp';
import { Crest } from '@/components/brand/crest';
import { useToast } from '@/components/ui/toast';

type Tab = 'upcoming' | 'past' | 'about' | 'members';
const TABS: { value: Tab; label: string }[] = [{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'about', label: 'About' }, { value: 'members', label: 'Members' }];

export function CommunityView({ slug }: { slug: string }) {
  const { user } = useSession();
  const toast = useToast();
  const [ctx, setCtx] = useState<CommunityPage | null>(null);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<Event[] | null>(null);
  const [faces, setFaces] = useState<{ id: string; name: string; avatar: string }[]>([]);
  const [stamps, setStamps] = useState<StampT[]>([]);
  const [rating, setRating] = useState<{ averageRating: number; totalRatings: number } | null>(null);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [busy, setBusy] = useState(false);
  const [dropped, setDropped] = useState(0);

  const load = useCallback(() => getCommunity(slug).then(setCtx).catch((e: Error) => setError(e.message)), [slug]);
  useEffect(() => { void load(); }, [load, user?.id]);
  const cid = ctx?.community.id;
  useEffect(() => {
    if (!cid) return;
    listEvents(cid).then(setEvents).catch(() => setEvents([]));
    memberPreview(cid).then(setFaces).catch(() => undefined);
  }, [cid]);
  useEffect(() => { if (user?.username) stampsOf(user.username).then(setStamps).catch(() => undefined); }, [user?.username]);
  useEffect(() => { if (cid && canManage(ctx?.viewerRole)) ratings(cid).then(setRating); }, [cid, ctx?.viewerRole]);
  // Tapped Join while signed out: after signing in you come back here with ?join=1, and the join finishes itself.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (autoJoined.current || !user || !ctx || !cid) return;
    if (new URLSearchParams(window.location.search).get('join') !== '1') return;
    autoJoined.current = true;
    window.history.replaceState(null, '', `/communities/${slug}`);
    if (ctx.viewerRole || ctx.viewerRequest === 'PENDING') return;
    const approval = ctx.community.visibility === 'PRIVATE' || !ctx.community.autoApprove;
    setBusy(true);
    join(cid)
      .then(() => load())
      .then(() => { if (!approval) { setDropped((d) => d + 1); if (navigator.vibrate) navigator.vibrate(14); } toast(approval ? 'Request sent. A leader will review it.' : `You joined ${ctx.community.name}`); })
      .catch((e: Error) => toast(e.message))
      .finally(() => setBusy(false));
  }, [user, ctx, cid, slug, load, toast]);

  const all = events ?? [];
  const upcoming = useMemo(() => all.filter((e) => ['BEFORE', 'LIVE'].includes(phaseOf(e))).sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')), [all]);
  const past = useMemo(() => all.filter((e) => phaseOf(e) === 'AFTER').sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '')), [all]);
  const checkIns = all.reduce((s, e) => s + Math.max(e.attendedCount, e.checkedInCount), 0);
  const attendedIds = new Set(stamps.filter((s) => s.role === 'ATTENDED').map((s) => s.eventId));
  const mine = stamps.filter((s) => s.role === 'ATTENDED' && s.communitySlug === slug);

  if (error) return <div className="px-6 py-24 text-center text-[17px] font-semibold">{error}</div>;
  if (!ctx) return <div className="mx-auto max-w-[1100px] px-4 pt-6 sm:px-6 lg:px-8"><div className="shimmer h-56 rounded-[28px]" /><div className="mt-6"><SkeletonCard /></div></div>;
  const c = ctx.community;
  const member = Boolean(ctx.viewerRole);
  const approval = c.visibility === 'PRIVATE' || !c.autoApprove;

  async function onJoin() {
    if (!cid) return;
    setBusy(true);
    try {
      await join(cid);
      await load();
      if (!approval) { setDropped((d) => d + 1); if (navigator.vibrate) navigator.vibrate(14); }
      toast(approval ? 'Request sent. A leader will review it.' : `You joined ${c.name}`);
    } catch (e) { toast(e instanceof Error ? e.message : 'Unable to join'); }
    finally { setBusy(false); }
  }
  async function onLeave() {
    if (!cid || !window.confirm(`Leave ${c.name}? You'll stop getting its updates.`)) return;
    setBusy(true);
    try { await leave(cid); await load(); toast('You left the community'); } catch (e) { toast(e instanceof Error ? e.message : 'Unable to leave'); } finally { setBusy(false); }
  }
  const share = async () => { const url = window.location.href; try { if (navigator.share) await navigator.share({ url, title: c.name }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { /* dismissed */ } };
  const stack = member && user ? [{ id: 'me', name: user.fullName, avatar: user.avatar }, ...faces.filter((f) => f.id !== user.id)] : faces;

  return (
    <m.div variants={page} initial="hidden" animate="show" className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 pt-4 pb-16 sm:px-6 lg:px-8 lg:pt-6">
      <Cover c={c} />
      <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-4">
          <span className="relative z-10 -mt-14 shrink-0 self-start rounded-full p-1.5 shadow-lift sm:-mt-16" style={{ background: ACCENTS[c.accent] }}><span className="block rounded-full bg-paper p-1"><CommunityLogo c={c} size={92} /></span></span>
          <div className="min-w-0 pb-1">
            <h1 className="flex items-center gap-2 text-[28px] leading-tight font-extrabold sm:text-[36px]"><span className="truncate">{c.name}</span>{c.verified ? <VerifiedTick size={24} /> : null}</h1>
            <p className="text-[14.5px] text-muted">{[c.school, c.category].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="relative flex shrink-0 gap-2 pb-1">
          <AnimatePresence>{dropped ? <m.span key={dropped} className="pointer-events-none absolute -top-16 left-2 z-20" initial={{ y: -60, scale: 1.8, rotate: -30, opacity: 0 }} animate={{ y: 0, scale: [1.8, 0.9, 1], rotate: -10, opacity: [0, 1, 1, 0] }} transition={{ duration: 1.4, times: [0, 0.35, 0.5, 1] }}><Crest name={c.name} logo={c.logo} size={64} tilt={0} /></m.span> : null}</AnimatePresence>
          {canManage(ctx.viewerRole) ? <Btn kind="secondary" href={`/communities/${slug}/manage`}><Settings2 size={17} />Manage</Btn> : null}
          {!user ? <Btn href={`/login?next=${encodeURIComponent(`/communities/${slug}?join=1`)}`}>Join</Btn>
            : member ? <JoinedButton onLeave={onLeave} busy={busy} owner={ctx.viewerRole === 'FOUNDER'} />
            : ctx.viewerRequest === 'PENDING' ? <Btn kind="secondary" disabled><Clock size={17} />Requested</Btn>
            : <Btn onClick={() => void onJoin()} disabled={busy}>{busy ? 'Joining…' : approval ? 'Request to join' : 'Join'}</Btn>}
          <Btn kind="secondary" onClick={() => void share()} aria-label="Share"><Share2 size={17} /></Btn>
        </div>
      </div>

      {c.summary ? <m.p variants={rise} className="max-w-3xl text-[17px]">{c.summary}</m.p> : null}
      {c.chatLinks.length || c.socials.instagram || c.socials.x ? (
        <m.div variants={rise} className="flex flex-wrap gap-2">
          {c.chatLinks.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[14px] font-semibold hover:bg-mist"><ChatIcon platform={l.platform} url={l.url} size={18} />{l.label || chatLabel(l.platform, l.url)}<ExternalLink size={13} className="text-muted" /></a>)}
          {([['instagram', 'Instagram'], ['x', 'X']] as const).map(([k, label]) => c.socials[k] ? <a key={k} href={c.socials[k]} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[14px] font-semibold hover:bg-mist"><AtSign size={16} style={{ color: ACCENTS[c.accent] }} />{label}<ExternalLink size={13} className="text-muted" /></a> : null)}
        </m.div>
      ) : null}

      {(() => {
        const membersCard = (
          <div className="col-span-2 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 sm:col-span-1">
            <div className="flex items-start justify-between gap-2"><span><dd className="font-display text-[30px] font-extrabold"><CountUp to={c.memberCount} /></dd><dt className="text-[13px] text-muted">{c.memberCount === 1 ? 'Member' : 'Members'}</dt></span>
              <button type="button" onClick={() => setTab('members')} className="text-[13.5px] font-semibold text-green-text hover:underline">See all</button></div>
            {stack.length ? <AvatarStack people={stack} total={c.memberCount} max={6} size={30} label={`${c.memberCount} members`} blurred={!user} /> : null}
          </div>
        );
        // A brand-new community: an invitation instead of small numbers.
        if (c.memberCount < 10 && c.eventCount < 3) {
          return (
            <m.div variants={rise} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_260px]">
              <div className="flex flex-col justify-center gap-1.5 rounded-2xl border border-dashed border-line bg-[linear-gradient(120deg,var(--tint),var(--surface))] p-5">
                <span className="w-fit rounded-full bg-green px-2.5 py-0.5 text-[12px] font-bold text-white">New community</span>
                <b className="text-[17px]">Be one of the first members</b>
                <span className="text-[14px] text-muted">Join now and you&apos;ll hear about its first events before anyone else.</span>
              </div>
              <dl className="grid">{membersCard}</dl>
            </m.div>
          );
        }
        const showRating = Boolean(rating?.totalRatings) || canManage(ctx.viewerRole);
        return (
          <m.dl variants={rise} className={`grid grid-cols-2 gap-3 ${showRating ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            {membersCard}
            {[['Events hosted', c.eventCount], ['Total check-ins', checkIns]].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl border border-line bg-surface p-4"><dd className="font-display text-[30px] font-extrabold"><CountUp to={v as number} /></dd><dt className="text-[13px] text-muted">{k}</dt></div>
            ))}
            {showRating ? (
              <div className="rounded-2xl border border-line bg-surface p-4">
                {rating?.totalRatings ? <><dd className="flex items-center gap-1.5 font-display text-[30px] font-extrabold"><Star size={22} className="fill-gold text-gold" />{rating.averageRating.toFixed(1)}</dd><dt className="text-[13px] text-muted">Average rating · {rating.totalRatings}</dt></>
                  : <><dd className="pt-2 text-[16px] font-bold">No ratings yet</dd><dt className="text-[13px] text-muted">Attendees rate events after they end</dt></>}
              </div>
            ) : null}
          </m.dl>
        );
      })()}

      {user && mine.length ? <StampsRow stamps={mine} name={c.name} /> : null}

      <nav aria-label="Community" className="no-bar flex gap-7 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t.value} type="button" onClick={() => setTab(t.value)} aria-pressed={tab === t.value} className={`relative whitespace-nowrap pb-3 text-[15px] font-semibold ${tab === t.value ? 'text-ink' : 'text-muted hover:text-ink'}`}>
            {t.label}{t.value === 'upcoming' && upcoming.length ? <span className="ml-1 text-muted tabular-nums">{upcoming.length}</span> : null}
            {tab === t.value ? <m.span layoutId="community-tab" className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-ink" transition={spring.snap} /> : null}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <m.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring.soft}>
          <HideHostProvider>
          {tab === 'upcoming' ? (events === null ? <SkeletonCard /> : upcoming.length ? <Timeline events={upcoming} attended={attendedIds} /> : <Empty member={member} onJoin={user && !member ? () => void onJoin() : undefined} />)
            : tab === 'past' ? (past.length ? <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">{past.map((e) => <EventCompactCard key={e.id} event={e} attended={attendedIds.has(e.id)} />)}</div> : <p className="py-10 text-center text-muted">No past events yet.</p>)
            : tab === 'about' ? <About ctx={ctx} />
            : <Members id={c.id} signedIn={Boolean(user)} canSee={c.visibility === 'PUBLIC' || member} />}
          </HideHostProvider>
        </m.div>
      </AnimatePresence>
    </m.div>
  );
}

function Cover({ c }: { c: CommunityPage['community'] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 24]);
  return (
    <div ref={ref} className="relative h-36 overflow-hidden rounded-[28px] shadow-card sm:h-[180px]" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${ACCENTS[c.accent]} 30%, var(--surface)), var(--mist))` }}>
      {c.cover ? <m.div style={{ y }} className="absolute inset-x-0 -top-6 bottom-0"><Image src={c.cover} alt="" fill sizes="(min-width: 1100px) 1060px, 100vw" className="object-cover" priority /></m.div> : <span className="absolute -right-6 -bottom-10 opacity-40"><Crest name={c.name} size={220} tilt={-12} /></span>}
    </div>
  );
}

/** Joined ✓, morphing in from the Join button; tap for the option to leave. */
function JoinedButton({ onLeave, busy, owner }: { onLeave: () => void; busy: boolean; owner: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <m.button type="button" layout initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy} onClick={() => !owner && setOpen(!open)}
        className="inline-flex h-11 items-center gap-2 rounded-2xl bg-tint px-5 text-[15px] font-bold text-green-text">
        <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring.bouncy, delay: 0.15 }}><Check size={18} strokeWidth={3} /></m.span>Joined
      </m.button>
      {open ? <button type="button" disabled={busy} onClick={() => { setOpen(false); onLeave(); }} className="absolute top-[calc(100%+6px)] right-0 z-20 rounded-xl border border-line bg-raised px-4 py-2 text-[14px] font-semibold whitespace-nowrap shadow-lift hover:bg-mist">Leave community</button> : null}
    </span>
  );
}

/** "You have 4 stamps from AI Society" with the stamps; five unlocks the Regular badge. */
function StampsRow({ stamps, name }: { stamps: StampT[]; name: string }) {
  const n = stamps.length;
  const regular = n >= 5;
  return (
    <m.section variants={rise} className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-[16px]">You have {n} stamp{n === 1 ? '' : 's'} from {name}</b>
        {regular ? (
          <m.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={spring.bouncy} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-[13px] font-extrabold text-[#111714]">★ Regular</m.span>
        ) : <span className="text-[13px] text-muted">{5 - n} more to become a Regular</span>}
      </div>
      {!regular ? <div className="h-2 overflow-hidden rounded-full bg-mist"><m.div className="h-full origin-left rounded-full bg-gold" initial={{ scaleX: 0 }} animate={{ scaleX: n / 5 }} transition={spring.soft} /></div> : null}
      <div className="no-bar flex gap-3 overflow-x-auto pb-1">
        {stamps.slice(0, 12).map((s, i) => (
          <Link key={s.eventId} href={`/events/${s.eventSlug}`} className="shrink-0" title={s.eventTitle}>
            <m.span className="block" initial={{ scale: 1.5, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: [-14, -6, 10, -10, 4][i % 5] }} transition={{ ...spring.bouncy, delay: i * 0.06 }}>
              <Stamp label={s.eventTitle} date={dateTile(s.date)} size={74} tilt={0} />
            </m.span>
          </Link>
        ))}
      </div>
    </m.section>
  );
}

/** Upcoming events grouped by date on a timeline whose line draws itself as you scroll. */
function Timeline({ events, attended }: { events: Event[]; attended: Set<string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.6'] });
  return (
    <div ref={ref} className="relative pl-7">
      <span aria-hidden="true" className="absolute top-2 bottom-2 left-[9px] w-0.5 rounded-full bg-line" />
      <m.span aria-hidden="true" style={{ scaleY: scrollYProgress }} className="absolute top-2 bottom-2 left-[9px] w-0.5 origin-top rounded-full bg-green-text" />
      <div className="flex flex-col gap-4">
        {events.map((e) => (
          <div key={e.id} className="relative">
            <m.span aria-hidden="true" initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={spring.bouncy}
              className={`absolute top-1/2 -left-[25px] size-3.5 -translate-y-1/2 rounded-full border-2 border-paper ${phaseOf(e) === 'LIVE' ? 'live-ring bg-coral' : 'bg-green-text'}`} />
            <EventTicket event={e} attended={attended.has(e.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ member, onJoin }: { member: boolean; onJoin?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <m.span animate={{ rotate: [-10, -4, -10], y: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}><Stamp state="empty" size={110} tilt={0} /></m.span>
      <p className="max-w-xs text-[16px] text-muted">No events yet. Check back soon!</p>
      {member ? <span className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-[13.5px] font-semibold text-green-text"><Check size={15} />You&apos;ll be notified when they post one</span>
        : onJoin ? <Btn kind="secondary" onClick={onJoin}>Notify me (join)</Btn> : null}
    </div>
  );
}

function About({ ctx }: { ctx: CommunityPage }) {
  const c = ctx.community;
  const [leaders, setLeaders] = useState<Person[]>([]);
  useEffect(() => { people(c.id).then((r) => setLeaders(r.people.filter((p) => p.role === 'OWNER' || p.role === 'ADMIN').slice(0, 8))).catch(() => undefined); }, [c.id]);
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="prose-ev">{c.description ? renderMarkdown(c.description) : <p>{c.summary}</p>}</div>
      <aside className="flex flex-col gap-4">
        <dl className="grid grid-cols-[90px_1fr] gap-y-2 rounded-2xl border border-line bg-surface p-4 text-[14px]">
          <dt className="text-muted">School</dt><dd>{c.school || '—'}</dd>
          <dt className="text-muted">Category</dt><dd>{c.category || '—'}</dd>
          {c.createdAt ? <><dt className="text-muted">Since</dt><dd>{new Date(c.createdAt).getFullYear()}</dd></> : null}
          <dt className="text-muted">Joining</dt><dd>{c.visibility === 'PRIVATE' || !c.autoApprove ? 'By approval' : 'Open to everyone'}</dd>
        </dl>
        {leaders.length ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
            <b className="text-[15px]">Leaders</b>
            {leaders.map((p) => <span key={p.id} className="flex items-center gap-2.5"><Avatar name={p.name} src={p.avatar} size={34} /><span className="min-w-0"><b className="block truncate text-[14px]">{p.name}</b><small className="text-[12px] text-muted">{ROLE_LABEL[p.role]}</small></span></span>)}
          </div>
        ) : null}
        {!canManage(ctx.viewerRole) ? <ContactButton communityId={c.id} communityName={c.name} label="Message the community" /> : <Btn kind="secondary" href={`/inbox/team/${c.slug}`}><MessageCircle size={17} />Community inbox</Btn>}
        {c.chatLinks[0] ? <Btn kind="secondary" href={c.chatLinks[0].url}><ChatIcon platform={c.chatLinks[0].platform} url={c.chatLinks[0].url} size={18} />Join the {chatLabel(c.chatLinks[0].platform, c.chatLinks[0].url)}</Btn> : null}
      </aside>
    </div>
  );
}

/** The public member list: search, 30 at a time, role labels. Signed out: the count only. */
function Members({ id, signedIn, canSee }: { id: string; signedIn: boolean; canSee: boolean }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Person[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!signedIn || !canSee) return;
    const t = setTimeout(() => people(id, { q }).then((r) => { setList(r.people); setCursor(r.nextCursor); setTotal(r.total); }).catch(() => setList([])), 250);
    return () => clearTimeout(t);
  }, [id, q, signedIn, canSee]);
  if (!signedIn) return <p className="rounded-2xl bg-mist px-4 py-6 text-center text-[15px]">Sign in to see who&apos;s a member. <Link href={`/login?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/communities')}`} className="font-semibold text-green-text hover:underline">Sign in</Link></p>;
  if (!canSee) return <p className="rounded-2xl bg-mist px-4 py-6 text-center text-[15px]">Only members can see who&apos;s in this community.</p>;
  return (
    <div className="flex flex-col gap-3">
      <label className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-green-text sm:max-w-sm">
        <Search size={17} className="text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" aria-label="Search members" className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted" />
      </label>
      {list === null ? <SkeletonCard /> : (
        <>
          <ul className="grid gap-1 sm:grid-cols-2">
            {list.map((p, i) => (
              <m.li key={p.membershipId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.soft, delay: Math.min(i, 10) * 0.03 }}
                className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-mist">
                <Avatar name={p.name} src={p.avatar} size={42} />
                <span className="min-w-0 flex-1"><b className="block truncate text-[15px]">{p.name}</b><small className="block truncate text-[12.5px] text-muted">{p.school || (p.username ? `@${p.username}` : '')}</small></span>
                {p.role !== 'MEMBER' ? <span className="rounded-full bg-tint px-2 py-0.5 text-[11.5px] font-bold text-green-text">{ROLE_LABEL[p.role]}</span> : null}
              </m.li>
            ))}
          </ul>
          {!list.length ? <p className="py-6 text-center text-muted">Nobody matches.</p> : null}
          {cursor ? <Btn kind="secondary" className="self-center" onClick={() => people(id, { q, cursor }).then((r) => { setList((x) => [...(x ?? []), ...r.people]); setCursor(r.nextCursor); })}>Load more ({total - list.length} more)</Btn> : null}
        </>
      )}
    </div>
  );
}
