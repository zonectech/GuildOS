'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import { Award, ChevronLeft, ChevronRight, Flame, Flag, Lock, MapPin, Sparkles } from 'lucide-react';
import type { Stamp as StampT } from '@/lib/api/types';
import { BADGES, regulars, reportIssue, streak, type AttendanceIssue, type MyCertificate, type MyRegistration, type Profile } from '@/lib/api/profile';
import type { MyMembership } from '@/lib/api/communities';
import { dateTile } from '@/lib/events';
import { spring } from '@/lib/motion';
import { Stamp } from '@/components/brand/stamp';
import { CommunityLogo } from '@/components/communities/bits';
import { Avatar } from '@/components/ui/avatar';
import { Btn, Odometer } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';

const PER_PAGE = 6;
/** A stable "random" tilt per stamp, so stamps look hand-pressed but don't jump between renders. */
const tiltOf = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return ((Math.abs(h) % 23) - 11); };
const fmt = (iso: string | null, o: Intl.DateTimeFormatOptions) => (iso ? new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', ...o }) : '');

export interface PassportData {
  profile: Profile;
  stamps: StampT[] | null;
  certificates: MyCertificate[] | null;
  communities: MyMembership[] | null;
  /** Owner only: check-in times per event, and attendance reports. */
  registrations?: MyRegistration[];
  issues?: AttendanceIssue[];
}

/**
 * The passport: who you are, your stamps on pages you turn, badges, streak and certificates.
 * `mode` decides what shows: the owner's own view, or the public view (privacy rules applied).
 */
export function Passport({ data, mode, onIssueSent }: { data: PassportData; mode: 'owner' | 'public'; onIssueSent?: (stamp: StampT, message: string) => void }) {
  const { profile: p, stamps, certificates, communities } = data;
  const owner = mode === 'owner';
  const showHistory = owner || p.showHistory;
  const showCerts = owner || p.showCertificates;
  const attended = (stamps ?? []).filter((s) => s.role === 'ATTENDED');
  const st = streak(stamps ?? []);
  const regular = regulars(stamps ?? []);
  const [open, setOpen] = useState<StampT | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-[28px] border border-line bg-surface shadow-card">
        <div className="h-28 bg-[radial-gradient(120%_140%_at_0%_0%,var(--tint),transparent_60%),linear-gradient(135deg,var(--mist),var(--surface))] sm:h-36" />
        <div className="-mt-14 flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div className="flex items-end gap-4">
            <span className="rounded-full bg-surface p-1.5 shadow-lift"><Avatar name={p.fullName} src={p.avatar} size={104} /></span>
            <div className="min-w-0 pb-1">
              <h1 className="text-[28px] font-extrabold sm:text-[34px]">{p.fullName}</h1>
              <p className="text-[14.5px] text-muted">{[p.username ? `@${p.username}` : '', owner || p.showSchool ? p.school : '', p.department, p.level ? `${p.level} level` : ''].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          {showHistory ? (
            <div className="flex items-center gap-3 rounded-2xl bg-tint px-4 py-2.5">
              <span className="grid size-12 -rotate-12 place-items-center rounded-full border-2 border-green-text font-display text-[20px] font-extrabold text-green-text"><Odometer value={attended.length} /></span>
              <span><b className="block text-[15px]">stamps</b><small className="text-[12.5px] text-muted">{st.thisMonth ? <>{st.thisMonth} event{st.thisMonth === 1 ? '' : 's'} this month <Flame size={13} className="inline text-coral-text" /></> : 'Collect one this month'}</small></span>
            </div>
          ) : null}
        </div>
        {p.bio ? <p className="px-5 pb-5 text-[15.5px] sm:px-7">{p.bio}</p> : null}
        {p.interests.length ? <div className="flex flex-wrap gap-1.5 px-5 pb-5 sm:px-7">{p.interests.map((i) => <span key={i} className="rounded-full bg-mist px-3 py-1 text-[13px] font-semibold">{i}</span>)}</div> : null}
      </header>

      {showHistory ? (
        <>
          <Badges count={attended.length} regular={regular} monthsInARow={st.monthsInARow} />
          <section aria-labelledby="passport-h" className="flex flex-col gap-3">
            <h2 id="passport-h" className="text-[22px] font-extrabold">Passport</h2>
            {stamps === null ? <div className="shimmer h-[340px] rounded-[28px]" /> : stamps.length ? <Pages stamps={stamps} onOpen={setOpen} /> : <Sleepy owner={owner} />}
          </section>
        </>
      ) : <p className="flex items-center gap-2 rounded-2xl bg-mist p-4 text-[14.5px]"><Lock size={16} />{p.fullName.split(' ')[0]} keeps their event history private.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {showCerts ? (
          <section aria-labelledby="cert-h" className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-5">
            <h2 id="cert-h" className="flex items-center gap-2 text-[20px] font-extrabold"><Award size={19} className="text-[var(--stamp-gold)]" />Certificates</h2>
            {certificates === null ? <div className="shimmer h-20 rounded-xl" /> : certificates.length ? (
              <ul className="flex flex-col divide-y divide-line">{certificates.map((c) => (
                <li key={c.serial}><a href={c.verificationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 py-2.5 hover:text-green-text"><span className="min-w-0"><b className="block truncate text-[15px]">{c.eventTitle}</b><small className="text-[12.5px] text-muted">{c.communityName} · {fmt(c.issuedAt, { day: 'numeric', month: 'short', year: 'numeric' })}</small></span><ChevronRight size={16} className="shrink-0 text-muted" /></a></li>
              ))}</ul>
            ) : <p className="text-[14.5px] text-muted">No certificates yet. They come from events that offer one, once attendance is finalized.</p>}
          </section>
        ) : null}
        <section aria-labelledby="com-h" className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-5">
          <h2 id="com-h" className="text-[20px] font-extrabold">Communities</h2>
          {communities === null ? <div className="shimmer h-20 rounded-xl" /> : communities.length ? (
            <div className="flex flex-wrap gap-2">{communities.map((c) => <Link key={c.communityId} href={`/communities/${c.slug}`} className="flex items-center gap-2 rounded-full border border-line py-1 pr-3.5 pl-1 text-[14px] font-semibold hover:bg-mist"><CommunityLogo c={c} size={28} />{c.name}</Link>)}</div>
          ) : <p className="text-[14.5px] text-muted">{owner ? <>Not in any yet. <Link href="/communities" className="font-semibold text-green-text hover:underline">Find a community</Link></> : 'No communities to show.'}</p>}
        </section>
      </div>

      {owner && showHistory && attended.length ? <Recap stamps={attended} /> : null}
      {owner && data.issues?.length ? <Issues issues={data.issues} /> : null}

      <StampRecord stamp={open} onClose={() => setOpen(null)} owner={owner} registration={open ? data.registrations?.find((r) => r.event.id === open.eventId) : undefined}
        reported={Boolean(open && data.issues?.some((i) => i.event?.slug === open.eventSlug && i.status === 'SENT'))} onIssueSent={onIssueSent} />
    </div>
  );
}

function Badges({ count, regular, monthsInARow }: { count: number; regular: { name: string; slug: string; count: number }[]; monthsInARow: number }) {
  return (
    <section aria-label="Badges" className="no-bar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {BADGES.map((b, i) => {
        const got = count >= b.need;
        return (
          <m.div key={b.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ...spring.soft, delay: i * 0.05 }} className="flex w-[92px] shrink-0 flex-col items-center gap-1 text-center">
            <Stamp label={b.label} ink={b.ink} state={got ? 'stamped' : 'locked'} size={80} tilt={got ? -8 : 0} center={<text x="100" y="116" textAnchor="middle" fontSize="44" fontWeight="800">{b.need}</text>} />
            <small className={`text-[12px] font-semibold ${got ? '' : 'text-muted'}`}>{got ? b.label : `${b.need - count} to go`}</small>
          </m.div>
        );
      })}
      {regular.map((r) => (
        <div key={r.slug} className="flex w-[92px] shrink-0 flex-col items-center gap-1 text-center">
          <Stamp label={`Regular · ${r.name}`} ink="ink" size={80} tilt={-6} center={<text x="100" y="114" textAnchor="middle" fontSize="30" fontWeight="800">REG</text>} />
          <small className="line-clamp-2 text-[12px] font-semibold">Regular at {r.name}</small>
        </div>
      ))}
      {monthsInARow >= 2 ? (
        <div className="flex w-[92px] shrink-0 flex-col items-center justify-center gap-1 text-center"><span className="grid size-[80px] place-items-center rounded-full bg-[color-mix(in_srgb,var(--coral)_20%,var(--surface))]"><Flame size={34} className="text-coral-text" /></span><small className="text-[12px] font-semibold">{monthsInARow} months in a row</small></div>
      ) : null}
    </section>
  );
}

