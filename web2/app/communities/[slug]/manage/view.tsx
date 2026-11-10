'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, Megaphone, MessageCircle, CircleCheck, Crown, Download, ImagePlus, ListTodo, Search, Star, UserMinus, X } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import {
  analytics, answerRequest, canChangeRoles, setTitle, TEAM_TITLES, canManage, getCommunity, members, ratings, removeMember, ROLE_LABEL, setRole, transferOwnership, updateCommunity,
  ACCENTS, type Accent, type CommunityPage, type CommunityRole, type MemberAnalytics, type Person,
} from '@/lib/api/communities';
import { hostedEvents } from '@/lib/api/events';
import { uploadImages } from '@/lib/api/review';
import { phaseOf } from '@/lib/events';
import { page, rise, spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { CommunityLogo, VerifiedTick } from '@/components/communities/bits';
import { EventTicket } from '@/components/events/views';
import { Avatar } from '@/components/ui/avatar';
import { Btn, Chip, CountUp, SkeletonCard } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';
import { SwipeRow } from '@/components/ui/swipe-row';
import { ChatIcon } from '@/components/brand/chat-icon';
import { useToast } from '@/components/ui/toast';
import { fmtDate } from '@/lib/format';
import { LogoCropper } from '@/components/ui/logo-cropper';

type Tab = 'overview' | 'members' | 'events' | 'settings';

/** Community management for Owners and Admins: a calm dashboard, not a heavy admin panel. */
export function ManageView({ slug }: { slug: string }) {
  const router = useRouter();
  const { user, loading } = useSession();
  const [ctx, setCtx] = useState<CommunityPage | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  // ?tab=members|events|settings opens that tab (links from the setup checklist).
  useEffect(() => { const t = new URLSearchParams(window.location.search).get('tab'); if (t === 'members' || t === 'events' || t === 'settings') setTab(t); }, []);
  const [error, setError] = useState('');
  const load = useCallback(() => getCommunity(slug).then(setCtx).catch((e: Error) => setError(e.message)), [slug]);

  useEffect(() => { if (!loading && !user) router.replace(`/login?next=/communities/${slug}/manage`); }, [loading, user, router, slug]);
  useEffect(() => { if (user) void load(); }, [user, load]);
  useEffect(() => { if (ctx && canManage(ctx.viewerRole)) hostedEvents().then((l) => setEvents(l.filter((e) => e.community.id === ctx.community.id))).catch(() => setEvents([])); }, [ctx]);

  if (!user) return null;
  if (error) return <div className="px-6 py-24 text-center font-semibold">{error}</div>;
  if (!ctx) return <div className="mx-auto max-w-[1100px] px-4 pt-10"><SkeletonCard /></div>;
  if (!canManage(ctx.viewerRole)) return <div className="mx-auto max-w-lg px-6 py-24 text-center"><h1 className="text-[30px] font-extrabold">Owners and admins only</h1><p className="mt-2 text-muted">You can see this community&apos;s page, but managing it is for its leaders.</p><Btn className="mt-6" href={`/communities/${slug}`}>Back to the community</Btn></div>;

  const c = ctx.community;
  const owner = ctx.viewerRole === 'FOUNDER';
  const pending = ctx.joinRequests.filter((r) => r.status === 'PENDING');
  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: 'overview', label: 'Overview' }, { value: 'members', label: 'Members', count: pending.length || undefined }, { value: 'events', label: 'Events' }, ...(owner ? [{ value: 'settings' as const, label: 'Settings' }] : []),
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10">
      <Link href={`/communities/${slug}`} className="inline-flex w-fit items-center gap-1.5 text-[14.5px] font-semibold text-muted hover:text-ink"><ArrowLeft size={17} />Community page</Link>
      <header className="flex flex-wrap items-center gap-4">
        <CommunityLogo c={c} size={64} />
        <div className="min-w-0"><p className="text-[13px] font-bold tracking-[.1em] text-green-text uppercase">Manage</p><h1 className="flex items-center gap-2 text-[32px] font-extrabold"><span className="truncate">{c.name}</span>{c.verified ? <VerifiedTick size={22} /> : null}</h1></div>
        <span className="ml-auto flex gap-2"><Btn kind="secondary" href={`/inbox/team/${slug}`}><MessageCircle size={16} />Inbox</Btn><Btn kind="secondary" href={`/inbox/team/${slug}?tab=announcements`}><Megaphone size={16} />Announce</Btn></span>
      </header>
      <nav aria-label="Manage" className="no-bar flex gap-7 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button key={t.value} type="button" onClick={() => setTab(t.value)} aria-pressed={tab === t.value} className={`relative whitespace-nowrap pb-3 text-[15px] font-semibold ${tab === t.value ? 'text-ink' : 'text-muted hover:text-ink'}`}>
            {t.label}{t.count ? <m.span key={t.count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={spring.bouncy} className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1.5 text-[11.5px] text-[#111714]">{t.count}</m.span> : null}
            {tab === t.value ? <m.span layoutId="manage-tab" className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-ink" transition={spring.snap} /> : null}
          </button>
        ))}
      </nav>
      <AnimatePresence mode="wait">
        <m.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring.soft}>
          {tab === 'overview' ? <Overview ctx={ctx} events={events} pending={pending.length} go={setTab} />
            : tab === 'members' ? <MembersTab ctx={ctx} reload={load} />
            : tab === 'events' ? <EventsTab events={events} slug={slug} />
            : <SettingsTab ctx={ctx} reload={load} />}
        </m.div>
      </AnimatePresence>
    </div>
  );
}

