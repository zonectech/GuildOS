'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { Award, BellRing, CalendarClock, CheckCheck, ClipboardCheck, Settings, Ticket, Users } from 'lucide-react';
import { isWeb2Path, markAllRead, markRead, notifications, type Notice } from '@/lib/api/session';
import { classic } from '@/lib/api/client';
import { spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { refreshLive, useLiveCounts } from '@/components/shell/live';
import { fmtWhen } from '@/lib/format';
import { Stamp } from '@/components/brand/stamp';
import { Btn } from '@/components/ui/bits';
import { fmtAgo } from '@/lib/format';

/** A notification, or several related ones merged (attendance finalized + certificate ready = one item). */
type Item = { when: string; key: string; ids: string[]; title: string; body: string; link: string; read: boolean; createdAt: string; kind: Notice['category']; actions: { label: string; href: string }[] };

const ago = (iso: string) => fmtAgo(iso);
function groupOf(iso: string) {
  const d = new Date(iso); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return 'Earlier';
}
function Icon({ kind }: { kind: Notice['category'] }) {
  if (kind === 'STAMP') return <Stamp size={40} tilt={-10} label="Stamped" />;
  const box = (child: React.ReactNode, tone = 'bg-mist') => <span className={`grid size-10 place-items-center rounded-full ${tone}`}>{child}</span>;
  if (kind === 'CERTIFICATE') return box(<Award size={19} className="text-[var(--stamp-gold)]" />, 'bg-[color-mix(in_srgb,var(--gold)_22%,var(--surface))]');
  if (kind === 'REMINDER') return box(<CalendarClock size={19} className="text-green-text" />, 'bg-tint');
  if (kind === 'EVENT_UPDATE') return box(<BellRing size={19} className="text-coral-text" />, 'bg-[color-mix(in_srgb,var(--coral)_16%,var(--surface))]');
  if (kind === 'REGISTRATION') return box(<Ticket size={19} className="text-green-text" />, 'bg-tint');
  if (kind === 'COMMUNITY') return box(<Users size={19} className="text-green-text" />, 'bg-tint');
  if (kind === 'ORGANIZER') return box(<ClipboardCheck size={19} className="text-ink" />);
  return box(<BellRing size={19} className="text-muted" />);
}
const actionsFor = (n: Notice): Item['actions'] => {
  if (n.category === 'CERTIFICATE') return [{ label: 'View certificate', href: n.link }];
  if ((n.category === 'REGISTRATION' || n.category === 'REMINDER') && n.eventSlug) return [{ label: 'View pass', href: `/events/${n.eventSlug}` }];
  if (n.category === 'STAMP') return [{ label: 'See your passport', href: '/me' }];
  if (n.category === 'EVENT_UPDATE' && n.eventSlug) return [{ label: 'View event', href: `/events/${n.eventSlug}` }];
  return [];
};

/** Merge a stamp and a certificate for the same event into one item; drop chat items (they live in the Inbox). */
/** Which event a stamp or certificate notification is about (certificates link to the certificate, not the event). */
const eventKey = (n: Notice) => n.eventSlug || (n.title.match(/^(?:Thanks for attending|You earned a certificate for) (.+)$/)?.[1] ?? '');

function merge(list: Notice[]): Item[] {
  const out: Item[] = [];
  const byEvent = new Map<string, Item>();
  for (const n of list) {
    if (n.category === 'MESSAGE') continue;
    const item: Item = { when: n.category === 'EVENT_UPDATE' && n.eventStart ? fmtWhen(n.eventStart, n.eventTimezone) : '', key: n.id, ids: [n.id], title: n.title, body: n.body, link: n.link, read: n.read, createdAt: n.createdAt, kind: n.category, actions: actionsFor(n) };
    const key = n.category === 'STAMP' || n.category === 'CERTIFICATE' ? eventKey(n) : '';
    const related = key ? byEvent.get(key) : undefined;
    if (related && related.kind !== n.category && Math.abs(new Date(related.createdAt).getTime() - new Date(n.createdAt).getTime()) < 3 * 86400_000) {
      related.ids.push(n.id);
      related.read = related.read && n.read;
      related.kind = 'CERTIFICATE';
      related.title = related.title.replace(/^Thanks for attending /, 'Stamp added · ').replace(/^You earned a certificate for /, 'Stamp added · ');
      if (!/certificate/i.test(related.body)) related.body = 'Your attendance is finalized and your certificate is ready.';
      related.actions = [{ label: 'See your passport', href: '/me' }, ...[...actionsFor(n), ...related.actions].filter((a) => a.label !== 'See your passport')].filter((a, i, all) => all.findIndex((b) => b.label === a.label) === i);
      if (n.category === 'CERTIFICATE') related.link = n.link;
      continue;
    }
    out.push(item);
    if (key) byEvent.set(key, item);
  }
  return out;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [raw, setRaw] = useState<Notice[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => { if (!loading && !user) router.replace('/login?next=/notifications'); }, [loading, user, router]);
  const load = useCallback(() => notifications().then((r) => { setRaw(r.items); setNext(r.next); }).catch(() => setRaw([])), []);
  useEffect(() => { if (user) void load(); }, [user, load]);
  const items = useMemo(() => merge(raw ?? []), [raw]);
  const groups = useMemo(() => {
    const g: [string, Item[]][] = [];
    for (const it of items) { const k = groupOf(it.createdAt); const last = g[g.length - 1]; if (last?.[0] === k) last[1].push(it); else g.push([k, [it]]); }
    return g;
  }, [items]);
  // Same number as the bell in the sidebar and the tab title.
  const unread = useLiveCounts().notifications;

  const go = (href: string) => { if (/^https?:\/\//.test(href)) window.location.href = href; else if (isWeb2Path(href)) router.push(href); else window.location.href = classic(href); };
  function open(it: Item, href = it.link) {
    if (!it.read) { setRaw((l) => l?.map((x) => (it.ids.includes(x.id) ? { ...x, read: true } : x)) ?? l); void Promise.all(it.ids.map((id) => markRead(id).catch(() => undefined))).then(refreshLive); }
    if (href) go(href);
  }
  async function readAll() {
    setRaw((l) => l?.map((x) => ({ ...x, read: true })) ?? l);
    try { await markAllRead(); refreshLive(); } catch { void load(); }
  }
  if (!user) return null;
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 pt-6 pb-24 sm:px-6 lg:pt-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-[40px] font-extrabold">Notifications{unread ? <m.span key={unread} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={spring.bouncy} className="rounded-full bg-coral px-2.5 py-0.5 text-[16px] text-[#111714] tabular-nums">{unread > 9 ? '9+' : unread}</m.span> : null}</h1>
        <span className="flex items-center gap-2">
          {unread ? <Btn kind="secondary" size="sm" onClick={() => void readAll()}><CheckCheck size={16} />Mark all as read</Btn> : null}
          <Link href="/notifications/settings" aria-label="Notification settings" className="grid size-10 place-items-center rounded-full border border-line hover:bg-mist"><Settings size={18} /></Link>
        </span>
      </header>

      {raw === null ? <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="shimmer h-[76px] rounded-2xl" />)}</div>
        : items.length ? groups.map(([g, list]) => (
          <section key={g} className="flex flex-col gap-2" aria-label={g}>
            <h2 className="text-[13px] font-bold tracking-[.08em] text-muted uppercase">{g}</h2>
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
              <AnimatePresence initial={false}>{list.map((it, i) => (
                <m.li key={it.key} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.soft, delay: Math.min(i, 8) * 0.03 }}
                  className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${it.read ? '' : 'bg-[color-mix(in_srgb,var(--tint)_55%,transparent)]'}`}>
                  <button type="button" onClick={() => open(it)} className="shrink-0" aria-label={it.title}><Icon kind={it.kind} /></button>
                  <span className="min-w-0 flex-1">
                    <button type="button" onClick={() => open(it)} className="block w-full text-left">
                      <b className={`block text-[15px] ${it.read ? 'font-semibold' : 'font-extrabold'}`}>{it.title}</b>
                      {it.body ? <span className="line-clamp-2 text-[14px] text-muted">{it.body}</span> : null}
                      {it.when ? <span className="mt-0.5 block text-[13px] font-semibold">{it.when}</span> : null}
                      <small className="mt-0.5 block text-[12.5px] text-muted">{ago(it.createdAt)}</small>
                    </button>
                    {it.actions.length ? <span className="mt-2 flex flex-wrap gap-2">{it.actions.map((a) => <Btn key={a.label} size="sm" kind="secondary" onClick={() => open(it, a.href)}>{a.label}</Btn>)}</span> : null}
                  </span>
                  {!it.read ? <span aria-label="Unread" className="mt-2 size-2.5 shrink-0 rounded-full bg-coral" /> : null}
                </m.li>
              ))}</AnimatePresence>
            </ul>
          </section>
        )) : (
          <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-line px-6 py-14 text-center">
            <m.span animate={{ rotate: [-6, 4, -6], y: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}><Stamp state="empty" size={110} tilt={0} /></m.span>
            <b className="text-[19px]">You&apos;re all caught up.</b>
            <p className="max-w-sm text-muted">Reminders, stamps, certificates and community news show up here. Chats and announcements are in your Inbox.</p>
          </div>
        )}
      {next ? <Btn kind="secondary" className="self-center" onClick={() => void notifications(next).then((r) => { setRaw((l) => [...(l ?? []), ...r.items]); setNext(r.next); })}>Load older</Btn> : null}
    </div>
  );
}
