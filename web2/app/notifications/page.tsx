'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { Award, Bell, CalendarCheck, CheckCheck, Megaphone, ShieldCheck, Users } from 'lucide-react';
import { emailPrefs, isWeb2Path, markAllRead, markRead, notifications, setEmailPrefs, type Notice } from '@/lib/api/session';
import { classic } from '@/lib/api/client';
import { spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { Avatar } from '@/components/ui/avatar';
import { Btn } from '@/components/ui/bits';
import { Stamp } from '@/components/brand/stamp';
import { useToast } from '@/components/ui/toast';

const ICON: Record<string, React.ReactNode> = {
  CERTIFICATE_EARNED: <Award size={18} className="text-[var(--stamp-gold)]" />, JOIN_APPROVED: <Users size={18} className="text-green-text" />,
  COMMUNITY_FOLLOW: <Users size={18} className="text-green-text" />, SYSTEM: <Megaphone size={18} className="text-green-text" />,
};
const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
};
function group(n: Notice) {
  const d = new Date(n.createdAt); const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (now.getTime() - d.getTime() < 7 * 86400_000) return 'This week';
  return 'Earlier';
}

export default function NotificationsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading } = useSession();
  const [list, setList] = useState<Notice[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [email, setEmail] = useState<boolean | null>(null);
  useEffect(() => { if (!loading && !user) router.replace('/login?next=/notifications'); }, [loading, user, router]);
  const load = useCallback(() => notifications().then((r) => { setList(r.items); setNext(r.next); }).catch(() => setList([])), []);
  useEffect(() => { if (user) { void load(); emailPrefs().then((p) => setEmail(p.newEventEmailEnabled)).catch(() => undefined); } }, [user, load]);
  const groups = useMemo(() => {
    const out: [string, Notice[]][] = [];
    for (const n of list ?? []) { const g = group(n); const last = out[out.length - 1]; if (last?.[0] === g) last[1].push(n); else out.push([g, [n]]); }
    return out;
  }, [list]);
  const unread = (list ?? []).filter((n) => !n.read).length;

  async function open(n: Notice) {
    if (!n.read) { setList((l) => l?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? l); void markRead(n.id).catch(() => undefined); }
    if (!n.link) return;
    if (/^https?:\/\//.test(n.link)) { window.location.href = n.link; return; }
    if (isWeb2Path(n.link)) router.push(n.link); else window.location.href = classic(n.link);
  }
  async function readAll() {
    setList((l) => l?.map((x) => ({ ...x, read: true })) ?? l);
    try { await markAllRead(); toast('All caught up'); } catch { void load(); }
  }
  if (!user) return null;
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 pt-6 pb-24 sm:px-6 lg:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex items-center gap-3 text-[40px] font-extrabold">Notifications{unread ? <m.span key={unread} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={spring.bouncy} className="rounded-full bg-coral px-2.5 py-0.5 text-[16px] text-[#111714] tabular-nums">{unread}</m.span> : null}</h1>
        {unread ? <Btn kind="secondary" size="sm" onClick={() => void readAll()}><CheckCheck size={16} />Mark all read</Btn> : null}
      </header>

      {list === null ? <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="shimmer h-[72px] rounded-2xl" />)}</div>
        : list.length ? groups.map(([g, items]) => (
          <section key={g} className="flex flex-col gap-2" aria-label={g}>
            <h2 className="text-[13px] font-bold tracking-[.08em] text-muted uppercase">{g}</h2>
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
              <AnimatePresence initial={false}>{items.map((n, i) => (
                <m.li key={n.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.soft, delay: Math.min(i, 8) * 0.03 }}>
                  <button type="button" onClick={() => void open(n)} className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-mist ${n.read ? '' : 'bg-[color-mix(in_srgb,var(--tint)_55%,transparent)]'}`}>
                    <span className="relative mt-0.5 shrink-0">
                      {n.actor ? <Avatar name={n.actor.fullName} src={n.actor.avatar} size={40} ring={false} /> : <span className="grid size-10 place-items-center rounded-full bg-mist">{ICON[n.type] ?? (/event|attendance|stamp/i.test(n.title) ? <CalendarCheck size={18} className="text-green-text" /> : /approved|verified/i.test(n.title) ? <ShieldCheck size={18} className="text-green-text" /> : <Bell size={18} className="text-muted" />)}</span>}
                    </span>
                    <span className="min-w-0 flex-1"><b className={`block text-[15px] ${n.read ? 'font-semibold' : 'font-extrabold'}`}>{n.title}</b>{n.body ? <span className="line-clamp-2 text-[14px] text-muted">{n.body}</span> : null}<small className="mt-0.5 block text-[12.5px] text-muted">{ago(n.createdAt)}</small></span>
                    {!n.read ? <span aria-label="Unread" className="mt-2 size-2.5 shrink-0 rounded-full bg-coral" /> : null}
                  </button>
                </m.li>
              ))}</AnimatePresence>
            </ul>
          </section>
        )) : (
          <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-line px-6 py-14 text-center"><Stamp state="empty" size={110} tilt={-6} /><b className="text-[19px]">You&apos;re all caught up</b><p className="max-w-sm text-muted">Event updates, approvals, stamps and certificates show up here.</p></div>
        )}
      {next ? <Btn kind="secondary" className="self-center" onClick={() => void notifications(next).then((r) => { setList((l) => [...(l ?? []), ...r.items]); setNext(r.next); })}>Load older</Btn> : null}

      {email !== null ? (
        <button type="button" role="switch" aria-checked={email} onClick={() => { const v = !email; setEmail(v); void setEmailPrefs(v).catch(() => setEmail(!v)); }} className="flex items-center justify-between gap-4 rounded-2xl border border-line p-4 text-left hover:bg-mist">
          <span><b className="block text-[15px]">Email me about new events</b><small className="text-[13px] text-muted">When a community you&apos;re in publishes an event.</small></span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${email ? 'bg-green' : 'bg-line'}`}><m.span layout transition={spring.snap} className={`absolute top-1 size-5 rounded-full bg-white shadow ${email ? 'right-1' : 'left-1'}`} /></span>
        </button>
      ) : null}
    </div>
  );
}