/* ── Overview ─────────────────────────────────────────────────────── */
function Overview({ ctx, events, pending, go }: { ctx: CommunityPage; events: Event[] | null; pending: number; go: (t: Tab) => void }) {
  const c = ctx.community;
  const [a, setA] = useState<MemberAnalytics | null>(null);
  const [r, setR] = useState<{ averageRating: number; totalRatings: number } | null>(null);
  useEffect(() => { analytics(c.id).then(setA).catch(() => undefined); ratings(c.id).then(setR); }, [c.id]);
  const list = events ?? [];
  const next = list.filter((e) => ['BEFORE', 'LIVE'].includes(phaseOf(e)) && e.status !== 'DRAFT').sort((x, y) => (x.startDate ?? '').localeCompare(y.startDate ?? ''))[0];
  const toFinalize = list.filter((e) => phaseOf(e) === 'AFTER' && e.status !== 'COMPLETED');
  const drafts = list.filter((e) => e.status === 'DRAFT');
  const past = list.filter((e) => phaseOf(e) === 'AFTER').sort((x, y) => (y.startDate ?? '').localeCompare(x.startDate ?? '')).slice(0, 6).reverse();
  const todo = [
    ...(pending ? [{ text: `${pending} join request${pending === 1 ? '' : 's'} waiting`, act: () => go('members') }] : []),
    ...toFinalize.map((e) => ({ text: `Finalize attendance for ${e.title}`, href: `/events/${e.slug}/manage` })),
    ...(drafts.length ? [{ text: `${drafts.length} draft event${drafts.length === 1 ? '' : 's'} not published`, act: () => go('events') }] : []),
    ...(!c.cover ? [{ text: 'Add a cover image', act: () => go('settings') }] : []),
  ];
  return (
    <m.div variants={page} initial="hidden" animate="show" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <m.section variants={rise} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Members', a?.totalMembers ?? c.memberCount], ['New this month', a?.newLast30Days ?? 0], ['Events hosted', c.eventCount]].map(([k, v]) => (
            <div key={k as string} className="rounded-2xl border border-line bg-surface p-4"><b className="font-display text-[28px]"><CountUp to={v as number} /></b><span className="block text-[13px] text-muted">{k}</span></div>
          ))}
          <div className="rounded-2xl border border-line bg-surface p-4"><b className="flex items-center gap-1 font-display text-[28px]">{r?.totalRatings ? <><Star size={20} className="fill-gold text-gold" />{r.averageRating.toFixed(1)}</> : '—'}</b><span className="block text-[13px] text-muted">Average rating{r?.totalRatings ? ` · ${r.totalRatings}` : ''}</span></div>
        </m.section>
        <m.section variants={rise} className="rounded-[22px] border border-line bg-surface p-5">
          <h2 className="mb-3 text-[18px] font-extrabold">New members by month</h2>
          {a ? <Bars data={a.joinsByMonth.map((j) => ({ label: new Date(`${j.month}-01T00:00`).toLocaleDateString('en-GB', { month: 'short' }), value: j.count }))} /> : <div className="shimmer h-36 rounded-xl" />}
        </m.section>
        <m.section variants={rise} className="rounded-[22px] border border-line bg-surface p-5">
          <h2 className="mb-3 text-[18px] font-extrabold">Check-ins per event</h2>
          {events === null ? <div className="shimmer h-36 rounded-xl" /> : past.length ? <Bars data={past.map((e) => ({ label: e.title.replace(/^\[(DEMO|TEST)\]\s*/i, '').slice(0, 14), value: Math.max(e.attendedCount, e.checkedInCount) }))} color="bg-gold" /> : <p className="text-[14px] text-muted">No past events yet.</p>}
        </m.section>
      </div>
      <div className="flex flex-col gap-5">
        <m.section variants={rise} className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[18px] font-extrabold"><ListTodo size={18} />To do</h2>
          {events === null ? <div className="shimmer h-16 rounded-xl" /> : todo.length ? (
            <ul className="flex flex-col gap-1">
              {todo.map((t) => (
                <li key={t.text}>
                  {'href' in t && t.href ? <a href={t.href} className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-[14.5px] font-semibold hover:bg-mist"><span className="size-2 shrink-0 rounded-full bg-coral" />{t.text}</a>
                    : <button type="button" onClick={'act' in t ? t.act : undefined} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-[14.5px] font-semibold hover:bg-mist"><span className="size-2 shrink-0 rounded-full bg-coral" />{t.text}</button>}
                </li>
              ))}
            </ul>
          ) : <p className="flex items-center gap-2 text-[14.5px] text-muted"><CircleCheck size={18} className="text-green-text" />All caught up.</p>}
        </m.section>
        <m.section variants={rise} className="flex flex-col gap-3">
          <h2 className="text-[18px] font-extrabold">Next event</h2>
          {events === null ? <div className="shimmer h-28 rounded-2xl" /> : next ? <EventTicket event={next} /> : <div className="rounded-2xl border border-dashed border-line p-5 text-center text-[14.5px] text-muted">Nothing scheduled. <Link href={`/events/new?community=${c.slug}`} className="font-semibold text-green-text hover:underline">Create an event</Link></div>}
        </m.section>
      </div>
    </m.div>
  );
}

