'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { Bookmark, CalendarPlus, CloudOff, Settings2, Ticket } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { goingEvents, hostedEvents, savedEvents, toggleSaved, type GoingRow } from '@/lib/api/events';
import { isOffline, saveGoing, savedGoing } from '@/lib/offline';
import { Pass } from '@/components/events/register-card';
import { Sheet } from '@/components/ui/sheet';
import { phaseOf } from '@/lib/events';
import { attendanceState } from '@/lib/attendance';
import { fmtWhen } from '@/lib/format';
import { spring } from '@/lib/motion';
import { useLoginGate, useSession } from '@/lib/session';
import { Tabs } from '@/app/events/discover';
import { EventTicket } from '@/components/events/views';
import { Stamp } from '@/components/brand/stamp';
import { Btn, Chip } from '@/components/ui/bits';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast';

/** Page frame shared by Going, Saved and Hosting: the Events title and tabs, signed-in only. */
function Frame({ next, children }: { next: string; children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useSession();
  const gate = useLoginGate(next);
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 pt-6 pb-20 sm:px-6 lg:px-10 lg:pt-10">
      <header className="flex flex-col gap-5"><h1 className="text-[44px] font-extrabold sm:text-[56px]">Events</h1><Tabs /></header>
      {user ? children : gate}
    </div>
  );
}
const Loading = () => <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <div key={i} className="shimmer h-[120px] rounded-[22px]" />)}</div>;
function Empty({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-line px-6 py-14 text-center"><Stamp state="empty" size={110} tilt={-6} /><b className="text-[19px]">{title}</b><p className="max-w-sm text-muted">{body}</p>{action}</div>;
}
const List = ({ items }: { items: { key: string; node: React.ReactNode }[] }) => (
  <div className="flex flex-col gap-3">
    <AnimatePresence initial={false}>{items.map((x, i) => (
      <m.div key={x.key} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ ...spring.soft, delay: Math.min(i, 10) * 0.03 }}>{x.node}</m.div>
    ))}</AnimatePresence>
  </div>
);

