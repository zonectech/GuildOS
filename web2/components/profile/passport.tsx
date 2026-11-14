'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import { Award, BadgeCheck, ChevronLeft, ChevronRight, Download, Flag, Flame, Lock, MapPin, Share2, Sparkles } from 'lucide-react';
import type { Stamp as StampT } from '@/lib/api/types';
import { BADGES, coverPatternOf, genderLabel, regulars, reportIssue, streak, type AttendanceIssue, type MyCertificate, type MyRegistration, type Profile } from '@/lib/api/profile';
import type { MyMembership } from '@/lib/api/communities';
import { API_BASE_URL, enc } from '@/lib/api/client';
import { dateTile } from '@/lib/events';
import { fmtDate, fmtTime } from '@/lib/format';
import { spring } from '@/lib/motion';
import { SealText, Stamp } from '@/components/brand/stamp';
import { CommunityLogo } from '@/components/communities/bits';
import { COVER_STYLE } from '@/components/profile/cover';
import { Avatar } from '@/components/ui/avatar';
import { Btn, Odometer } from '@/components/ui/bits';
import { Sheet, useIsDesktop } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';

/** Stamps per passport page (a desktop spread shows two pages). */
const PER_PAGE = 4;
/** A stable "random" tilt between −8° and 8° per stamp: hand-pressed, but never jumping between renders. */
const seed = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const tiltOf = (id: string) => (seed(id) % 17) - 8;
/** Ink takes a little differently each time: 0.8 to 1 opacity, also stable per event. */
const inkOf = (id: string) => 0.8 + ((seed(id + 'ink') % 21) / 100);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const levelLabel = (l: string) => (/^\d+$/.test(l) ? `${l}L` : l);
const sameDay = (a?: string | null, b?: string | null) => Boolean(a && b && fmtDate(a, null, { year: true }) === fmtDate(b, null, { year: true }));

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
 * The passport: who you are, your stamps in a passport book, badges and certificates.
 * `mode` decides what shows: the owner's own view, or the public view (privacy rules applied).
 * Dates: stamps and certificates show the EVENT's date (the same source everywhere).
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
  const details = [p.department, p.level ? levelLabel(p.level) : '', owner || p.showSchool ? p.school : ''].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-[28px] border border-line bg-surface shadow-card">
        <div className={`h-28 sm:h-36 ${coverPatternOf(p.cover) === 'confetti' ? 'cover-confetti' : ''}`} style={COVER_STYLE[coverPatternOf(p.cover)]} aria-hidden />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
          <div className="flex items-start gap-4">
            <span className="-mt-14 shrink-0 rounded-full bg-surface p-1.5 shadow-lift"><Avatar name={p.fullName} src={p.avatar} size={104} /></span>
            <div className="min-w-0 pt-2">
              <h1 className="text-[28px] font-extrabold sm:text-[34px]">{p.fullName}{p.pronouns ? <span className="ml-2 align-middle text-[15px] font-semibold text-muted">({p.pronouns})</span> : null}</h1>
              {details ? <p className="text-[15px] font-semibold">{details}</p> : null}
              <p className="text-[13.5px] text-muted">{[p.username ? `@${p.username}` : '', genderLabel(p.gender)].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          {showHistory ? (
            <div className="flex flex-col items-start gap-2 pt-3 sm:items-end">
              <div className="flex items-center gap-3 rounded-2xl bg-tint px-4 py-2.5">
                <span className="grid size-12 -rotate-12 place-items-center rounded-full border-2 border-green-text font-display text-[20px] font-extrabold text-green-text"><Odometer value={attended.length} /></span>
                <span><b className="block text-[15px]">{attended.length === 1 ? 'stamp' : 'stamps'}</b><small className="block text-[12.5px] text-muted">{communities ? plural(communities.length, 'community', 'communities') + ' joined' : ' '}</small>
                  {st.thisMonth >= 2 ? <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--coral)_16%,var(--surface))] px-2 py-0.5 text-[12px] font-bold"><Flame size={12} className="text-coral-text" />{st.thisMonth} events this month</span>
                    : st.thisMonth === 1 ? <span className="mt-1 inline-block rounded-full bg-surface px-2 py-0.5 text-[12px] font-bold text-green-text">Great start!</span> : null}</span>
              </div>
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
            {stamps === null ? <div className="shimmer h-[360px] rounded-[28px]" /> : stamps.length ? <Book stamps={stamps} onOpen={setOpen} /> : <Sleepy owner={owner} />}
          </section>
        </>
      ) : <p className="flex items-center gap-2 rounded-2xl bg-mist p-4 text-[14.5px]"><Lock size={16} />{p.fullName.split(' ')[0]} keeps their event history private.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {showCerts ? <Certificates list={certificates} /> : null}
        {owner || communities !== null ? (
          <section aria-labelledby="com-h" className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-5">
            <h2 id="com-h" className="text-[20px] font-extrabold">Communities</h2>
            {communities === null ? <div className="shimmer h-20 rounded-xl" /> : communities.length ? (
              <div className="flex flex-wrap gap-2">{communities.map((c) => <Link key={c.communityId} href={`/communities/${c.slug}`} className="flex items-center gap-2 rounded-full border border-line py-1 pr-3.5 pl-1 text-[14px] font-semibold hover:bg-mist"><CommunityLogo c={c} size={28} />{c.name}</Link>)}</div>
            ) : <p className="text-[14.5px] text-muted">{owner ? <>Not in any yet. <Link href="/communities" className="font-semibold text-green-text hover:underline">Find a community</Link></> : 'No communities to show.'}</p>}
          </section>
        ) : null}
      </div>

      {owner && showHistory && attended.length ? <Recap stamps={attended} /> : null}
      {owner && data.issues?.length ? <Issues issues={data.issues} /> : null}

      <StampRecord stamp={open} onClose={() => setOpen(null)} owner={owner} registration={open ? data.registrations?.find((r) => r.event.id === open.eventId) : undefined}
        reported={Boolean(open && data.issues?.some((i) => i.event?.slug === open.eventSlug && i.status === 'SENT'))} onIssueSent={onIssueSent} />
    </div>
  );
}