/** A small bar chart: bars grow with a spring, one after another. */
function Bars({ data, color = 'bg-green-text' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-40 items-end gap-2" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(', ')}>
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[11.5px] font-bold text-muted tabular-nums">{d.value || ''}</span>
          <m.span className={`w-full max-w-10 origin-bottom rounded-t-lg ${color}`} style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ ...spring.soft, delay: i * 0.04 }} />
          <span className="w-full truncate text-center text-[11px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Members ──────────────────────────────────────────────────────── */
const ROLE_FILTER: { value: string; label: string; raw?: string }[] = [{ value: '', label: 'Everyone' }, { value: 'OWNER', label: 'Owner', raw: 'FOUNDER' }, { value: 'ADMIN', label: 'Admins' }, { value: 'HELPER', label: 'Helpers', raw: 'VOLUNTEER' }, { value: 'MEMBER', label: 'Members', raw: 'MEMBER' }];

function MembersTab({ ctx, reload }: { ctx: CommunityPage; reload: () => Promise<unknown> }) {
  const toast = useToast();
  const c = ctx.community;
  const mayEdit = canChangeRoles(ctx.viewerRole);
  // Only the Owner gives titles; members never set their own.
  const owner = ctx.viewerRole === 'FOUNDER';
  const [q, setQ] = useState('');
  const [role, setRoleFilter] = useState('');
  const [list, setList] = useState<Person[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [removing, setRemoving] = useState<Person | null>(null);
  const [busy, setBusy] = useState('');
  const pending = ctx.joinRequests.filter((r) => r.status === 'PENDING');
  const raw = ROLE_FILTER.find((r) => r.value === role)?.raw;

  const fetchPage = useCallback(() => members(c.id, { q, role: raw }).then((r) => { setList(role === 'ADMIN' ? r.people.filter((p) => p.role === 'ADMIN') : r.people); setCursor(r.nextCursor); setTotal(r.total); }).catch(() => setList([])), [c.id, q, raw, role]);
  useEffect(() => { const t = setTimeout(() => void fetchPage(), 250); return () => clearTimeout(t); }, [fetchPage]);

  async function answer(id: string, approve: boolean) {
    setBusy(id);
    try { await answerRequest(c.id, id, approve); toast(approve ? 'Approved' : 'Declined'); await reload(); await fetchPage(); } catch (e) { toast(e instanceof Error ? e.message : 'Unable to answer'); } finally { setBusy(''); }
  }
  async function changeTitle(p: Person, value: string) {
    let title = value;
    if (value === '__custom') { const typed = window.prompt(`Title for ${p.name}`, p.title); if (typed === null) return; title = typed.trim(); }
    setList((l) => l?.map((x) => (x.membershipId === p.membershipId ? { ...x, title } : x)) ?? l);
    try { await setTitle(c.id, p.membershipId, title); toast(title ? `${p.name} is now ${title}` : 'Title removed'); }
    catch (e) { setList((l) => l?.map((x) => (x.membershipId === p.membershipId ? { ...x, title: p.title } : x)) ?? l); toast(e instanceof Error ? e.message : 'Unable to set the title'); }
  }
  async function changeRole(p: Person, next: Exclude<CommunityRole, 'OWNER'>) {
    // Show the new role straight away; put the old one back if the server refuses.
    const swap = (role: CommunityRole) => setList((l) => l?.map((x) => (x.membershipId === p.membershipId ? { ...x, role } : x)) ?? l);
    swap(next);
    setBusy(p.membershipId);
    try { await setRole(c.id, p.membershipId, next); toast(`${p.name} is now ${next === 'ADMIN' ? 'an Admin' : `a ${ROLE_LABEL[next]}`}`); } catch (e) { swap(p.role); toast(e instanceof Error ? e.message : 'Unable to change the role'); } finally { setBusy(''); }
  }
  async function remove() {
    if (!removing) return;
    setBusy(removing.membershipId);
    try { await removeMember(removing.membershipId); toast(`${removing.name} was removed`); setRemoving(null); await reload(); await fetchPage(); } catch (e) { toast(e instanceof Error ? e.message : 'Unable to remove'); } finally { setBusy(''); }
  }
  /** Every member as a CSV (all pages), for the leaders' own records. */
  async function exportCsv() {
    const rows: Person[] = [];
    let next: string | null | undefined;
    do { const r = await members(c.id, { cursor: next ?? undefined }); rows.push(...r.people); next = r.nextCursor; } while (next);
    const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
    const csv = '﻿' + [['Name', 'Username', 'Role', 'School', 'Joined'], ...rows.map((p) => [p.name, p.username, ROLE_LABEL[p.role], p.school, p.joinedAt ? fmtDate(p.joinedAt, null, { weekday: false, year: true }) : ''])].map((r) => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: `${c.slug}-members.csv` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex flex-col gap-6">
      {pending.length ? (
        <section className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5" aria-labelledby="req-h">
          <h2 id="req-h" className="text-[18px] font-extrabold">Join requests <span className="text-muted tabular-nums">{pending.length}</span></h2>
          <p className="text-[12.5px] text-muted sm:hidden">Swipe right to approve, left to decline.</p>
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {pending.map((r) => (
                <m.li key={r.id} layout exit={{ opacity: 0, x: 60 }}>
                  <SwipeRow onApprove={() => void answer(r.id, true)} onDecline={() => void answer(r.id, false)}>
                    <div className="flex items-center gap-3 rounded-[20px] border border-line bg-raised p-3">
                      <Avatar name={r.user?.fullName ?? 'Student'} src={r.user?.avatar} size={40} />
                      <span className="min-w-0 flex-1"><b className="block truncate">{r.user?.fullName ?? 'Student'}</b><small className="text-[12.5px] text-muted">Asked {fmtDate(r.requestedAt, null, { weekday: false })}</small></span>
                      <button type="button" disabled={busy === r.id} onClick={() => void answer(r.id, true)} aria-label="Approve" className="grid size-10 place-items-center rounded-full bg-green text-white"><Check size={18} strokeWidth={3} /></button>
                      <button type="button" disabled={busy === r.id} onClick={() => void answer(r.id, false)} aria-label="Decline" className="grid size-10 place-items-center rounded-full bg-mist text-muted"><X size={18} /></button>
                    </div>
                  </SwipeRow>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-green-text sm:max-w-xs">
            <Search size={17} className="text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" aria-label="Search members" className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted" />
          </label>
          <Btn kind="secondary" onClick={() => void exportCsv()}><Download size={16} />Export CSV</Btn>
        </div>
        <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">{ROLE_FILTER.map((r) => <Chip key={r.value} on={role === r.value} onClick={() => setRoleFilter(r.value)}>{r.label}</Chip>)}</div>
        {list === null ? <SkeletonCard /> : (
          <ul className="flex flex-col divide-y divide-line rounded-[22px] border border-line bg-surface">
            {list.map((p) => (
              <m.li key={p.membershipId} layout className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar name={p.name} src={p.avatar} size={40} />
                <span className="min-w-0 flex-1"><b className="flex items-center gap-1.5 truncate">{p.name}{p.role === 'OWNER' ? <Crown size={14} className="text-[var(--stamp-gold)]" /> : null}</b><small className="block truncate text-[12.5px] text-muted">{p.username ? `@${p.username} · ` : ''}{p.joinedAt ? `joined ${new Date(p.joinedAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}` : ''}</small>
                  {p.role !== 'MEMBER' ? (owner ? (
                    <select aria-label={`Title for ${p.name}`} value={TEAM_TITLES.includes(p.title) || !p.title ? p.title : '__current'} onChange={(e) => void changeTitle(p, e.target.value)} className="mt-1 h-8 max-w-full rounded-lg border border-line bg-surface px-2 text-[12.5px] font-semibold outline-none focus:border-green-text">
                      <option value="">No title</option>
                      {TEAM_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                      {p.title && !TEAM_TITLES.includes(p.title) ? <option value="__current">{p.title}</option> : null}
                      <option value="__custom">Custom…</option>
                    </select>
                  ) : p.title ? <span className="mt-1 inline-block rounded-full bg-tint px-2 py-0.5 text-[11.5px] font-bold text-green-text">{p.title}</span> : null) : null}
                </span>
                {mayEdit && p.role !== 'OWNER' ? (
                  <span className="flex items-center gap-1.5">
                    <select aria-label={`Role for ${p.name}`} value={p.role} disabled={busy === p.membershipId} onChange={(e) => void changeRole(p, e.target.value as Exclude<CommunityRole, 'OWNER'>)}
                      className="h-9 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] font-semibold outline-none focus:border-green-text">
                      <option value="ADMIN">Admin</option><option value="HELPER">Helper</option><option value="MEMBER">Member</option>
                    </select>
                    <button type="button" onClick={() => setRemoving(p)} aria-label={`Remove ${p.name}`} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-mist hover:text-coral-text"><UserMinus size={17} /></button>
                  </span>
                ) : <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${p.role === 'MEMBER' ? 'bg-mist text-muted' : 'bg-tint text-green-text'}`}>{ROLE_LABEL[p.role]}</span>}
              </m.li>
            ))}
            {!list.length ? <li className="px-4 py-8 text-center text-muted">Nobody matches.</li> : null}
          </ul>
        )}
        {cursor && list ? <Btn kind="secondary" className="self-center" onClick={() => members(c.id, { q, role: raw, cursor }).then((r) => { setList((x) => [...(x ?? []), ...r.people]); setCursor(r.nextCursor); })}>Load more ({total - list.length} more)</Btn> : null}
        {!mayEdit ? <p className="text-[13px] text-muted">Changing roles and removing members is for the Owner and senior Admins.</p> : null}
      </section>

      <Sheet open={Boolean(removing)} onClose={() => setRemoving(null)} title="Remove member">
        <div className="flex flex-col gap-4 px-5 pb-6">
          <p className="text-[15px]">Remove <b>{removing?.name}</b> from {c.name}? Their stamps and certificates from your events stay on their profile.</p>
          <Btn wide size="lg" kind="secondary" onClick={() => void remove()} disabled={Boolean(busy)}>Remove member</Btn>
        </div>
      </Sheet>
    </div>
  );
}

/* ── Events ───────────────────────────────────────────────────────── */
function EventsTab({ events, slug }: { events: Event[] | null; slug: string }) {
  const [sub, setSub] = useState<'DRAFTS' | 'UPCOMING' | 'PAST'>('UPCOMING');
  const groups = useMemo(() => {
    const l = events ?? [];
    return {
      DRAFTS: l.filter((e) => e.status === 'DRAFT'),
      UPCOMING: l.filter((e) => e.status !== 'DRAFT' && ['BEFORE', 'LIVE'].includes(phaseOf(e))).sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')),
      PAST: l.filter((e) => e.status !== 'DRAFT' && ['AFTER', 'CANCELLED'].includes(phaseOf(e))).sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '')),
    };
  }, [events]);
  if (events === null) return <SkeletonCard />;
  const list = groups[sub];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">{(['DRAFTS', 'UPCOMING', 'PAST'] as const).map((k) => <Chip key={k} on={sub === k} onClick={() => setSub(k)}>{k === 'DRAFTS' ? 'Drafts' : k === 'UPCOMING' ? 'Upcoming' : 'Past'} {groups[k].length}</Chip>)}</div>
        <Btn href={`/events/new?community=${slug}`}>New event</Btn>
      </div>
      {list.length ? list.map((e) => (
        <div key={e.id} className="flex flex-col gap-1.5">
          <EventTicket event={e} />
          <div className="flex flex-wrap gap-2 pl-1 text-[13px]">
            <span className={`rounded-full px-2 py-0.5 font-bold ${e.status === 'DRAFT' ? 'bg-[color-mix(in_srgb,var(--gold)_30%,var(--surface))]' : phaseOf(e) === 'AFTER' && e.status !== 'COMPLETED' ? 'bg-[color-mix(in_srgb,var(--coral)_22%,var(--surface))]' : 'bg-mist text-muted'}`}>
              {e.status === 'DRAFT' ? 'Draft' : phaseOf(e) === 'LIVE' ? 'Live' : phaseOf(e) === 'CANCELLED' ? 'Cancelled' : phaseOf(e) === 'AFTER' ? (e.status === 'COMPLETED' ? 'Attendance finalized' : 'Attendance to finalize') : 'Published'}
            </span>
            <Link href={`/events/${e.slug}/edit`} className="font-semibold text-green-text hover:underline">Edit</Link>
            <Link href={`/events/${e.slug}/manage`} className="font-semibold text-green-text hover:underline">Open workspace</Link>
          </div>
        </div>
      )) : <p className="py-10 text-center text-muted">Nothing here.</p>}
    </div>
  );
}

/* ── Settings (Owner) ─────────────────────────────────────────────── */
function SettingsTab({ ctx, reload }: { ctx: CommunityPage; reload: () => Promise<unknown> }) {
  const toast = useToast();
  const c = ctx.community;
  const [name, setName] = useState(c.name);
  const [summary, setSummary] = useState(c.summary);
  const [description, setDescription] = useState(c.description);
  const [rules, setRules] = useState(c.rules.join('\n'));
  const [open, setOpen] = useState(c.visibility === 'PUBLIC' && c.autoApprove);
  const [replyIdentity, setReplyIdentity] = useState(c.replyIdentity);
  const [chat, setChat] = useState(c.chatLinks[0]?.url ?? '');
  const [accent, setAccent] = useState<Accent>(c.accent);
  const [insta, setInsta] = useState(c.socials.instagram);
  const [xLink, setXLink] = useState(c.socials.x);
  const [logo, setLogo] = useState<File | null>(null);
  const [rawLogo, setRawLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [admins, setAdmins] = useState<Person[]>([]);
  const [handTo, setHandTo] = useState<Person | null>(null);
  const [confirmName, setConfirmName] = useState('');
  useEffect(() => { members(c.id, {}).then((r) => setAdmins(r.people.filter((p) => p.role === 'ADMIN'))).catch(() => undefined); }, [c.id]);

  const field = 'w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15.5px] outline-none focus:border-green-text';
  async function save() {
    setBusy(true);
    try {
      const images = logo || cover ? await uploadImages(logo, cover) : null;
      const platform = /whatsapp/i.test(chat) ? 'WHATSAPP' : /discord/i.test(chat) ? 'DISCORD' : /t\.me|telegram/i.test(chat) ? 'TELEGRAM' : 'OTHER';
      await updateCommunity(c.id, {
        ...(name.trim() !== c.name ? { name: name.trim() } : {}),
        shortDescription: summary.trim(), description: description.trim(),
        rules: rules.split('\n').map((r) => r.trim()).filter(Boolean),
        visibility: 'PUBLIC', autoApprove: open, accentColor: accent, replyIdentity, socialLinks: { instagram: insta.trim(), x: xLink.trim() },
        ...(chat.trim() ? { chatLinks: [{ platform, url: chat.trim() }] } : {}),
        ...(images?.logo ? { logo: images.logo } : {}), ...(images?.coverImage ? { coverImage: images.coverImage } : {}),
      });
      toast('Saved'); setLogo(null); setCover(null); await reload();
    } catch (e) { toast(e instanceof Error ? e.message : 'Unable to save'); }
    finally { setBusy(false); }
  }
  async function handover() {
    if (!handTo) return;
    setBusy(true);
    try { await transferOwnership(c.id, handTo.membershipId); toast(`${handTo.name} is now the Owner`); setHandTo(null); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Unable to hand over'); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-5">
        <h2 className="text-[18px] font-extrabold">Profile</h2>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Name</span><input className={field} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Short bio</span><textarea className={`${field} min-h-[80px]`} maxLength={160} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">About</span><textarea className={`${field} min-h-[120px]`} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          {([['Logo', setLogo, logo], ['Cover', setCover, cover]] as const).map(([label, set, f]) => (
            <label key={label} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line p-3 hover:bg-mist">
              <ImagePlus size={20} className="text-green-text" /><span className="min-w-0"><b className="block text-[14.5px]">{label}</b><small className="block truncate text-[12.5px] text-muted">{f ? f.name : 'Upload a new one'}</small></span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => (label === 'Logo' ? setRawLogo : set)(e.target.files?.[0] ?? null)} />
            </label>
          ))}
        </div>
        <LogoCropper file={rawLogo} onDone={(f) => { setLogo(f); setRawLogo(null); }} onCancel={() => setRawLogo(null)} />
        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold">Accent colour</span>
          <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-2.5">
            {(Object.keys(ACCENTS) as Accent[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={accent === k} aria-label={k} onClick={() => setAccent(k)}
                className={`grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-transform active:scale-90 ${accent === k ? 'ring-2 ring-[var(--ink)]' : ''}`} style={{ background: ACCENTS[k] }}>
                {accent === k ? <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.bouncy}><Check size={18} strokeWidth={3} className="text-white" /></m.span> : null}
              </button>
            ))}
          </div>
          <small className="text-[12.5px] text-muted">Used for your crest ring and page header.</small>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-5">
        <h2 className="text-[18px] font-extrabold">Links</h2>
        <label className="flex flex-col gap-1.5"><span className="flex items-center gap-1.5 text-[14px] font-semibold">Group chat link{chat ? <ChatIcon url={chat} size={16} /> : null}</span><input className={field} inputMode="url" value={chat} onChange={(e) => setChat(e.target.value)} placeholder="https://chat.whatsapp.com/…" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Instagram</span><input className={field} value={insta} onChange={(e) => setInsta(e.target.value)} placeholder="@yourclub or profile link" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">X</span><input className={field} value={xLink} onChange={(e) => setXLink(e.target.value)} placeholder="@yourclub or profile link" /></label>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-5">
        <h2 className="text-[18px] font-extrabold">Joining and rules</h2>
        <div className="flex flex-col gap-2"><span className="text-[14px] font-semibold">How replies appear</span>
          <div role="radiogroup" aria-label="How replies appear" className="grid gap-2 sm:grid-cols-2">
            {([['NAME_AND_TITLE', 'Name and title', 'e.g. Amina Yusuf · Publicity Secretary'], ['TITLE_ONLY', 'Title only', 'e.g. Publicity Secretary']] as const).map(([v, t, s]) => (
              <button key={v} type="button" role="radio" aria-checked={replyIdentity === v} onClick={() => setReplyIdentity(v)} className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left ${replyIdentity === v ? 'border-green-text bg-tint' : 'border-line'}`}><b>{t}</b><small className="text-[13px] text-muted">{s}</small></button>
            ))}
          </div>
          <small className="text-[12.5px] text-muted">For chats and announcements students see. Your team always sees who really replied.</small>
        </div>
        <div role="radiogroup" aria-label="Joining policy" className="grid gap-2 sm:grid-cols-2">
          {([[true, 'Open', 'Anyone can join instantly.'], [false, 'By approval', 'You approve each request.']] as const).map(([v, t, s]) => (
            <button key={t} type="button" role="radio" aria-checked={open === v} onClick={() => setOpen(v)} className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left ${open === v ? 'border-green-text bg-tint' : 'border-line'}`}><b>{t}</b><small className="text-[13px] text-muted">{s}</small></button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Community rules</span><small className="text-[12.5px] text-muted">One rule per line.</small><textarea className={`${field} min-h-[110px]`} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={'Be kind and respectful.\nNo spam or self-promotion.'} /></label>
      </section>
      <Btn size="lg" onClick={() => void save()} disabled={busy} className="self-start">{busy ? 'Saving…' : 'Save changes'}</Btn>

      <section className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold"><Crown size={18} className="text-[var(--stamp-gold)]" />Hand over leadership</h2>
        <p className="text-[14.5px] text-muted">At the end of your term, make another Admin the Owner. Members, events, history and everyone&apos;s stamps stay as they are; you stay on as an Admin.</p>
        {admins.length ? (
          <div className="flex flex-wrap gap-2">{admins.map((p) => <Btn key={p.membershipId} kind="secondary" size="sm" onClick={() => { setHandTo(p); setConfirmName(''); }}><Avatar name={p.name} src={p.avatar} size={22} ring={false} />{p.name}</Btn>)}</div>
        ) : <p className="text-[14px]">Make someone an Admin first (Members tab), then hand over to them.</p>}
      </section>

      <Sheet open={Boolean(handTo)} onClose={() => setHandTo(null)} title="Hand over leadership">
        <div className="flex flex-col gap-4 px-5 pb-6">
          <p className="text-[15px]">Make <b>{handTo?.name}</b> the Owner of {c.name}? Only they can hand it back.</p>
          <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Type the community name to confirm</span><input className={field} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={c.name} /></label>
          <Btn wide size="lg" kind="gold" onClick={() => void handover()} disabled={busy || confirmName.trim() !== c.name}>Hand over</Btn>
        </div>
      </Sheet>
    </div>
  );
}
