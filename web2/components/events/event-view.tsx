'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import * as m from 'motion/react-m';
import { useScroll, useTransform } from 'motion/react';
import { Award, BadgeCheck, CalendarClock, ExternalLink, Flag, Globe, Mail, MapPin, Phone, ShieldCheck, Ticket, Users } from 'lucide-react';
import type { EventDetail } from '@/lib/api/types';
import { getEvent } from '@/lib/api/events';
import { classic } from '@/lib/api/client';
import { sampleGuest } from '@/lib/api/mock/guests';
import { phaseOf, placeLabel, registrationOpen, typeStyle, whenLabel } from '@/lib/events';
import { renderMarkdown } from '@/lib/markdown';
import { page, rise, spring } from '@/lib/motion';
import { usePoll } from '@/lib/poll';
import { useSession } from '@/lib/session';
import { Avatar } from '@/components/ui/avatar';
import { DateTile } from '@/components/ui/bits';
import { useToast } from '@/components/ui/toast';
import { EventCover } from './cover';
import { GuestSection } from './guest-list';
import { LiveBadge } from './event-card';
import { RegisterCard } from './register-card';

const Row = ({ icon, title, sub, children }: { icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) => (
  <m.div variants={rise} className="flex items-center gap-3.5">
    {icon}
    <div className="min-w-0"><b className="block text-[15.5px] leading-snug">{title}</b>{sub ? <span className="block text-[14px] text-muted">{sub}</span> : null}</div>
    {children}
  </m.div>
);
const IconTile = ({ children }: { children: React.ReactNode }) => <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-muted shadow-card">{children}</span>;

/**
 * One event, as a full page.
 * `scroller` is a scroll box other than the window, if the view is ever shown inside one (for the cover parallax).
 */
export function EventView({ slug, scroller }: { slug: string; scroller?: React.RefObject<HTMLElement | null> }) {
  const { user } = useSession();
  const toast = useToast();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [me, setMe] = useState(false);
  const lastToast = useRef(0);

  useEffect(() => { getEvent(slug).then((d) => { setDetail(d); setMe(Boolean(d.viewerRegistration && !['CANCELLED', 'REJECTED'].includes(d.viewerRegistration.status))); }).catch((e: Error) => setError(e.message)); }, [slug, user?.id]);

  // While the page is open, check for new guests. Join notices: never name hidden or anonymous guests,
  // at most one every 30 seconds, and bursts grouped ("5 people just joined").
  const check = useCallback(async () => {
    if (!detail) return false;
    const fresh = await getEvent(slug);
    const before = detail.event.goingCount;
    const after = fresh.event.goingCount;
    setDetail((d) => (d ? { ...d, event: fresh.event } : d));
    if (after <= before) return fresh.event.checkedInCount !== detail.event.checkedInCount;
    const joined = after - before;
    if (Date.now() - lastToast.current >= 30_000) {
      const g = sampleGuest(fresh.event.id, after - 1, fresh.event.community.school ?? '');
      const text = joined > 1 ? `${joined} people just joined` : g.visibility === 'VISIBLE' ? `${g.name} just joined` : g.visibility === 'DEPARTMENT_ONLY' ? `Someone from ${g.department} just joined` : '';
      if (text) { toast(text, <Users size={16} className="text-green-text" />); lastToast.current = Date.now(); }
    }
    return true;
  }, [detail, slug, toast]);
  const phase = detail ? phaseOf(detail.event) : 'BEFORE';
  usePoll(check, 15_000, Boolean(detail) && (phase === 'BEFORE' || phase === 'LIVE'));

  if (error) return <div className="px-6 py-24 text-center"><p className="text-[17px] font-semibold">{error}</p></div>;
  if (!detail) return <ViewSkeleton />;

  const { event } = detail;
  // Once it is over (or called off), the page speaks in the past tense and the cover is muted.
  const ended = phase === 'AFTER';
  const cancelled = phase === 'CANCELLED';
  const past = ended || cancelled;
  const when = whenLabel(event, past);
  const st = typeStyle(event.type);
  const merge = (patch: Partial<EventDetail>) => setDetail((d) => (d ? { ...d, ...patch } : d));
  const eligibility = past ? [] : [
    event.registrationPolicy === 'APPROVAL' ? 'The organizer approves each registration.' : '',
    event.registrationPolicy === 'INVITE' ? 'Invite only.' : '',
    event.capacity ? `Limited to ${event.capacity} spots.` : '',
  ].filter(Boolean);
  const contact = detail.contacts.find((c) => c.email || c.phone);
  const mapHref = event.mode !== 'VIRTUAL' && event.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event.venue, event.state].filter(Boolean).join(', '))}` : '';
  const status = cancelled ? 'Cancelled' : ended ? 'Ended' : phase === 'LIVE' ? 'Happening now' : event.externalRegistration ? `Registration on ${event.externalRegistration.label}` : registrationOpen(event) ? 'Registration open' : 'Registration not open';
  const statusSub = cancelled
    ? (event.cancellationReason && !/^Cancelled by the organizers$/i.test(event.cancellationReason) ? `Reason from the organizer: ${event.cancellationReason}` : 'Everyone registered was told.')
    : ended
      ? [event.attendedCount ? `${event.attendedCount} attended` : '', event.goingCount ? `${event.goingCount} registered` : ''].filter(Boolean).join(' · ') || 'No attendance was recorded.'
      : phase === 'BEFORE' && event.registrationDeadline ? `Closes ${new Date(event.registrationDeadline).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}` : undefined;
  const placeSub = cancelled
    ? (event.mode === 'VIRTUAL' ? 'Was planned online' : event.mode === 'HYBRID' ? 'Was planned in person and online' : 'Was planned in person')
    : ended
      ? (event.mode === 'VIRTUAL' ? 'Held online' : event.mode === 'HYBRID' ? 'Held in person and online' : 'Held in person')
      : event.mode === 'HYBRID' ? 'In person and online' : event.mode === 'VIRTUAL' ? 'Join link unlocks when you check in' : undefined;
  const pastChip = past ? <span className={`absolute top-4 left-4 rounded-full px-3 py-1.5 text-[13px] font-extrabold backdrop-blur ${cancelled ? 'bg-ink text-paper' : 'bg-[rgb(17_23_20/.72)] text-white'}`}>{cancelled ? 'Cancelled' : 'Past event'}</span> : null;

  return (
    <m.div variants={page} initial="hidden" animate="show" className="mx-auto w-full max-w-[1080px] px-4 pt-4 pb-10 sm:px-6 lg:px-8">
      {/* Cover with a gentle parallax (max 30px). */}
      <ParallaxCover scroller={scroller} muted={past} badge={phase === 'LIVE' ? <span className="absolute top-4 left-4"><LiveBadge /></span> : pastChip}>
        <EventCover src={event.cover} title={event.title} type={event.type} sizes="(min-width: 1080px) 1040px, 100vw" priority caption={event.title} />
      </ParallaxCover>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-6">
          <m.a variants={rise} href={event.community.slug ? `/communities/${event.community.slug}` : undefined} className="flex w-fit items-center gap-3">
            {event.community.logo ? <Image src={event.community.logo} alt="" width={40} height={40} className="size-10 rounded-full object-cover ring-2 ring-paper" /> : <Avatar name={event.community.name} size={40} />}
            <span className="text-[14.5px] text-muted">Hosted by <b className="inline-flex items-center gap-1 text-ink">{event.community.name}{event.community.verified ? <BadgeCheck size={16} className="text-green-text" aria-label="Verified community" /> : null}</b></span>
          </m.a>
          <m.div variants={rise}>
            <span className="text-[12.5px] font-bold uppercase tracking-[.12em] text-green-text">{st.label}</span>
            <h1 className="mt-1 text-[36px] font-extrabold sm:text-[48px]">{event.title}</h1>
          </m.div>

          <div className="flex flex-col gap-4">
            <Row icon={<DateTile value={event.startDate} tz={event.timezone} />} title={when.day} sub={when.time} />
            <Row icon={<IconTile>{event.mode === 'VIRTUAL' ? <Globe size={20} /> : <MapPin size={20} />}</IconTile>} title={placeLabel(event)} sub={placeSub}>
              {mapHref ? <a href={mapHref} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0 text-[14px] font-semibold text-green-text hover:underline">Map</a> : null}
            </Row>
            <Row icon={<IconTile><Ticket size={20} /></IconTile>} title={status} sub={statusSub} />
            {!cancelled ? (
              <Row icon={<IconTile><Award size={20} className={event.certificate !== 'NONE' ? 'text-[var(--stamp-gold)]' : ''} /></IconTile>}
                title={event.certificate !== 'NONE' ? (ended ? 'Certificate given' : 'Certificate available') : 'No certificate'}
                sub={event.certificate !== 'NONE' ? (ended ? 'Given at check-out to everyone who attended' : 'Given at check-out to everyone who attends') : ended ? 'Attendance still counted on profiles' : 'Attendance still counts on your profile'} />
            ) : null}
          </div>

          {/* The guest list sits right after the key details. */}
          <m.div variants={rise}><GuestSection event={event} viewer={user} me={me} /></m.div>

          {/* Phones: the register card sits here; desktops have it on the right. */}
          <div id="register" className="scroll-mt-24 lg:hidden"><RegisterCard detail={detail} viewer={user} onChange={merge} onRegistered={() => setMe(true)} /></div>

          {eligibility.length ? <m.p variants={rise} className="flex items-start gap-2.5 rounded-2xl bg-mist px-4 py-3 text-[14.5px]"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-green-text" />{eligibility.join(' ')}</m.p> : null}

          {event.description || event.summary ? (
            <m.section variants={rise} aria-labelledby="about-h">
              <h2 id="about-h" className="mb-3 text-[24px] font-extrabold">About</h2>
              <div className="prose-ev">{event.description ? renderMarkdown(event.description) : <p>{event.summary}</p>}</div>
            </m.section>
          ) : null}

          {detail.speakers.length ? (
            <m.section variants={rise} aria-labelledby="speakers-h">
              <h2 id="speakers-h" className="mb-3 text-[24px] font-extrabold">Speakers</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {detail.speakers.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                    <Avatar name={s.name} src={s.photo} size={48} />
                    <span className="min-w-0"><b className="block truncate">{s.name}</b><small className="block truncate text-[13px] text-muted">{[s.title, s.organization].filter(Boolean).join(', ')}</small></span>
                  </div>
                ))}
              </div>
            </m.section>
          ) : null}

          <m.section variants={rise} aria-labelledby="hosts-h">
            <h2 id="hosts-h" className="mb-3 text-[24px] font-extrabold">Hosts</h2>
            <div className="flex flex-col gap-2">
              {[event.community, ...detail.coHosts].map((c) => (
                <a key={c.id} href={c.slug ? `/communities/${c.slug}` : undefined} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:bg-mist">
                  {c.logo ? <Image src={c.logo} alt="" width={44} height={44} className="size-11 rounded-full object-cover" /> : <Avatar name={c.name} size={44} />}
                  <b className="flex-1 truncate">{c.name}</b>
                  {c.id !== event.community.id ? <span className="rounded-full bg-mist px-2 py-0.5 text-[12px] font-bold text-muted">Co-host</span> : null}
                </a>
              ))}
            </div>
            {contact ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {contact.email ? <a href={`mailto:${contact.email}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[14px] font-semibold hover:bg-mist"><Mail size={16} />Contact the host</a> : null}
                {contact.phone ? <a href={`tel:${contact.phone}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[14px] font-semibold hover:bg-mist"><Phone size={16} />Call</a> : null}
              </div>
            ) : null}
          </m.section>

          <a href={classic(`/feedback?from=${encodeURIComponent(`/events/${event.slug}`)}`)} className="inline-flex w-fit items-center gap-1.5 text-[13px] text-muted hover:text-ink"><Flag size={13} />Report event</a>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6 flex flex-col gap-3">
            <RegisterCard detail={detail} viewer={user} onChange={merge} onRegistered={() => setMe(true)} />
            {event.externalRegistration ? <p className="flex items-center gap-1.5 px-1 text-[13px] text-muted"><ExternalLink size={13} />People {past ? 'registered' : 'register'} on {event.externalRegistration.label}.</p> : null}
            {phase === 'BEFORE' && event.startDate ? <p className="flex items-center gap-1.5 px-1 text-[13px] text-muted"><CalendarClock size={13} />Attend and get scanned to earn this stamp.</p> : null}
          </div>
        </aside>
      </div>

      {/* Phones: a bar that stays in reach, with the going count and one tap to the register card. */}
      {!detail.canManage && !me && (phase === 'BEFORE' || phase === 'LIVE') && registrationOpen(event) ? (
        <div className={`glass sticky z-10 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-line p-2.5 pl-4 shadow-lift lg:hidden ${scroller ? 'bottom-3' : 'bottom-[calc(92px+env(safe-area-inset-bottom))]'}`}>
          <span className="min-w-0 text-[14px]"><b className="tabular-nums">{event.goingCount}</b> going{event.capacity ? <span className="text-muted"> · {Math.max(0, event.capacity - event.goingCount)} spots left</span> : null}</span>
          <button type="button" onClick={() => document.getElementById('register')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="h-11 shrink-0 rounded-xl bg-green px-5 text-[15px] font-bold text-white">Register</button>
        </div>
      ) : null}
    </m.div>
  );
}

/**
 * The cover drifts down a little as you scroll past it. No zoom, so the photo is never cut off:
 * the layer is 18px taller than the box, and the photo sits whole inside it.
 * The box is 2:1, the shape organizers are asked to upload (1600 × 800).
 * Its own component, so the scroll tracker only starts once the cover is on the page.
 */
function ParallaxCover({ scroller, badge, muted, children }: { scroller?: React.RefObject<HTMLElement | null>; badge?: React.ReactNode; muted?: boolean; children: React.ReactNode }) {
  const cover = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: cover, container: scroller, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 18]);
  return (
    <div ref={cover} className="relative aspect-[16/9] overflow-hidden rounded-[28px] shadow-lift sm:aspect-[2/1]">
      {/* Past events: the cover is quieter, so it reads as a memory, not an invitation. */}
      <m.div style={{ y }} className={`absolute inset-x-0 -top-[18px] bottom-0 ${muted ? 'opacity-90 saturate-[.55]' : ''}`}>{children}</m.div>
      {badge}
    </div>
  );
}

function ViewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 pt-4 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading event">
      <div className="shimmer aspect-[16/9] rounded-[28px] sm:aspect-[2.2/1]" />
      <div className="mt-6 space-y-4"><div className="shimmer h-5 w-48 rounded" /><div className="shimmer h-11 w-3/4 rounded-lg" /><div className="shimmer h-14 w-72 rounded-xl" /><div className="shimmer h-14 w-64 rounded-xl" /><div className="shimmer h-36 rounded-3xl" /></div>
    </div>
  );
}