function Certificates({ list }: { list: MyCertificate[] | null }) {
  const toast = useToast();
  async function share(c: MyCertificate) {
    const url = `${window.location.origin}/certificates/${c.serial}`;
    try { if (navigator.share) await navigator.share({ url, title: c.eventTitle }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { /* dismissed */ }
  }
  return (
    <section aria-labelledby="cert-h" className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-5">
      <h2 id="cert-h" className="flex items-center gap-2 text-[20px] font-extrabold"><Award size={19} className="text-[var(--stamp-gold)]" />Certificates</h2>
      {list === null ? <div className="shimmer h-20 rounded-xl" /> : list.length ? (
        <ul className="flex flex-col divide-y divide-line">{list.map((c) => (
          <li key={c.serial} className="flex items-center gap-3 py-2.5">
            <Link href={`/certificates/${c.serial}`} className="min-w-0 flex-1 hover:text-green-text">
              <b className="flex items-center gap-1.5 text-[15px]"><span className="truncate">{c.eventTitle}</span>{c.status === 'VERIFIED' ? <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-tint px-1.5 py-px text-[11px] font-bold text-green-text"><BadgeCheck size={12} />Verified</span> : null}</b>
              <small className="block text-[12.5px] text-muted">{c.communityName}{c.eventDate ? ` · ${fmtDate(c.eventDate, null, { year: true })}` : ''}</small>
              {c.eventDate && !sameDay(c.eventDate, c.issuedAt) ? <small className="block text-[12px] text-muted">Issued {fmtDate(c.issuedAt, null, { year: true })}</small> : null}
            </Link>
            <button type="button" onClick={() => void share(c)} aria-label={`Share ${c.eventTitle} certificate`} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-mist hover:text-ink"><Share2 size={16} /></button>
            <a href={`${API_BASE_URL}/api/certificates/${enc(c.serial)}/pdf`} aria-label={`Download ${c.eventTitle} certificate`} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-mist hover:text-ink"><Download size={16} /></a>
          </li>
        ))}</ul>
      ) : <p className="text-[14.5px] text-muted">No certificates yet. They come from events that offer one, once attendance is finalized.</p>}
    </section>
  );
}

function Badges({ count, regular, monthsInARow }: { count: number; regular: { name: string; slug: string; count: number }[]; monthsInARow: number }) {
  return (
    <section aria-label="Badges" className="no-bar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {BADGES.map((b, i) => {
        const got = count >= b.need;
        return (
          <m.div key={b.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ...spring.soft, delay: i * 0.05 }} className="flex w-[92px] shrink-0 flex-col items-center gap-1 text-center">
            <Stamp label={b.label} ink={b.ink} state={got ? 'stamped' : 'locked'} size={80} tilt={got ? -8 : 0} center={<SealText>{String(b.need)}</SealText>} />
            <small className={`text-[12px] font-semibold ${got ? '' : 'text-muted'}`}>{got ? b.label : `${b.need - count} to go`}</small>
          </m.div>
        );
      })}
      {regular.map((r) => (
        <div key={r.slug} className="flex w-[92px] shrink-0 flex-col items-center gap-1 text-center">
          <Stamp label={`Regular · ${r.name}`} ink="ink" size={80} tilt={-6} center={<SealText>{"REG"}</SealText>} />
          <small className="line-clamp-2 text-[12px] font-semibold">Regular at {r.name}</small>
        </div>
      ))}
      {monthsInARow >= 2 ? (
        <div className="flex w-[92px] shrink-0 flex-col items-center justify-center gap-1 text-center"><span className="grid size-[80px] place-items-center rounded-full bg-[color-mix(in_srgb,var(--coral)_20%,var(--surface))]"><Flame size={34} className="text-coral-text" /></span><small className="text-[12px] font-semibold">{monthsInARow} months in a row</small></div>
      ) : null}
    </section>
  );
}

