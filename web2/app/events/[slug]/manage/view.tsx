'use client';
import { isNotFound } from '@/lib/api/client';
import { NotFoundPanel } from '@/components/ui/not-found-panel';
import { ErrorState } from '@/components/ui/error-state';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { ArrowLeft, Ban, Check, Copy, ExternalLink, FileUp, Megaphone, Pencil, QrCode, Search, Star, UserPlus, X } from 'lucide-react';
import {
  addHelper, applyReport, issueReports, reviewIssue, cancelEvent, corrections, correctCheckOut, eventRatings, finalize, helpers, issueCertificates, liveCounts, loadHostEvent, openAttendance,
  previewReport, registrations, removeHelper, sendUpdate,
  type AttendanceCorrection, type AttendanceRecord, type IssueReport, type AttendanceReport, type AttendeeStatus, type Helper, type LiveCounts, type Ratings,
} from '@/lib/api/host';
import { members } from '@/lib/api/communities';
import { usePoll } from '@/lib/poll';
import { spring } from '@/lib/motion';
import { useLoginGate, useSession } from '@/lib/session';
import { Celebration } from '@/components/celebrate/celebration';
import { SealText, Stamp } from '@/components/brand/stamp';
import { Scanner } from '@/components/host/scanner';
import { AttendeeTools } from '@/components/host/attendee-tools';
import { submissionProgress } from '@/lib/attendee-submissions';
import { RegistrationSettings } from '@/components/host/registration-settings';
import { DoorWorkspace } from '@/components/host/door-workspace';
import { doorBySlug } from '@/lib/door';
import { isOffline } from '@/lib/offline';
import { Avatar } from '@/components/ui/avatar';
import { Btn, Chip, CountUp, SkeletonCard } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { fmtDate, fmtTime, fmtWhen } from '@/lib/format';
import { Req } from '@/components/ui/req';

type Loaded = Awaited<ReturnType<typeof loadHostEvent>>;
type Phase = 'DRAFT' | 'BEFORE' | 'LIVE' | 'AFTER' | 'CANCELLED';
const phaseOf = (e: Loaded, now = Date.now()): Phase => {
  if (e.status === 'DRAFT') return 'DRAFT';
  if (e.status === 'ARCHIVED' && e.cancellationReason) return 'CANCELLED';
  if (new Date(e.draft.endDate).getTime() <= now || e.status === 'COMPLETED') return 'AFTER';
  if (new Date(e.draft.startDate).getTime() <= now) return 'LIVE';
  return 'BEFORE';
};
const PHASE_LABEL: Record<Phase, string> = { DRAFT: 'Draft', BEFORE: 'Upcoming', LIVE: 'Live now', AFTER: 'Ended', CANCELLED: 'Cancelled' };
const STATUS_CHIP: Record<string, [string, string]> = {
  CONFIRMED: ['Registered', 'bg-mist text-muted'], PENDING_APPROVAL: ['Waiting approval', 'bg-mist text-muted'], WAITLISTED: ['Waitlist', 'bg-mist text-muted'],
  CHECKED_IN: ['Checked in', 'bg-tint text-green-text'], CHECKED_OUT: ['Checked out', 'bg-tint text-green-text'], COMPLETED: ['Finalized', 'bg-green text-white'],
  PARTIAL_ATTENDANCE: ['Incomplete', 'bg-[color-mix(in_srgb,var(--gold)_35%,var(--surface))]'], NO_SHOW: ['No-show', 'bg-mist text-muted'], CANCELLED: ['Cancelled', 'bg-mist text-muted'], REJECTED: ['Declined', 'bg-mist text-muted'],
};
const time = (iso: string | null) => (iso ? fmtTime(iso) : '—');