/* ── Going ── */
const HOW: Record<string, [string, string]> = {
  CONFIRMED: ['Registered', 'bg-mist text-muted'], WAITLISTED: ['Waitlist', 'bg-mist text-muted'], PENDING_APPROVAL: ['Waiting for approval', 'bg-mist text-muted'],
  CHECKED_IN: ['Checked in', 'bg-tint text-green-text'], CHECKED_OUT: ['Checked out', 'bg-tint text-green-text'], COMPLETED: ['Checked out', 'bg-tint text-green-text'],
  PARTIAL_ATTENDANCE: ['Incomplete', 'bg-[color-mix(in_srgb,var(--gold)_35%,var(--surface))]'], NO_SHOW: ['Missed', 'bg-mist text-muted'],
};
/** How one of your registrations reads, from the shared attendance state (never from the status alone). */
function howItWent(r: { event: Event; status: string; attended: boolean }): [string, string] {
  const state = attendanceState(r.event, r.attended);
  if (state === 'ATTENDED') return ['Attended · stamp earned', 'bg-green text-white'];
  if (state === 'AWAITING_FINALIZE') return [r.event.finalizesAt ? `Waiting to be finalized · by ${fmtWhen(r.event.finalizesAt, r.event.timezone)}` : 'Waiting for the organizer to finalize', 'bg-[color-mix(in_srgb,var(--gold)_35%,var(--surface))]'];
  if (state === 'NOT_ATTENDED') return [r.status === 'NO_SHOW' ? 'Missed' : r.status === 'PARTIAL_ATTENDANCE' ? 'Incomplete · not counted' : 'Not counted', 'bg-mist text-muted'];
  if (state === 'EXTERNAL') return [`Registration on ${r.event.externalRegistration?.label ?? 'another site'}`, 'bg-mist text-muted'];
  if (state === 'CANCELLED') return ['Cancelled', 'bg-mist text-muted'];
  return HOW[r.status] ?? [r.status, 'bg-mist text-muted'];
}
export function GoingView() {
  const [rows, setRows] = useState<GoingRow[] | null>(null);
  // Set when the list shown is the copy saved on this device (no connection): when it was saved.
  const [offlineAt, setOfflineAt] = useState<string | null>(null);
  const [showing, setShowing] = useState<GoingRow | null>(null);
  const [when, setWhen] = useState<'UPCOMING' | 'PAST'>('UPCOMING');
  const { user } = useSession();
  const [failed, setFailed] = useState<unknown>(null);
  const load = useCallback(() => {
    if (!user) return;
    setFailed(null);
    goingEvents()
      .then((r) => {
        setRows(r); setOfflineAt(null);
        // Kept on this device, so your list and passes open with no connection.
        saveGoing(user.id, r);
        // The QR maker loads only when needed: fetch it now, while online, so it's there offline too.
        if (r.some((x) => x.pass)) void import('qrcode');
      })
      .catch((e) => {
        const saved = isOffline(e) ? savedGoing(user.id) : null;
        if (saved?.going) { setRows(saved.going); setOfflineAt(saved.savedAt); } else setFailed(e);
      });
  }, [user]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const again = () => load(); window.addEventListener('online', again); return () => window.removeEventListener('online', again); }, [load]);
  const split = useMemo(() => {
    const l = rows ?? [];
    const up = l.filter((r) => ['BEFORE', 'LIVE'].includes(phaseOf(r.event))).sort((a, b) => (a.event.startDate ?? '').localeCompare(b.event.startDate ?? ''));
    const past = l.filter((r) => !['BEFORE', 'LIVE'].includes(phaseOf(r.event))).sort((a, b) => (b.event.startDate ?? '').localeCompare(a.event.startDate ?? ''));
    return { UPCOMING: up, PAST: past };
  }, [rows]);
  const list = split[when];
  return (
    <Frame next="/events/going">
      <div className="flex gap-2">{(['UPCOMING', 'PAST'] as const).map((k) => <Chip key={k} on={when === k} onClick={() => setWhen(k)}>{k === 'UPCOMING' ? 'Upcoming' : 'Past'} {rows ? split[k].length : ''}</Chip>)}</div>
      {offlineAt ? <p role="status" className="flex items-start gap-2.5 rounded-2xl bg-mist px-4 py-3 text-[14px]"><CloudOff size={17} className="mt-0.5 shrink-0 text-muted" /><span><b>You&apos;re offline.</b> This is your list as saved on this device {fmtWhen(offlineAt)}. Your passes still work at the door.</span></p> : null}
      {failed && rows === null ? <ErrorState compact error={failed} onRetry={load} /> : rows === null ? <Loading /> : list.length ? (
        <List items={list.map((r) => ({ key: r.event.id, node: (
          <div className="flex flex-col gap-1.5">
            <EventTicket event={r.event} attended={attendanceState(r.event, r.attended) === 'ATTENDED'} />
            <span className="flex flex-wrap items-center gap-2">
              <span className={`ml-1 w-fit rounded-full px-2.5 py-0.5 text-[12px] font-bold ${howItWent(r)[1]}`}>{howItWent(r)[0]}</span>
              {r.pass && when === 'UPCOMING' ? <button type="button" onClick={() => setShowing(r)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-semibold hover:bg-mist"><Ticket size={14} />Show pass</button> : null}
            </span>
          </div>
        ) }))} />
      ) : when === 'UPCOMING'
        ? <Empty title="Nothing on your calendar" body="Register for an event and it shows up here, with your pass." action={<Btn href="/events">Find an event</Btn>} />
        : <Empty title="No past events yet" body="Events you went to land here, with the stamps you earned." action={<Btn href="/events">Find an event</Btn>} />}
      {/* The pass right here, so it opens even when the event's page can't load. */}
      <Sheet open={Boolean(showing)} onClose={() => setShowing(null)} title="Show this at the door" width={420}>
        {showing?.pass ? (
          <div className="px-5 pb-6">
            <Pass reg={{ id: '', status: showing.status as never, qrToken: showing.pass.qrToken, passCode: showing.pass.passCode, checkInAt: showing.checkInAt, checkOutAt: null }} title={showing.event.title} name={user?.fullName ?? ''} />
            <p className="mt-3 text-center text-[13px] text-muted">{fmtWhen(showing.event.startDate, showing.event.timezone)}{showing.event.venue ? ` · ${showing.event.venue}` : ''}</p>
          </div>
        ) : null}
      </Sheet>
    </Frame>
  );
}

/* ── Saved ── */
export function SavedView() {
  const toast = useToast();
  const { user } = useSession();
  const [list, setList] = useState<Event[] | null>(null);
  const [failed, setFailed] = useState<unknown>(null);
  const load = useCallback(() => { setFailed(null); savedEvents().then((l) => setList(l.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')))).catch(setFailed); }, []);
  useEffect(() => { if (user) load(); }, [user, load]);
  async function unsave(e: Event) {
    setList((l) => l?.filter((x) => x.id !== e.id) ?? l);
    try { await toggleSaved(e.id); toast('Removed from saved'); } catch { setList((l) => (l ? [...l, e] : l)); toast('Unable to remove'); }
  }
  return (
    <Frame next="/events/saved">
      {failed && list === null ? <ErrorState compact error={failed} onRetry={load} /> : list === null ? <Loading /> : list.length ? (
        <List items={list.map((e) => ({ key: e.id, node: (
          <div className="relative">
            <EventTicket event={e} />
            <button type="button" onClick={() => void unsave(e)} aria-label={`Remove ${e.title} from saved`} className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-surface/90 shadow-card backdrop-blur hover:bg-mist"><Bookmark size={16} className="fill-green-text text-green-text" /></button>
          </div>
        ) }))} />
      ) : <Empty title="Nothing saved yet" body="Tap the bookmark on any event to keep it here for later." action={<Btn href="/events">Browse events</Btn>} />}
    </Frame>
  );
}

/* ── Hosting ── */
export function HostingView() {
  const { user } = useSession();
  const [list, setList] = useState<Event[] | null>(null);
  const [sub, setSub] = useState<'DRAFTS' | 'UPCOMING' | 'PAST'>('UPCOMING');
  const [failed, setFailed] = useState<unknown>(null);
  const load = useCallback(() => { setFailed(null); hostedEvents().then(setList).catch(setFailed); }, []);
  useEffect(() => { if (user) load(); }, [user, load]);
  const groups = useMemo(() => {
    const l = list ?? [];
    return {
      DRAFTS: l.filter((e) => e.status === 'DRAFT'),
      UPCOMING: l.filter((e) => e.status !== 'DRAFT' && ['BEFORE', 'LIVE'].includes(phaseOf(e))).sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')),
      PAST: l.filter((e) => e.status !== 'DRAFT' && !['BEFORE', 'LIVE'].includes(phaseOf(e))).sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '')),
    };
  }, [list]);
  const shown = groups[sub];
  return (
    <Frame next="/events/hosting">
      <div><h2 className="text-[24px] font-extrabold">Manage your events</h2><p className="mt-1 text-[14px] text-muted">Edit event details, set up registration questions and manage attendees across your communities.</p></div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">{(['DRAFTS', 'UPCOMING', 'PAST'] as const).map((k) => <Chip key={k} on={sub === k} onClick={() => setSub(k)}>{k === 'DRAFTS' ? 'Drafts' : k === 'UPCOMING' ? 'Upcoming' : 'Past'} {list ? groups[k].length : ''}</Chip>)}</div>
        <Btn href="/events/new"><CalendarPlus size={16} />New event</Btn>
      </div>
      {failed && list === null ? <ErrorState compact error={failed} onRetry={load} /> : list === null ? <Loading /> : shown.length ? (
        <List items={shown.map((e) => ({ key: e.id, node: (
          <div className="flex flex-col gap-1.5">
            <EventTicket event={e} />
            <span className="flex flex-wrap gap-3 pl-1 text-[13.5px]">
              {e.status === 'DRAFT' ? <Link href={`/events/${e.slug}/edit`} className="font-semibold text-green-text hover:underline">Finish draft</Link> : <Link href={`/events/${e.slug}/manage`} className="inline-flex items-center gap-1 font-semibold text-green-text hover:underline"><Settings2 size={13} />Manage event</Link>}
              <span className="text-muted">{e.community.name}</span>
            </span>
          </div>
        ) }))} />
      ) : list.length === 0
        ? <Empty title="You're not hosting anything" body="Events you run with your communities show up here, drafts included." action={<Btn href="/events/new">Create an event</Btn>} />
        : <p className="py-10 text-center text-muted">Nothing here.</p>}
    </Frame>
  );
}