/** One passport page: paper, stamps at their tilt, dashed "Your next stamp" slots, a page number. */
function Page({ stamps, number, side, onOpen, firstEmpty }: { stamps: StampT[]; number: number; side: 'left' | 'right' | 'single'; onOpen: (s: StampT) => void; firstEmpty: number }) {
  const slots = Array.from({ length: PER_PAGE }, (_, i) => stamps[i] ?? null);
  return (
    <div className={`relative grid flex-1 grid-cols-2 content-start gap-x-2 gap-y-4 px-4 pt-6 pb-9 sm:px-6 ${side === 'left' ? 'rounded-l-[20px]' : side === 'right' ? 'rounded-r-[20px]' : 'rounded-[20px]'}`}>
      {slots.map((s, i) => s ? (
        <m.button key={s.eventId + s.role} type="button" onClick={() => onOpen(s)} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.bouncy, delay: 0.1 + i * 0.05 }}
          className="flex flex-col items-center gap-1.5 rounded-2xl p-1 text-center hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]" aria-label={`${s.eventTitle}, ${fmtDate(s.date, null, { year: true })}`}>
          <span style={{ opacity: inkOf(s.eventId) }}><Stamp label={s.communityName || s.eventTitle} date={dateTile(s.date)} ink={s.role === 'ATTENDED' ? 'green' : 'gold'} size={96} tilt={tiltOf(s.eventId)} /></span>
          <small className="line-clamp-2 text-[12px] font-semibold">{s.eventTitle}</small>
        </m.button>
      ) : (number - 1) * PER_PAGE + i === firstEmpty ? (
        <span key={`empty-${i}`} className="flex flex-col items-center gap-1.5 p-1 text-center opacity-80">
          <Stamp state="empty" size={96} tilt={0} />
          <small className="text-[12px] font-semibold text-muted">Your next stamp</small>
        </span>
      ) : (
        <span key={`empty-${i}`} aria-hidden className="flex justify-center p-1"><span className="size-[88px] rounded-full border-2 border-dashed border-[color-mix(in_srgb,var(--line)_70%,transparent)] opacity-60" /></span>
      ))}
      <span className={`absolute bottom-3 text-[11.5px] font-semibold text-muted tabular-nums ${side === 'left' ? 'left-5' : 'right-5'}`}>{number}</span>
    </div>
  );
}

/**
 * The passport book: open like a real passport (paper, centre fold, page edges). Desktop shows a
 * two-page spread, phones one page. Swipe or use the arrows; pages flip in 3D (a slide with reduced motion).
 */