/** The event workspace: what you see depends on where the event is (before, live, after). */
export function Workspace({ slug }: { slug: string }) {
  const router = useRouter();
  const { user, loading } = useSession();
  const [ev, setEv] = useState<Loaded | null>(null);
  const [people, setPeople] = useState<AttendanceRecord[] | null>(null);
  const [peopleError, setPeopleError] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => { setError(null); return loadHostEvent(slug).then(setEv).catch(setError); }, [slug]);
  const loadPeople = useCallback(async () => { if (!ev || ev.status === 'DRAFT') return; setPeopleError(null); try { setPeople(await registrations(ev.id)); } catch (e) { setPeopleError(e); } }, [ev]);

  const gate = useLoginGate(`/events/${slug}/manage`);
  useEffect(() => { if (user) void load(); }, [user, load]);
  useEffect(() => { if (ev?.canManage) void loadPeople(); }, [ev?.id, ev?.canManage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return gate;
  // No connection: the door still opens, from the attendee list saved on this device.
  const savedDoor = error && !ev && isOffline(error) ? doorBySlug(slug) : null;
  if (savedDoor) return <DoorWorkspace offline ev={{ id: savedDoor.event.id, slug, status: savedDoor.event.status, draft: { title: savedDoor.event.title, startDate: savedDoor.event.startDate, timezone: savedDoor.event.timezone } }} />;
  if (error && !ev) return isNotFound(error) ? <NotFoundPanel title="No event at this address" body="It may have been removed, or the link is mistyped." href="/events/hosting" label="Your events" /> : <ErrorState error={error} onRetry={() => void load()} />;
  if (!ev) return <div className="mx-auto max-w-[1100px] px-4 pt-10"><SkeletonCard /></div>;
  // Event Helpers get the door and nothing else.
  if (!ev.canManage && ev.canScan) return <DoorWorkspace ev={ev} />;
  if (!ev.canManage) return <div className="mx-auto max-w-lg px-6 py-24 text-center"><h1 className="text-[28px] font-extrabold">Only the hosts can run this event</h1><Btn className="mt-6" href={`/events/${slug}`}>Back to the event</Btn></div>;

  const phase = phaseOf(ev);
  const external = ev.draft.attendanceSource === 'EXTERNAL';
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 pt-6 pb-20 sm:px-6 lg:px-8 lg:pt-10">
      <Link href={ev.community ? `/communities/${ev.community.slug}/manage?tab=events` : '/events'} className="inline-flex w-fit items-center gap-1.5 text-[14.5px] font-semibold text-muted hover:text-ink"><ArrowLeft size={17} />{ev.community?.name ?? 'Back'}</Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${phase === 'LIVE' ? 'bg-coral text-[#111714]' : phase === 'CANCELLED' ? 'bg-mist text-muted' : 'bg-tint text-green-text'}`}>
            {phase === 'LIVE' ? <span className="size-1.5 animate-pulse rounded-full bg-[#111714]" /> : null}{PHASE_LABEL[phase]}{external ? ' · external listing' : ''}
          </span>
          <h1 className="mt-2 text-[30px] font-extrabold sm:text-[38px]">{ev.draft.title}</h1>
          <p className="text-[14.5px] text-muted">{fmtWhen(ev.draft.startDate, ev.draft.timezone)} · {ev.draft.mode === 'VIRTUAL' ? 'Online' : ev.draft.venue}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn kind="secondary" size="sm" href={`/events/${ev.slug}`}><ExternalLink size={15} />View page</Btn>
          {phase !== 'AFTER' && phase !== 'CANCELLED' ? <Btn kind="secondary" size="sm" href={`/events/${ev.slug}/edit`}><Pencil size={15} />Edit</Btn> : null}
          <CopyLink slug={ev.slug} />
        </div>
      </header>

      <nav aria-label="Event management" className="flex flex-wrap gap-2">
        <Btn kind="secondary" size="sm" href="/events/hosting">All my events</Btn>
        <a href="#overview" className="rounded-full border border-line px-4 py-2 text-[14px] font-semibold">Overview</a>
        <a href="#registration" className="rounded-full border border-line px-4 py-2 text-[14px] font-semibold">Registration form</a>
        {phase !== 'DRAFT' ? <a href="#attendees" className="rounded-full border border-line px-4 py-2 text-[14px] font-semibold">Attendees</a> : null}
      </nav>
      <div id="overview" className="scroll-mt-24" />
      {phase === 'DRAFT' ? <div className="rounded-[22px] border border-dashed border-line p-8 text-center"><p className="text-[16px]">This is a draft. Only your team can see it.</p><Btn className="mt-4" href={`/events/${ev.slug}/edit`}>Finish and publish</Btn></div> : null}
      {phase === 'CANCELLED' ? <div className="rounded-[22px] bg-mist p-6"><b>Cancelled.</b> Students see: “{ev.cancellationReason}”</div> : null}
      {phase === 'BEFORE' ? <Before ev={ev} people={people} reload={load} /> : null}
      {phase === 'LIVE' && !external ? <Live ev={ev} reloadPeople={loadPeople} reload={load} /> : null}
      {phase === 'LIVE' && external ? <p className="rounded-[22px] bg-mist p-6">Happening now on {ev.draft.partnerRegistrationLabel || 'the partner site'}. Attendance is recorded there; after the event you can upload its report.</p> : null}
      {phase === 'AFTER' ? (external ? <ExternalAfter ev={ev} reload={load} reloadPeople={loadPeople} /> : <After ev={ev} people={people} reload={load} reloadPeople={loadPeople} />) : null}
      {phase === 'AFTER' ? <StudentReports ev={ev} /> : null}
      {(phase === 'BEFORE' || phase === 'LIVE') && !external ? <Helpers ev={ev} /> : null}
      <RegistrationSettings key={ev.id} eventId={ev.id} initial={ev.draft.registrationQuestions} external={external} locked={phase === 'AFTER' || phase === 'CANCELLED'} onSaved={(questions) => setEv((current) => current ? { ...current, draft: { ...current.draft, registrationQuestions: questions } } : current)} />
      {phase !== 'DRAFT' ? peopleError ? <div id="attendees"><ErrorState compact error={peopleError} onRetry={() => void loadPeople()} /></div> : <Attendees ev={ev} people={people} refresh={loadPeople} /> : null}
    </div>
  );
}

function CopyLink({ slug }: { slug: string }) {
  const toast = useToast();
  return <Btn kind="secondary" size="sm" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/events/${slug}`).then(() => toast('Link copied'))}><Copy size={15} />Copy link</Btn>;
}

/** A progress ring that fills with a spring. */
function Ring({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.min(1, value / max) : 0;
  const r = 52; const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-[132px] shrink-0 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90"><circle cx="60" cy="60" r={r} fill="none" stroke="var(--mist)" strokeWidth="10" />
        <m.circle cx="60" cy="60" r={r} fill="none" stroke="var(--green-text)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - (max ? pct : 0.02)) }} transition={spring.soft} /></svg>
      <span className="text-center"><b className="block font-display text-[28px] leading-none"><CountUp to={value} /></b><small className="text-[12px] text-muted">{label}</small></span>
    </div>
  );
}