/** Stamps on pages, turned like a passport: drag or use the arrows. 3D flip, or a slide with reduced motion. */
function Pages({ stamps, onOpen }: { stamps: StampT[]; onOpen: (s: StampT) => void }) {
  const reduce = useReducedMotion();
  const pages = useMemo(() => Array.from({ length: Math.ceil(stamps.length / PER_PAGE) }, (_, i) => stamps.slice(i * PER_PAGE, (i + 1) * PER_PAGE)), [stamps]);
  const [[page, dir], set] = useState<[number, number]>([0, 1]);
  const go = (d: number) => { const n = page + d; if (n >= 0 && n < pages.length) set([n, d]); };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full [perspective:1400px]">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <m.div key={page} custom={dir}
            variants={reduce
              ? { enter: (d: number) => ({ x: d * 60, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: d * -60, opacity: 0 }) }
              : { enter: (d: number) => ({ rotateY: d * 75, opacity: 0, transformOrigin: d > 0 ? 'left center' : 'right center' }), center: { rotateY: 0, opacity: 1 }, exit: (d: number) => ({ rotateY: d * -75, opacity: 0, transformOrigin: d > 0 ? 'left center' : 'right center' }) }}
            initial="enter" animate="center" exit="exit" transition={{ type: 'spring', stiffness: 160, damping: 22 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25} onDragEnd={(_, i) => { if (i.offset.x < -60) go(1); else if (i.offset.x > 60) go(-1); }}
            className="grid min-h-[300px] cursor-grab touch-pan-y grid-cols-2 gap-x-3 gap-y-5 rounded-[28px] border border-line bg-[repeating-linear-gradient(0deg,transparent_0,transparent_31px,color-mix(in_srgb,var(--line)_55%,transparent)_32px),var(--surface)] p-5 shadow-card active:cursor-grabbing sm:grid-cols-3 sm:p-7">
            {pages[page]?.map((s, i) => (
              <m.button key={s.eventId + s.role} type="button" onClick={() => onOpen(s)} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.bouncy, delay: 0.08 + i * 0.05 }}
                className="flex flex-col items-center gap-1.5 rounded-2xl p-1 text-center hover:bg-mist/60" aria-label={`${s.eventTitle}, ${s.role === 'ATTENDED' ? 'attended' : 'hosted'}`}>
                <Stamp label={s.communityName || s.eventTitle} date={dateTile(s.date)} ink={s.role === 'ATTENDED' ? 'green' : 'gold'} size={104} tilt={tiltOf(s.eventId)} />
                <small className="line-clamp-2 text-[12.5px] font-semibold">{s.eventTitle}</small>
              </m.button>
            ))}
          </m.div>
        </AnimatePresence>
      </div>
      {pages.length > 1 ? (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => go(-1)} disabled={page === 0} aria-label="Previous page" className="grid size-10 place-items-center rounded-full border border-line disabled:opacity-30"><ChevronLeft size={18} /></button>
          <span className="text-[13.5px] font-semibold text-muted tabular-nums">Page {page + 1} of {pages.length}</span>
          <button type="button" onClick={() => go(1)} disabled={page === pages.length - 1} aria-label="Next page" className="grid size-10 place-items-center rounded-full border border-line disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
      ) : null}
    </div>
  );
}