function Book({ stamps, onOpen }: { stamps: StampT[]; onOpen: (s: StampT) => void }) {
  const reduce = useReducedMotion();
  const desktop = useIsDesktop('(min-width: 768px)');
  const perView = desktop ? PER_PAGE * 2 : PER_PAGE;
  const pages = useMemo(() => {
    const n = Math.max(1, Math.ceil(stamps.length / PER_PAGE) + (stamps.length % PER_PAGE === 0 ? 1 : 0));
    return Array.from({ length: desktop ? n + (n % 2) : n }, (_, i) => stamps.slice(i * PER_PAGE, (i + 1) * PER_PAGE));
  }, [stamps, desktop]);
  const views = Math.ceil(pages.length / (perView / PER_PAGE));
  const [[view, dir], set] = useState<[number, number]>([0, 1]);
  useEffect(() => { set(([v, d]) => [Math.min(v, views - 1), d]); }, [views]);
  const go = (d: number) => { const n = view + d; if (n >= 0 && n < views) set([n, d]); };
  const first = view * (perView / PER_PAGE);
  const paper = 'bg-[radial-gradient(circle_at_20%_10%,color-mix(in_srgb,var(--gold)_7%,transparent),transparent_55%),repeating-linear-gradient(0deg,transparent_0_27px,color-mix(in_srgb,var(--line)_45%,transparent)_27px_28px),color-mix(in_srgb,var(--surface)_92%,var(--gold))]';
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full [perspective:1600px]">
        {/* Page edges: the stacked pages peeking out under the open book. */}
        <span aria-hidden className="absolute inset-x-2 -bottom-1.5 h-full rounded-[22px] border border-line bg-surface" />
        <span aria-hidden className="absolute inset-x-4 -bottom-3 h-full rounded-[22px] border border-line bg-surface opacity-70" />
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <m.div key={view} custom={dir}
            variants={reduce
              ? { enter: (d: number) => ({ x: d * 60, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: d * -60, opacity: 0 }) }
              : { enter: (d: number) => ({ rotateY: d * 70, opacity: 0, transformOrigin: d > 0 ? 'left center' : 'right center' }), center: { rotateY: 0, opacity: 1 }, exit: (d: number) => ({ rotateY: d * -70, opacity: 0, transformOrigin: d > 0 ? 'left center' : 'right center' }) }}
            initial="enter" animate="center" exit="exit" transition={{ type: 'spring', stiffness: 160, damping: 22 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25} onDragEnd={(_, i) => { if (i.offset.x < -60) go(1); else if (i.offset.x > 60) go(-1); }}
            className={`relative flex min-h-[340px] cursor-grab touch-pan-y rounded-[20px] border border-line shadow-card active:cursor-grabbing ${paper}`}>
            {desktop ? (
              <>
                <Page stamps={pages[first] ?? []} number={first + 1} side="left" onOpen={onOpen} firstEmpty={stamps.length} />
                {/* The centre fold. */}
                <span aria-hidden className="w-6 shrink-0 bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--ink)_10%,transparent)_45%,color-mix(in_srgb,var(--ink)_16%,transparent)_50%,color-mix(in_srgb,var(--ink)_10%,transparent)_55%,transparent)]" />
                <Page stamps={pages[first + 1] ?? []} number={first + 2} side="right" onOpen={onOpen} firstEmpty={stamps.length} />
              </>
            ) : <Page stamps={pages[first] ?? []} number={first + 1} side="single" onOpen={onOpen} firstEmpty={stamps.length} />}
          </m.div>
        </AnimatePresence>
      </div>
      {views > 1 ? (
        <div className="mt-2 flex items-center gap-3">
          <button type="button" onClick={() => go(-1)} disabled={view === 0} aria-label="Previous pages" className="grid size-10 place-items-center rounded-full border border-line disabled:opacity-30"><ChevronLeft size={18} /></button>
          <span className="text-[13.5px] font-semibold text-muted tabular-nums">{desktop ? `Pages ${first + 1}–${first + 2}` : `Page ${first + 1}`} of {pages.length}</span>
          <button type="button" onClick={() => go(1)} disabled={view === views - 1} aria-label="Next pages" className="grid size-10 place-items-center rounded-full border border-line disabled:opacity-30"><ChevronRight size={18} /></button>
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
        <Stamp state="empty" size={120} tilt={0} center={<SealText>{"– –"}</SealText>} />
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
            <dt className="text-muted">Date</dt><dd>{fmtDate(stamp.date, null, { year: true }) || '—'}</dd>
            {stamp.communityName ? <><dt className="text-muted">Community</dt><dd><Link href={`/communities/${stamp.communitySlug}`} className="font-semibold text-green-text hover:underline">{stamp.communityName}</Link></dd></> : null}
            {registration ? <><dt className="text-muted">Checked in</dt><dd>{fmtTime(registration.checkInAt) || '—'}</dd><dt className="text-muted">Checked out</dt><dd>{fmtTime(registration.checkOutAt) || '—'}</dd></> : null}
          </dl>
          {stamp.role === 'ATTENDED' ? <p className="rounded-2xl bg-tint px-4 py-3 text-[15px] font-semibold text-green-text">{stamp.attendedWith ? `You attended with ${plural(stamp.attendedWith, 'other')}` : 'You were there'}</p> : null}
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

const RECAP_AT = 3;
/** Semester recap entry: the full recap from 3 events this semester; before that, progress towards it. */
function Recap({ stamps }: { stamps: StampT[] }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  // Nigerian semesters roughly: Sept–Jan and Feb–Jul.
  const from = now.getMonth() >= 8 ? new Date(now.getFullYear(), 8, 1) : now.getMonth() === 0 ? new Date(now.getFullYear() - 1, 8, 1) : new Date(now.getFullYear(), 1, 1);
  const term = stamps.filter((s) => s.date && new Date(s.date) >= from);
  const top = [...term.reduce((m0, s) => m0.set(s.communityName, (m0.get(s.communityName) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0];
  return (
    <section className="flex flex-wrap items-center gap-5 rounded-[24px] bg-[linear-gradient(120deg,var(--tint),var(--surface))] p-6">
      <Sparkles size={28} className="text-green-text" />
      <div className="min-w-0 flex-1"><b className="block font-display text-[20px]">This semester so far</b>
        <p className="text-[15px] text-muted">{term.length ? <>{plural(term.length, 'event')} attended{top?.[0] ? <>, most with <b className="text-ink">{top[0]}</b></> : null}.</> : 'Nothing yet this semester.'}</p>
        {term.length < RECAP_AT ? (
          <div className="mt-2 flex items-center gap-3">
            <span className="h-2 w-32 overflow-hidden rounded-full bg-mist"><m.span className="block h-full origin-left rounded-full bg-green-text" initial={{ scaleX: 0 }} animate={{ scaleX: term.length / RECAP_AT }} transition={spring.soft} /></span>
            <small className="text-[13px] text-muted"><b className="text-ink">{term.length} of {RECAP_AT}</b> events · your full recap unlocks at the end of the semester</small>
          </div>
        ) : null}</div>
      {term.length >= RECAP_AT ? <Btn onClick={() => setOpen(true)}>See your recap</Btn> : null}
      <Sheet open={open} onClose={() => setOpen(false)} title="Your semester so far">
        <div className="flex flex-col gap-4 px-5 pb-6">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-tint p-4"><b className="block font-display text-[30px]">{term.length}</b><small className="text-muted">events attended</small></div>
            <div className="rounded-2xl bg-mist p-4"><b className="block font-display text-[30px]">{new Set(term.map((t) => t.communitySlug)).size}</b><small className="text-muted">communities</small></div>
          </div>
          {top?.[0] ? <p className="text-[15px]">You went to <b>{top[0]}</b> most ({plural(top[1], 'event')}).</p> : null}
          <ul className="flex flex-col divide-y divide-line">{term.map((t) => <li key={t.eventId} className="flex items-center justify-between gap-3 py-2 text-[14.5px]"><span className="truncate">{t.eventTitle}</span><small className="shrink-0 text-muted">{fmtDate(t.date)}</small></li>)}</ul>
        </div>
      </Sheet>
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
          <small className="text-[12px] text-muted">Sent {fmtDate(i.createdAt)}{i.reviewedAt ? ` · reviewed ${fmtDate(i.reviewedAt)}` : ''}</small>
        </li>
      ))}</ul>
    </section>
  );
}