/* ── Before ──────────────────────────────────────────────────────── */
function Before({ ev, people, reload }: { ev: Loaded; people: AttendanceRecord[] | null; reload: () => Promise<unknown> }) {
  const toast = useToast();
  const [sheet, setSheet] = useState<'update' | 'cancel' | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const going = (people ?? []).filter((p) => !['CANCELLED', 'REJECTED'].includes(p.status)).length || ev.registrationCount;
  async function send() {
    setBusy(true);
    try { const r = await sendUpdate(ev.id, subject.trim(), message.trim()); toast(`Sent to ${r.recipients} registered student${r.recipients === 1 ? '' : 's'}`); setSheet(null); setSubject(''); setMessage(''); }
    catch (e) { toast(e instanceof Error ? e.message : 'Unable to send'); } finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true);
    try { await cancelEvent(ev.id, reason.trim()); toast('Event cancelled. Registered students were told why'); setSheet(null); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Unable to cancel'); } finally { setBusy(false); }
  }
  const field = 'w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15.5px] outline-none focus:border-green-text';
  return (
    <section className="flex flex-col gap-5 rounded-[22px] border border-line bg-surface p-5 sm:flex-row sm:items-center">
      {ev.draft.attendanceSource === 'GUILDOS' ? <Ring value={going} max={ev.draft.capacity} label={ev.draft.capacity ? `of ${ev.draft.capacity} places` : 'registered'} /> : null}
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-[15px]">{ev.draft.attendanceSource === 'EXTERNAL' ? <>Students register on {ev.draft.partnerRegistrationLabel || 'the partner site'}. This page is a listing.</> : <>Registration is open{ev.draft.registrationDeadline ? ` until ${fmtWhen(ev.draft.registrationDeadline)}` : ''}. On the day, open the scanner here.</>}</p>
        <div className="flex flex-wrap gap-2">
          {ev.draft.attendanceSource === 'GUILDOS' ? <Btn onClick={() => setSheet('update')}><Megaphone size={16} />Send update to registered students</Btn> : null}
          <Btn kind="secondary" onClick={() => setSheet('cancel')}><Ban size={16} />Cancel event</Btn>
        </div>
      </div>
      <Sheet open={sheet === 'update'} onClose={() => setSheet(null)} title="Send an update">
        <div className="flex flex-col gap-3 px-5 pb-6">
          <p className="text-[14px] text-muted">Goes to everyone registered, as a notification and email. Use it for venue changes and reminders.</p>
          <input className={field} value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="Subject, e.g. Venue moved to LT 3" aria-label="Subject" />
          <textarea className={`${field} min-h-[120px]`} value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} placeholder="Your message" aria-label="Message" />
          <Btn wide size="lg" onClick={() => void send()} disabled={busy || subject.trim().length < 3 || message.trim().length < 5}>{busy ? 'Sending…' : 'Send update'}</Btn>
        </div>
      </Sheet>
      <Sheet open={sheet === 'cancel'} onClose={() => setSheet(null)} title="Cancel event">
        <div className="flex flex-col gap-3 px-5 pb-6">
          <p className="text-[15px]">Cancelling tells everyone registered and shows your reason on the event page. It can&apos;t be undone.</p>
          <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Public reason<Req /></span><textarea className={`${field} min-h-[90px]`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The hall booking fell through. We'll share a new date soon." /></label>
          <Btn wide size="lg" onClick={() => void cancel()} disabled={busy || reason.trim().length < 10} className="!bg-[var(--danger)] !shadow-none text-white hover:!bg-[var(--danger-hover)]">{busy ? 'Cancelling…' : 'Cancel event'}</Btn>
        </div>
      </Sheet>
    </section>
  );
}