/** The sleepy stamp: an empty passport. */
function Sleepy({ owner }: { owner: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-line px-6 py-12 text-center">
      <m.span animate={{ rotate: [-6, 4, -6], y: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} className="relative">
        <Stamp state="empty" size={120} tilt={0} center={<text x="100" y="118" textAnchor="middle" fontSize="40" fontWeight="800">– –</text>} />
        <span aria-hidden className="absolute -top-2 -right-3 font-display text-[22px] font-extrabold text-muted">z<span className="text-[16px]">z</span></span>
      </m.span>
      <b className="text-[18px]">{owner ? 'No stamps yet, go collect one!' : 'No stamps yet.'}</b>
      {owner ? <Btn href="/events">Find an event</Btn> : null}
    </div>
  );
}

/** Tapping a stamp: the event record. Owners can report an attendance issue for past events. */
function StampRecord({ stamp, onClose, owner, registration, reported, onIssueSent }: { stamp: StampT | null; onClose: () => void; owner: boolean; registration?: MyRegistration; reported: boolean; onIssueSent?: (stamp: StampT, message: string) => void }) {
  const toast = useToast();
  const [writing, setWriting] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setWriting(false); setMsg(''); }, [stamp]);
  async function send() {
    if (!stamp) return;
    setBusy(true);
    try { await reportIssue(stamp.eventId, msg.trim()); toast('Sent to the organizers'); setWriting(false); onIssueSent?.(stamp, msg.trim()); }
    catch (e) { toast(e instanceof Error ? e.message : 'Unable to send'); } finally { setBusy(false); }
  }
  return (
    <Sheet open={Boolean(stamp)} onClose={onClose} title="Event record">
      {stamp ? (
        <div className="flex flex-col gap-4 px-5 pb-6">
          <div className="flex items-center gap-4">
            <Stamp label={stamp.communityName || stamp.eventTitle} date={dateTile(stamp.date)} ink={stamp.role === 'ATTENDED' ? 'green' : 'gold'} size={96} tilt={tiltOf(stamp.eventId)} />
            <div className="min-w-0"><b className="block text-[18px]">{stamp.eventTitle}</b><small className="text-muted">{stamp.role === 'ATTENDED' ? 'Attended' : stamp.role === 'HOSTED' ? 'Hosted' : 'Co-hosted'}</small></div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14.5px]">
            <dt className="text-muted">Date</dt><dd>{fmt(stamp.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) || '—'}</dd>
            {stamp.communityName ? <><dt className="text-muted">Community</dt><dd><Link href={`/communities/${stamp.communitySlug}`} className="font-semibold text-green-text hover:underline">{stamp.communityName}</Link></dd></> : null}
            {registration ? <><dt className="text-muted">Checked in</dt><dd>{fmt(registration.checkInAt, { hour: 'numeric', minute: '2-digit' }) || '—'}</dd><dt className="text-muted">Checked out</dt><dd>{fmt(registration.checkOutAt, { hour: 'numeric', minute: '2-digit' }) || '—'}</dd></> : null}
          </dl>
          {stamp.role === 'ATTENDED' ? <p className="rounded-2xl bg-tint px-4 py-3 text-[15px] font-semibold text-green-text">{stamp.attendedWith ? `You attended with ${stamp.attendedWith} other${stamp.attendedWith === 1 ? '' : 's'}` : 'You were there'}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Btn kind="secondary" size="sm" href={`/events/${stamp.eventSlug}`}><MapPin size={15} />Event page</Btn>
            {stamp.certificateSerial ? <Btn kind="secondary" size="sm" href={`/certificates/${stamp.certificateSerial}`}><Award size={15} />Certificate</Btn> : null}
          </div>
          {owner && stamp.role === 'ATTENDED' ? (
            reported ? <p className="text-[13.5px] text-muted">You reported an issue for this event. Status: <b>Sent</b>.</p>
            : writing ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-line p-4">
                <b className="text-[15px]">Report an attendance issue</b>
                <textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={600} className="min-h-[90px] rounded-xl border border-line bg-surface px-3 py-2 text-[15px] outline-none focus:border-green-text" placeholder="e.g. I stayed to the end but wasn't scanned out." aria-label="What happened" />
                <Btn onClick={() => void send()} disabled={busy || msg.trim().length < 10}>{busy ? 'Sending…' : 'Send to the organizers'}</Btn>
              </div>
            ) : <button type="button" onClick={() => setWriting(true)} className="inline-flex w-fit items-center gap-1.5 text-[13.5px] font-semibold text-muted hover:text-ink"><Flag size={14} />Report an attendance issue</button>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

/** Semester recap entry: this semester at a glance. */
function Recap({ stamps }: { stamps: StampT[] }) {
  const now = new Date();
  // Nigerian semesters roughly: Sept–Jan and Feb–Jul.
  const from = now.getMonth() >= 8 ? new Date(now.getFullYear(), 8, 1) : now.getMonth() === 0 ? new Date(now.getFullYear() - 1, 8, 1) : new Date(now.getFullYear(), 1, 1);
  const term = stamps.filter((s) => s.date && new Date(s.date) >= from);
  const top = [...term.reduce((m0, s) => m0.set(s.communityName, (m0.get(s.communityName) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0];
  return (
    <section className="flex flex-wrap items-center gap-5 rounded-[24px] bg-[linear-gradient(120deg,var(--tint),var(--surface))] p-6">
      <Sparkles size={28} className="text-green-text" />
      <div className="min-w-0 flex-1"><b className="block font-display text-[20px]">This semester so far</b>
        <p className="text-[15px] text-muted">{term.length ? <>{term.length} event{term.length === 1 ? '' : 's'} attended{top?.[0] ? <>, most with <b className="text-ink">{top[0]}</b></> : null}.</> : 'Nothing yet this semester.'}</p></div>
    </section>
  );
}

function Issues({ issues }: { issues: AttendanceIssue[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-5">
      <h2 className="text-[18px] font-extrabold">Your attendance reports</h2>
      <ul className="flex flex-col gap-3">{issues.map((i) => (
        <li key={i.id} className="flex flex-col gap-1.5 rounded-2xl bg-mist p-3 text-[14px]">
          <span className="flex items-center justify-between gap-2"><b className="truncate">{i.event?.title ?? 'Event'}</b>
            <span className="flex items-center gap-1 text-[12px] font-bold">{(['SENT', 'REVIEWED'] as const).map((s, k) => <span key={s} className={`rounded-full px-2 py-0.5 ${i.status === s || (k === 0) ? 'bg-green text-white' : 'bg-surface text-muted'}`}>{s === 'SENT' ? 'Sent' : 'Reviewed'}</span>)}</span></span>
          <span className="text-muted">“{i.message}”</span>
          {i.response ? <span><b>Organizers:</b> {i.response}</span> : null}
        </li>
      ))}</ul>
    </section>
  );
}