/* ── Live ────────────────────────────────────────────────────────── */
function Live({ ev, reloadPeople, reload }: { ev: Loaded; reloadPeople: () => Promise<void>; reload: () => Promise<unknown> }) {
  const toast = useToast();
  const [counts, setCounts] = useState<LiveCounts | null>(null);
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const refresh = useCallback(async () => {
    const next = await liveCounts(ev.id);
    let changed = false;
    setCounts((cur) => { changed = !cur || cur.checkedIn !== next.checkedIn || cur.checkedOut !== next.checkedOut; return next; });
    return changed;
  }, [ev.id]);
  useEffect(() => { void refresh().catch(() => undefined); }, [refresh]);
  usePoll(refresh, 5000, !scanning); // every 5 s while visible; paused while the tab is hidden

  async function open(status: 'CHECK_IN' | 'CHECK_OUT') {
    try { await openAttendance(ev.id, status); await reload(); await refresh(); } catch (e) { toast(e instanceof Error ? e.message : 'Unable to open attendance'); }
  }
  const notOpen = ev.status === 'PUBLISHED';
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {([['Checked in', counts?.checkedIn], ['Checked out', counts?.checkedOut], ['Not yet arrived', counts?.pendingArrivals]] as const).map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-4"><b className="font-display text-[30px] tabular-nums">{v === undefined ? '–' : <CountUp to={v} />}</b><span className="block text-[13px] text-muted">{k}</span></div>
        ))}
      </div>
      {notOpen ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-line bg-surface p-5"><p className="flex-1 text-[15px]">Check-in isn&apos;t open yet. Open it when the doors open.</p><Btn onClick={() => void open('CHECK_IN')}>Open check-in</Btn></div>
      ) : (
        <m.button type="button" whileTap={{ scale: 0.97 }} onClick={() => setScanning(true)} className="flex items-center justify-center gap-3 rounded-[24px] bg-green py-6 text-[20px] font-extrabold text-white shadow-lift"><QrCode size={28} />Open scanner</m.button>
      )}
      {ev.status === 'CHECK_IN' && ev.draft.checkOutRequired ? <button type="button" onClick={() => void open('CHECK_OUT')} className="w-fit text-[14px] font-semibold text-green-text hover:underline">Start check-out (people are leaving)</button> : null}
      <Sheet open={scanning} onClose={() => { setScanning(false); void reloadPeople(); }} title="Scanner" width={520}>
        <div className="flex flex-col gap-4 px-5 pb-6">
          <div role="radiogroup" aria-label="Scan mode" className="flex rounded-full border border-line bg-surface p-1">
            {(['in', 'out'] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} disabled={v === 'out' && ev.status !== 'CHECK_OUT'} className={`relative h-10 flex-1 rounded-full text-[14.5px] font-bold disabled:opacity-40 ${mode === v ? 'text-paper' : 'text-muted'}`}>
                {mode === v ? <m.span layoutId="scan-mode" className="absolute inset-0 rounded-full bg-ink" transition={spring.snap} /> : null}<span className="relative">{v === 'in' ? 'Check-in' : 'Check-out'}</span>
              </button>
            ))}
          </div>
          {scanning ? <Scanner eventId={ev.id} mode={mode} onScanned={() => void refresh()} /> : null}
          <p className="text-[13px] text-muted">{counts ? `${counts.checkedIn} in · ${counts.checkedOut} out · ${counts.pendingArrivals} not yet arrived` : ''}</p>
        </div>
      </Sheet>
    </section>
  );
}

/* ── After ───────────────────────────────────────────────────────── */
function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <m.span animate={{ scale: done ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.35 }} className={`grid size-9 shrink-0 place-items-center rounded-full font-extrabold ${done ? 'bg-green text-white' : 'bg-mist text-muted'}`}>
        <AnimatePresence mode="wait" initial={false}>{done ? <m.span key="d" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={spring.bouncy}><Check size={18} strokeWidth={3} /></m.span> : <m.span key="n">{n}</m.span>}</AnimatePresence>
      </m.span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pb-6"><b className={`text-[17px] ${done ? 'text-muted' : ''}`}>{title}</b>{children}</div>
    </li>
  );
}

function After({ ev, people, reload, reloadPeople }: { ev: Loaded; people: AttendanceRecord[] | null; reload: () => Promise<unknown>; reloadPeople: () => Promise<void> }) {
  const toast = useToast();
  const [fixing, setFixing] = useState<AttendanceRecord | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [party, setParty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Ratings | null>(null);
  const [audit, setAudit] = useState<AttendanceCorrection[]>([]);
  const finalized = Boolean(ev.finalizedAt);
  const list = people ?? [];
  const incomplete = list.filter((p) => p.checkInAt && !p.checkOutAt && ['CHECKED_IN', 'PARTIAL_ATTENDANCE'].includes(p.status));
  const complete = list.filter((p) => p.checkInAt && (p.checkOutAt || !ev.draft.checkOutRequired) && !['PARTIAL_ATTENDANCE'].includes(p.status) && p.status !== 'CHECKED_IN').length;
  const noShows = list.filter((p) => !p.checkInAt && ['CONFIRMED', 'NO_SHOW', 'WAITLISTED'].includes(p.status)).length;
  const eligible = list.filter((p) => p.certificateEligible).length;
  const alreadyIssued = list.filter((p) => p.certificateIssued).length;
  useEffect(() => { eventRatings(ev.id).then(setRatings).catch(() => undefined); corrections(ev.id).then(setAudit).catch(() => undefined); }, [ev.id]);

  async function doFinalize() {
    setBusy(true);
    try { await finalize(ev.id); setConfirm(false); await reload(); await reloadPeople(); setParty(true); }
    catch (e) { toast(e instanceof Error ? e.message : 'Unable to finalize'); } finally { setBusy(false); }
  }
  async function issue() {
    setBusy(true);
    try { const r = await issueCertificates(ev.id); setIssued(r.totalCertificates); toast(`${r.issued} certificate${r.issued === 1 ? '' : 's'} issued`); await reloadPeople(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Unable to issue'); } finally { setBusy(false); }
  }
  return (
    <section className="rounded-[22px] border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-5 text-[20px] font-extrabold">After the event</h2>
      <ol>
        <Step n={1} done={incomplete.length === 0} title="Review incomplete attendance">
          {incomplete.length ? (
            <>
              <p className="text-[14.5px] text-muted">{incomplete.length} {incomplete.length === 1 ? 'person' : 'people'} checked in but {incomplete.length === 1 ? 'was' : 'were'}n&apos;t scanned out. If you know when they left, correct it; every change is recorded with your reason.</p>
              <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
                {incomplete.map((p) => <li key={p.id} className="flex items-center gap-3 px-3 py-2.5"><Avatar name={p.name} size={32} /><span className="min-w-0 flex-1"><b className="block truncate text-[14.5px]">{p.name}</b><small className="text-muted">In {time(p.checkInAt)} · no check-out</small></span><Btn size="sm" kind="secondary" onClick={() => setFixing(p)}>Correct</Btn></li>)}
              </ul>
            </>
          ) : <p className="text-[14.5px] text-muted">Everyone who checked in was checked out.</p>}
          {audit.length ? <details className="text-[13px] text-muted"><summary className="cursor-pointer font-semibold">Corrections log ({audit.length})</summary><ul className="mt-2 flex flex-col gap-1">{audit.map((a) => <li key={a.id}>{fmtWhen(a.at)}: {a.kind === 'MANUAL' ? `check-out set to ${time(a.after)}` : 'attendance report applied'} · {a.previousStatus} → {a.status}{a.reason ? ` · “${a.reason}”` : ''}</li>)}</ul></details> : null}
        </Step>
        <Step n={2} done={finalized} title="Finalize attendance">
          {finalized ? <p className="text-[14.5px] text-muted">Finalized {fmtDate(ev.finalizedAt)}. Stamps are on attendees&apos; passports.</p> : (
            <>
              <p className="text-[14.5px] text-muted">Attendance only counts once you finalize it. Stamps appear on passports, and certificate eligibility is locked in.</p>
              {ev.finalizesAt ? <p className="text-[14px] font-semibold">If you don&apos;t, it&apos;s finalized automatically on {fmtWhen(ev.finalizesAt, ev.draft.timezone)}.</p> : null}
              <Btn className="self-start" onClick={() => setConfirm(true)}>Review and finalize</Btn>
            </>
          )}
        </Step>
        {ev.draft.certificateEnabled ? (
          <Step n={3} done={finalized && eligible > 0 && (issued ?? alreadyIssued) >= eligible} title="Issue certificates">
            <p className="text-[14.5px]"><b className="tabular-nums">{eligible}</b> eligible · <b className="tabular-nums"><CountUp to={issued ?? alreadyIssued} /></b> issued</p>
            {finalized && eligible > (issued ?? alreadyIssued) ? <Btn className="self-start" kind="gold" onClick={() => void issue()} disabled={busy}>Issue {eligible - (issued ?? alreadyIssued)} certificate{eligible - (issued ?? alreadyIssued) === 1 ? '' : 's'}</Btn>
              : !finalized ? <p className="text-[13px] text-muted">Finalize attendance first.</p> : null}
          </Step>
        ) : null}
        <Step n={ev.draft.certificateEnabled ? 4 : 3} done={Boolean(ratings?.count)} title="View ratings">
          {ratings?.count ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-[15px]"><Star size={18} className="fill-gold text-gold" /><b>{ratings.average.toFixed(1)}</b><span className="text-muted">from {ratings.count} rating{ratings.count === 1 ? '' : 's'}</span></p>
              {ratings.comments.filter((c) => c.comment).slice(0, 5).map((c, i) => <blockquote key={i} className="rounded-xl bg-mist px-3 py-2 text-[14px]">“{c.comment}” <span className="text-muted">· {c.rating}★</span></blockquote>)}
            </div>
          ) : <p className="text-[14.5px] text-muted">Attendees are asked how it went after the event. Ratings show up here.</p>}
        </Step>
      </ol>

      <CorrectSheet ev={ev} person={fixing} onClose={() => setFixing(null)} onDone={async () => { setFixing(null); await reloadPeople(); setAudit(await corrections(ev.id).catch(() => [])); }} />
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Finalize attendance">
        <div className="flex flex-col gap-4 px-5 pb-6">
          <div className="grid grid-cols-3 gap-2 text-center">
            {([['Complete', complete], ['Incomplete', incomplete.length], ['No-shows', noShows]] as const).map(([k, v]) => <div key={k} className="rounded-2xl bg-mist p-3"><b className="block font-display text-[26px]">{v}</b><small className="text-muted">{k}</small></div>)}
          </div>
          <p className="text-[14.5px]">Complete attendees get their stamp{ev.draft.certificateEnabled ? ' and become eligible for a certificate' : ''}. Incomplete and no-show records are kept but don&apos;t count. {incomplete.length ? 'Correct missing check-outs first if you know when people left.' : ''}</p>
          <Btn wide size="lg" onClick={() => void doFinalize()} disabled={busy}>{busy ? 'Finalizing…' : 'Finalize attendance'}</Btn>
        </div>
      </Sheet>
            <Celebration open={party} onClose={() => setParty(false)} seal={<Stamp label={ev.draft.title.slice(0, 26)} center={<SealText>{"FINAL"}</SealText>} size={190} tilt={-8} />}
        title="Attendance finalized" body={<>Stamps are on attendees&apos; passports. {ev.draft.certificateEnabled ? 'Next: issue certificates.' : ''}</>} action={<Btn kind="gold" size="lg" onClick={() => setParty(false)}>Done</Btn>} />
    </section>
  );
}

function CorrectSheet({ ev, person, onClose, onDone }: { ev: Loaded; person: AttendanceRecord | null; onClose: () => void; onDone: () => Promise<void> }) {
  const toast = useToast();
  // Default: the end time, rounded up to the minute (the input has no seconds; rounding down would land before the end).
  const endLocal = new Date(Math.ceil(new Date(ev.draft.endDate).getTime() / 60000) * 60000 + 3600_000).toISOString().slice(0, 16);
  const [at, setAt] = useState(endLocal);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (person) { setAt(endLocal); setReason(''); } }, [person, endLocal]);
  const field = 'w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15.5px] outline-none focus:border-green-text';
  async function save() {
    if (!person) return;
    setBusy(true);
    try { const r = await correctCheckOut(ev.id, person.id, new Date(`${at}:00+01:00`).toISOString(), reason.trim()); toast(r.completed ? `${person.name}: complete` : `${person.name}: saved, still incomplete (left before the end)`); await onDone(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Unable to save'); } finally { setBusy(false); }
  }
  return (
    <Sheet open={Boolean(person)} onClose={onClose} title="Correct check-out">
      <div className="flex flex-col gap-4 px-5 pb-6">
        <p className="text-[15px]"><b>{person?.name}</b> checked in at {time(person?.checkInAt ?? null)}. When did they leave?</p>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Left at (Lagos time)<Req /></span><input type="datetime-local" className={field} value={at} onChange={(e) => setAt(e.target.value)} /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Reason<Req /></span><textarea className={`${field} min-h-[90px]`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The scanner phone died; they left with everyone at the end." /></label>
        <p className="text-[12.5px] text-muted">Saved with the original record, your name, the reason and the time. Leaving before the end still counts as incomplete.</p>
        <Btn wide size="lg" onClick={() => void save()} disabled={busy || reason.trim().length < 10}>{busy ? 'Saving…' : 'Save correction'}</Btn>
      </div>
    </Sheet>
  );
}

/* ── External: attendance report ─────────────────────────────────── */
function ExternalAfter({ ev, reload, reloadPeople }: { ev: Loaded; reload: () => Promise<unknown>; reloadPeople: () => Promise<void> }) {
  const toast = useToast();
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [busy, setBusy] = useState(false);
  async function pick(f: File | null) {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast('That file is over 2 MB'); return; }
    setBusy(true);
    try { setReport(await previewReport(ev.id, f.name, await f.text())); } catch (e) { toast(e instanceof Error ? e.message : 'Could not read that report'); } finally { setBusy(false); }
  }
  async function apply() {
    if (!report) return;
    setBusy(true);
    try { const r = await applyReport(ev.id, report.reportId); toast(`${r.applied} matched attendees recorded`); setReport(null); await reloadPeople(); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Unable to apply'); } finally { setBusy(false); }
  }
  return (
    <section className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-[20px] font-extrabold">Attendance report (pilot)</h2>
      <p className="text-[14.5px] text-muted">Upload the attendance export from {ev.draft.partnerRegistrationLabel || 'the partner site'} (CSV with an email column). Only rows whose email matches a student&apos;s <b>verified</b> email are counted. Nobody is guessed; everything else stays unresolved.</p>
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-2xl border border-line px-4 py-2.5 font-semibold hover:bg-mist"><FileUp size={18} className="text-green-text" />{busy ? 'Reading…' : 'Upload CSV'}<input type="file" accept=".csv,.tsv,text/csv" className="sr-only" onChange={(e) => void pick(e.target.files?.[0] ?? null)} /></label>
      {report ? (
        <div className="flex flex-col gap-3">
          <p className="text-[15px]"><b className="text-green-text">{report.matched} matched</b> · <b>{report.needsReview} unresolved</b> · {report.filename}</p>
          <ul className="max-h-[320px] divide-y divide-line overflow-auto rounded-2xl border border-line text-[14px]">
            {report.rows.map((r, i) => <li key={i} className="flex items-center gap-3 px-3 py-2">{r.matched ? <Check size={16} className="text-green-text" /> : <X size={16} className="text-muted" />}<span className="min-w-0 flex-1 truncate">{r.email}</span>{r.reason ? <small className="text-muted">{r.reason}</small> : <small className="text-green-text">will be recorded</small>}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2"><Btn onClick={() => void apply()} disabled={busy || !report.matched}>Apply {report.matched} match{report.matched === 1 ? '' : 'es'}</Btn><Btn kind="secondary" onClick={() => setReport(null)}>Leave it for now</Btn></div>
        </div>
      ) : null}
      {!ev.finalizedAt ? <FinalizeExternal ev={ev} reload={reload} /> : <p className="text-[14.5px] text-muted">Attendance finalized.</p>}
    </section>
  );
}
function FinalizeExternal({ ev, reload }: { ev: Loaded; reload: () => Promise<unknown> }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try { await finalize(ev.id); setConfirm(false); toast('Attendance finalized'); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Unable to finalize'); } finally { setBusy(false); }
  }
  return (
    <>
      <Btn kind="secondary" className="self-start" onClick={() => setConfirm(true)}>Finalize attendance</Btn>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Finalize attendance">
        <div className="flex flex-col gap-4 px-5 pb-6">
          <p className="text-[14.5px]">This locks attendance for this event. Only people matched from the reports you applied are counted, and <b>it can&apos;t be undone</b>. Apply any remaining report first.</p>
          <Btn wide size="lg" onClick={() => void go()} disabled={busy}>{busy ? 'Finalizing…' : 'Finalize attendance'}</Btn>
          <Btn wide kind="secondary" onClick={() => setConfirm(false)} disabled={busy}>Not yet</Btn>
        </div>
      </Sheet>
    </>
  );
}

/* ── Students' attendance reports ────────────────────────────────── */
function StudentReports({ ev }: { ev: Loaded }) {
  const toast = useToast();
  const [list, setList] = useState<IssueReport[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const load = useCallback(() => issueReports(ev.id).then(setList).catch(() => undefined), [ev.id]);
  useEffect(() => { void load(); }, [load]);
  if (!list.length) return null;
  const open = list.filter((i) => i.status === 'SENT').length;
  return (
    <section className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5">
      <h2 className="text-[18px] font-extrabold">Reports from students {open ? <span className="ml-1 rounded-full bg-coral px-2 py-0.5 text-[12px] text-[#111714]">{open} new</span> : null}</h2>
      <p className="text-[14px] text-muted">If a report is right, fix the record above (Correct), then reply. Students see your reply on their passport.</p>
      <ul className="flex flex-col gap-3">{list.map((i) => (
        <li key={i.id} className="flex flex-col gap-2 rounded-2xl bg-mist p-3 text-[14.5px]">
          <span className="flex items-center justify-between gap-2"><b>{i.studentName}</b><span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${i.status === 'SENT' ? 'bg-coral text-[#111714]' : 'bg-tint text-green-text'}`}>{i.status === 'SENT' ? 'Sent' : 'Reviewed'}</span></span>
          <span>“{i.message}”</span>
          {i.status === 'REVIEWED' ? <span className="text-muted"><b>Your reply:</b> {i.response}</span> : (
            <div className="flex gap-2">
              <input value={replies[i.id] ?? ''} onChange={(e) => setReplies((r) => ({ ...r, [i.id]: e.target.value }))} placeholder="Reply, e.g. Fixed: we corrected your check-out" aria-label={`Reply to ${i.studentName}`} className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-green-text" />
              <Btn size="sm" disabled={(replies[i.id] ?? '').trim().length < 5} onClick={() => void reviewIssue(ev.id, i.id, (replies[i.id] ?? '').trim()).then(() => { toast('Marked reviewed'); return load(); }).catch((e: Error) => toast(e.message))}>Mark reviewed</Btn>
            </div>
          )}
        </li>
      ))}</ul>
    </section>
  );
}

/* ── Helpers (Event Helper access for this event) ───────────────── */
function Helpers({ ev }: { ev: Loaded }) {
  const toast = useToast();
  const [list, setList] = useState<Helper[]>([]);
  const [pool, setPool] = useState<{ userId: string; name: string }[]>([]);
  const load = useCallback(() => helpers(ev.id).then(setList).catch(() => undefined), [ev.id]);
  useEffect(() => { void load(); if (ev.community) members(ev.community.id, { role: 'VOLUNTEER' }).then((r) => setPool(r.people.map((p) => ({ userId: p.id, name: p.name })))).catch(() => undefined); }, [load, ev.community]);
  const free = pool.filter((p) => !list.some((h) => h.userId === p.userId));
  return (
    <section className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5">
      <h2 className="text-[18px] font-extrabold">Event Helpers</h2>
      <p className="text-[14px] text-muted">Helpers can scan passes for this event only. They can&apos;t edit it, finalize attendance or manage the community.</p>
      <div className="flex flex-wrap gap-2">
        {list.map((h) => <span key={h.id} className="inline-flex items-center gap-2 rounded-full bg-tint py-1 pr-1.5 pl-1 text-[14px] font-semibold"><Avatar name={h.name} size={26} ring={false} />{h.name}<button type="button" aria-label={`Remove ${h.name}`} onClick={() => void removeHelper(ev.id, h.id).then(load).catch((e: Error) => toast(e.message))} className="grid size-6 place-items-center rounded-full hover:bg-surface"><X size={14} /></button></span>)}
        {!list.length ? <span className="text-[14px] text-muted">No helpers yet.</span> : null}
      </div>
      {free.length ? (
        <div className="flex flex-wrap items-center gap-2"><UserPlus size={16} className="text-muted" />
          {free.map((p) => <button key={p.userId} type="button" onClick={() => void addHelper(ev.id, p.userId).then(() => { toast(`${p.name} can scan this event`); return load(); }).catch((e: Error) => toast(e.message))} className="rounded-full border border-line px-3 py-1 text-[13.5px] font-semibold hover:bg-mist">+ {p.name}</button>)}
        </div>
      ) : <p className="text-[13px] text-muted">{pool.length ? 'All your Helpers are on this event.' : 'Give someone the Helper role in your community’s Members tab first.'}</p>}
    </section>
  );
}

/* ── Attendee list ───────────────────────────────────────────────── */
const FILTERS: { v: string; label: string; match: (s: AttendeeStatus) => boolean }[] = [
  { v: '', label: 'Everyone', match: (s) => !['CANCELLED', 'REJECTED'].includes(s) },
  { v: 'REG', label: 'Registered', match: (s) => ['CONFIRMED', 'WAITLISTED', 'PENDING_APPROVAL'].includes(s) },
  { v: 'IN', label: 'Checked in', match: (s) => s === 'CHECKED_IN' },
  { v: 'OUT', label: 'Checked out', match: (s) => s === 'CHECKED_OUT' },
  { v: 'INC', label: 'Incomplete', match: (s) => s === 'PARTIAL_ATTENDANCE' },
  { v: 'FIN', label: 'Finalized', match: (s) => s === 'COMPLETED' },
];
function Attendees({ ev, people, refresh }: { ev: Loaded; people: AttendanceRecord[] | null; refresh: () => Promise<void> }) {
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [q, setQ] = useState('');
  const [f, setF] = useState('');
  const match = FILTERS.find((x) => x.v === f)!.match;
  const shown = useMemo(() => (people ?? []).filter((p) => match(p.status) && (!q.trim() || `${p.name} ${p.email} ${p.code}`.toLowerCase().includes(q.trim().toLowerCase()))), [people, q, match]);
  return (
    <section id="attendees" className="scroll-mt-24 flex flex-col gap-3" aria-labelledby="att-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="att-h" className="text-[20px] font-extrabold">Attendees <span className="text-muted tabular-nums">{(people ?? []).filter((p) => FILTERS[0].match(p.status)).length}</span></h2>
        {people !== null ? <AttendeeTools people={people} filteredPeople={shown} questions={ev.draft.registrationQuestions} slug={ev.slug} external={ev.draft.attendanceSource === 'EXTERNAL'} onRefresh={refresh} /> : null}
      </div>
      <label className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-green-text sm:max-w-sm"><Search size={17} className="text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or code" aria-label="Search attendees" className="w-full bg-transparent text-[15px] outline-none" /></label>
      <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">{FILTERS.map((x) => <Chip key={x.v} on={f === x.v} onClick={() => setF(x.v)}>{x.label}</Chip>)}</div>
      {people === null ? <SkeletonCard /> : (
        <ul className="flex flex-col divide-y divide-line rounded-[22px] border border-line bg-surface">
          {shown.slice(0, 200).map((p) => {
            const progress = submissionProgress(p, ev.draft.registrationQuestions);
            const [chip, cls] = STATUS_CHIP[p.status] ?? [p.status, 'bg-mist text-muted'];
            return (
              <li key={p.id}><button type="button" onClick={() => setSelected(p)} aria-label={`View details for ${p.name}`} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-mist focus-visible:outline-green-text">
                <Avatar name={p.name} size={38} />
                <span className="min-w-0 flex-1"><b className="block truncate">{p.name}</b><small className="block truncate text-[12.5px] text-muted">{p.code ? <span className="font-mono">{p.code}</span> : null}{p.department ? ` · ${p.department}` : ''}{p.checkInAt ? ` · in ${time(p.checkInAt)}` : ''}{p.checkOutAt ? ` · out ${time(p.checkOutAt)}` : ''}</small>{progress.total ? <small className="mt-1 block text-[12px] text-muted">{progress.answered}/{progress.total} current questions answered{progress.earlier ? ` · ${progress.earlier} earlier answer${progress.earlier === 1 ? '' : 's'}` : ''}</small> : null}</span>
                <m.span layout key={p.status} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.snap} className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${cls}`}>{chip}</m.span>
              </button></li>
            );
          })}
          {!shown.length ? <li className="px-4 py-8 text-center text-muted">{people.length ? 'Nobody matches.' : 'No registrations yet.'}</li> : null}
        </ul>
      )}
      <p className="text-[13px] text-muted">Select an attendee to see their contact details, registration answers and attendance record.</p>
      <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title="Attendee details">
        {selected ? <div className="flex flex-col gap-5 px-5 pb-6">
          <div><Avatar name={selected.name} size={48} /><h3 className="mt-3 break-words text-[22px] font-extrabold">{selected.name}</h3><p className="mt-1 text-[13px] text-muted">Information shared for this event. Only event managers can access this panel.</p></div>
          <dl className="flex flex-col gap-3 text-[14px]">{[
            ['Email', selected.email || 'Not available'], ['School', selected.school || 'Not provided'], ['Department', selected.department || 'Not provided'], ['Faculty', selected.faculty || 'Not provided'],
            ['Status', STATUS_CHIP[selected.status]?.[0] ?? selected.status], ['Registered', selected.registeredAt ? fmtWhen(selected.registeredAt) : 'Not available'],
            ['Pass code', selected.code || 'Not issued'], ['Checked in', selected.checkInAt ? fmtWhen(selected.checkInAt) : 'Not checked in'],
            ['Checked out', selected.checkOutAt ? fmtWhen(selected.checkOutAt) : 'Not checked out'], ['Attendance time', selected.minutes ? selected.minutes + ' minutes' : 'Not recorded'],
            ['Certificate', selected.certificateIssued ? 'Issued' : selected.certificateEligible ? 'Eligible' : 'Not issued'],
          ].map(([label, value]) => <div key={label} className="border-b border-line pb-2"><dt className="text-muted">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl>
          <div className="rounded-xl bg-mist p-3 text-[13px]"><b>Submission summary</b><p className="mt-1">{submissionProgress(selected, ev.draft.registrationQuestions).answered} of {ev.draft.registrationQuestions.length} current questions answered · {selected.answers.filter((a) => a.value.trim()).length} total saved answers</p>{submissionProgress(selected, ev.draft.registrationQuestions).missingRequired ? <p className="mt-2 text-muted">{submissionProgress(selected, ev.draft.registrationQuestions).missingRequired} current required answer(s) not recorded. These questions may have been added after this person registered; their registration status stays the same.</p> : null}</div>
          <div><h4 className="font-bold">Registration answers</h4>{selected.answers.length ? <dl className="mt-3 flex flex-col gap-3">{selected.answers.map((a) => <div key={a.key}><dt className="text-[14px] text-muted">{a.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-[15px]">{a.value}</dd></div>)}</dl> : <p className="mt-2 text-[14px] text-muted">No extra answers were submitted with this registration.</p>}</div>
        </div> : null}
      </Sheet>
      {shown.length > 200 ? <p className="text-[13px] text-muted">Showing the first 200. Search or download the CSV for everyone.</p> : null}
    </section>
  );
}
