'use client';
import { ResendVerification } from '@/components/auth/verify-email';
import { RegistrationConfirmation } from '@/components/events/registration-confirmation';
import { RegistrationForm } from '@/components/events/registration-form';
import { Sheet } from '@/components/ui/sheet';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { ExternalLink, Star, Ticket } from 'lucide-react';
import type { EventDetail, Registration, User } from '@/lib/api/types';
import { cancelPlace, getEvent, partnerOpened, rateEvent, register, updateRegistrationAnswers } from '@/lib/api/events';
import { dateTile, phaseOf, registrationOpen } from '@/lib/events';
import { spring } from '@/lib/motion';
import { Btn } from '@/components/ui/bits';
import { Stamp } from '@/components/brand/stamp';
import { useToast } from '@/components/ui/toast';
import { attendanceState, WAITING_BODY, WAITING_TITLE, waitingBy } from '@/lib/attendance';

// Holding a place. On a multi-day event a student can reach COMPLETED (enough days) or PARTIAL before
// it is over; they still hold their pass for the remaining days, so those count as holding a place too.
const ACTIVE: Registration['status'][] = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'];

/** The QR pass, printed in: it flips down from the top edge like a ticket coming out of a machine. */
export function Pass({ reg, title, name }: { reg: Registration; title: string; name: string }) {
  const [qr, setQr] = useState('');
  useEffect(() => { void import('qrcode').then((Q) => Q.toDataURL(reg.qrToken, { margin: 1, width: 360, color: { dark: '#111714', light: '#FFFFFF' } }).then(setQr)); }, [reg.qrToken]);
  return (
    <m.div key="pass" initial={{ rotateX: -92, opacity: 0, y: -8 }} animate={{ rotateX: 0, opacity: 1, y: 0, transition: { ...spring.bouncy, delay: 0.05 } }} exit={{ opacity: 0, scale: 0.96 }}
      style={{ transformOrigin: 'top center', transformPerspective: 900 }}
      className="relative overflow-hidden rounded-[22px] border border-line bg-white text-[#111714] shadow-lift">
      <div className="flex items-center justify-between bg-green px-4 py-2.5 text-white"><span className="flex items-center gap-2 text-[13px] font-bold"><Ticket size={15} />Your pass</span><span className="text-[12px] font-semibold opacity-85">Show at the door</span></div>
      <div className="flex flex-col items-center gap-2 px-5 pt-4 pb-5">
        {qr ? <img src={qr} alt={`QR pass for ${title}`} width={200} height={200} className="size-[200px]" /> : <div className="shimmer size-[200px] rounded-xl" />}
        {reg.passCode ? <span className="font-mono text-[18px] font-bold tracking-[.3em]">{reg.passCode}</span> : null}
        <b className="text-center font-display text-[17px] leading-tight">{title}</b>
        <span className="text-[13px] text-[#5B6760]">{name}</span>
      </div>
      {/* Ticket notches */}
      <span className="absolute top-[41px] -left-2.5 size-5 rounded-full bg-paper" /><span className="absolute top-[41px] -right-2.5 size-5 rounded-full bg-paper" />
    </m.div>
  );
}

function Rate({ eventId, initial }: { eventId: string; initial: number }) {
  const [rating, setRating] = useState(initial);
  const [hover, setHover] = useState(0);
  const toast = useToast();
  const save = (n: number) => { setRating(n); rateEvent(eventId, n).then(() => toast('Thanks! The organizer will see your rating.')).catch((e: Error) => toast(e.message)); };
  return (
    <div className="flex flex-col items-center gap-1.5">
      <b className="text-[15px]">{rating ? 'Your rating' : 'How was it?'}</b>
      <div role="radiogroup" aria-label="Rate this event" className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <m.button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onMouseEnter={() => setHover(n)} onClick={() => save(n)}
            whileTap={{ scale: 0.8, rotate: -12 }} transition={spring.snap} className="p-1">
            <Star size={28} className={n <= (hover || rating) ? 'fill-gold text-gold' : 'text-line'} />
          </m.button>
        ))}
      </div>
    </div>
  );
}

/**
 * The register card: sticky on the right on desktop, a bar at the bottom on phones.
 * `onRegistered` lets the guest list fly the student's face into the stack.
 */
export function RegisterCard({ detail, viewer, onChange, onRegistered, compact }: {
  detail: EventDetail; viewer: User | null; onChange: (d: Partial<EventDetail>) => void; onRegistered: () => void; compact?: boolean;
}) {
  const { event } = detail;
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const phase = phaseOf(event);
  // Stamp, "attended" and the certificate button all hang off this one state.
  const state = attendanceState(event, detail.viewerAttended);
  const reg = detail.viewerRegistration;
  const active = Boolean(reg && ACTIVE.includes(reg.status));
  const spots = event.capacity ? Math.max(0, event.capacity - event.goingCount) : null;
  const ext = event.externalRegistration;
  const canEditAnswers = Boolean(viewer && reg && !event.external && !event.finalized && Boolean(event.startDate && new Date(event.startDate).getTime() > Date.now()) && ['PUBLISHED', 'ANNOUNCED', 'POSTPONED'].includes(event.status) && phase === 'BEFORE' && !reg.checkInAt && ['CONFIRMED', 'PENDING_APPROVAL', 'WAITLISTED'].includes(reg.status) && (detail.registrationQuestions.length || reg.answers?.length));

  const [registrationForm, setRegistrationForm] = useState<'register' | 'edit' | null>(null);
  const closeRegistration = useCallback(() => { if (!busy) setRegistrationForm(null); }, [busy]);
  async function saveAnswers(answers: Record<string, string>) {
    setBusy(true);
    try {
      const updated = await updateRegistrationAnswers(event.id, answers);
      onChange({ viewerRegistration: updated });
      setRegistrationForm(null);
      toast('Your registration answers were updated.');
    } catch (e) { toast(e instanceof Error ? e.message : 'Unable to save answers'); }
    finally { setBusy(false); }
  }
  async function go(answers: Record<string, string> = {}) {
    if (!viewer) return;
    // The partner site opens straight from the tap; phones block tabs opened after waiting on the network.
    if (ext) window.open(ext.url, '_blank', 'noopener');
    setBusy(true);
    try {
      const r = await register(event.id, answers);
      setRegistrationForm(null);
      if (ext) await partnerOpened(event.id).catch(() => undefined);
      const fresh = await getEvent(event.slug).catch(() => null);
      onChange(fresh ?? { viewerRegistration: r, event: { ...event, goingCount: event.goingCount + (r.status === 'CONFIRMED' ? 1 : 0) } });
      if (r.status === 'CONFIRMED') onRegistered();
      else toast(r.status === 'WAITLISTED' ? 'You joined the waitlist. Your place is not confirmed yet.' : 'Your request was sent to the organizer.');
      if (navigator.vibrate) navigator.vibrate(18);
    } catch (e) { toast(e instanceof Error ? e.message : 'Unable to register'); }
    finally { setBusy(false); }
  }
  const [asking, setAsking] = useState(false);
  const leave = () => setAsking(true);
  async function giveUp() {
    setAsking(false);
    setBusy(true);
    try { await cancelPlace(event.id); const fresh = await getEvent(event.slug).catch(() => null); onChange(fresh ?? { viewerRegistration: null, event: { ...event, goingCount: Math.max(0, event.goingCount - (active ? 1 : 0)) } }); toast(reg?.status === 'WAITLISTED' ? 'You left the waitlist.' : reg?.status === 'PENDING_APPROVAL' ? 'Your request was withdrawn.' : 'Your place is cancelled.'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Unable to cancel'); }
    finally { setBusy(false); }
  }

  let body: React.ReactNode;
  if (detail.canManage) {
    body = <><p className="text-[14.5px] text-muted">You&apos;re running this event.</p><Btn wide href={`/events/${event.slug}/manage`}>Open event workspace</Btn></>;
  } else if (phase === 'CANCELLED') {
    body = <p className="rounded-2xl bg-mist px-4 py-3 text-[14.5px] font-semibold">This event was cancelled.</p>;
  } else if (phase === 'AFTER') {
    const held = Boolean(reg && !['CANCELLED', 'REJECTED', 'WAITLISTED', 'PENDING_APPROVAL'].includes(reg.status));
    body = state === 'ATTENDED' ? (
      <div className="flex flex-col items-center gap-3 text-center">
        <m.div initial={{ scale: 1.6, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -8, transition: spring.bouncy }}>
          <Stamp label={event.title} date={dateTile(event.startDate, event.timezone)} size={150} />
        </m.div>
        <p className="text-[15px]"><b>You attended.</b> It counts on your profile.</p>
        {detail.viewerCertificateSerial ? <Btn wide kind="gold" href={`/certificates/${detail.viewerCertificateSerial}`}>View your certificate</Btn>
          : event.certificate !== 'NONE' && viewer?.emailVerified === false ? <p className="rounded-2xl bg-[color-mix(in_srgb,var(--gold)_30%,var(--surface))] px-4 py-3 text-[14px]">Your certificate is waiting: verify your email and it&apos;s issued straight away. <ResendVerification email={viewer.email} /></p> : null}
        {!event.multiDay ? <Rate eventId={event.id} initial={detail.viewerRating?.rating ?? 0} /> : null}
      </div>
    ) : !held ? (
      <p className="rounded-2xl bg-mist px-4 py-3 text-[14.5px]">This event has ended.</p>
    ) : event.external ? (
      // An external listing: we never scanned anyone, so we never say whether it "counts" until a report is finalized.
      <p className="rounded-2xl bg-mist px-4 py-3 text-[14.5px]">{event.finalized
        ? `Attendance for this event came from the organizer's report from ${ext?.label ?? 'the other site'}, and it didn't include you.`
        : `Registration and attendance for this event were on ${ext?.label ?? 'another site'}. Nothing is recorded here unless the organizer shares their attendance report.`}</p>
    ) : state === 'AWAITING_FINALIZE' ? (
      // Over, not finalized: nothing is decided yet, so nothing is said to count or not count.
      <div className="flex flex-col items-center gap-3 text-center">
        <Stamp state="pending" label={event.title} size={120} title="Attendance not finalized yet" />
        <p className="text-[15px]"><b>{WAITING_TITLE}</b></p>
        <p className="text-[14px] text-muted">{WAITING_BODY}</p>
        {waitingBy(event) ? <p className="text-[13.5px] font-semibold">{waitingBy(event)}</p> : null}
        {!reg?.checkInAt ? <p className="rounded-2xl bg-mist px-4 py-3 text-left text-[13.5px]">We don&apos;t have a check-in for you yet. If you were there, tell the organizer before they finalize.</p>
          : !reg.checkOutAt ? <p className="rounded-2xl bg-mist px-4 py-3 text-left text-[13.5px]">We have your check-in but no check-out. If you stayed to the end, tell the organizer: they can correct it before finalizing.</p>
          : null}
      </div>
    ) : (
      // Finalized and not counted: say why, in the past tense.
      <p className="rounded-2xl bg-mist px-4 py-3 text-[14.5px]">{reg?.checkInAt ? 'You were scanned in but not out, so this event doesn’t count on your profile.'
        : 'You registered but weren’t scanned in, so this event doesn’t count on your profile.'}</p>
    );
  } else if (reg && reg.status === 'PENDING_APPROVAL') {
    body = <><p className="rounded-2xl bg-tint px-4 py-3 text-[14.5px] font-semibold text-green-text">Your request was received. Your place is not confirmed yet. We’ll notify you when the organizer approves or declines.</p><Btn kind="secondary" onClick={leave} disabled={busy}>Withdraw request</Btn></>;
  } else if (reg && reg.status === 'REJECTED') {
    body = <p className="rounded-2xl bg-mist px-4 py-3 text-[14.5px]">The organizer declined your request for this event. Contact the organizer if you need help.</p>;
  } else if (reg && reg.status === 'WAITLISTED') {
    body = <><p className="rounded-2xl bg-mist px-4 py-3 text-[14.5px]"><b>You’re on the waitlist.</b> Your place is not confirmed, and you don’t have a pass yet. We’ll notify you here and by email if an eligible place opens.</p><Btn kind="secondary" onClick={leave} disabled={busy}>Leave waitlist</Btn></>;
  } else if (active && ext) {
    body = (
      <>
        <p className="rounded-2xl bg-tint px-4 py-3 text-[14.5px] font-semibold text-green-text">You&apos;re registered here. Finish registering on {ext.label} with the same email.</p>
        <Btn wide href={ext.url}>Open {ext.label}<ExternalLink size={16} /></Btn>
        <button type="button" onClick={leave} disabled={busy} className="text-[13.5px] font-semibold text-muted hover:text-ink">Cancel my place</button>
      </>
    );
  } else {
    body = (
      <AnimatePresence mode="popLayout" initial={false}>
        {active && reg && viewer ? (
          <div key="has" className="flex flex-col gap-3">
            <RegistrationConfirmation event={event} />
            <Pass reg={reg} title={event.title} name={viewer.fullName} />
            {!reg.checkInAt ? <button type="button" onClick={leave} disabled={busy} className="text-[13.5px] font-semibold text-muted hover:text-ink">Cancel my place</button> : null}
          </div>
        ) : (
          <m.div key="ask" exit={{ scaleY: 0.2, opacity: 0, transition: { duration: 0.18 } }} style={{ transformOrigin: 'bottom' }} className="flex flex-col gap-2">
            {!viewer ? <Btn wide size="lg" href={`/login?next=${encodeURIComponent(`/events/${event.slug}`)}`}>Sign in to register</Btn>
              : registrationOpen(event) && (spots !== 0 || (!event.external && event.waitlistEnabled)) ? <Btn wide size="lg" onClick={() => ext ? void go() : setRegistrationForm('register')} disabled={busy}>{busy ? 'Registering…' : ext ? <>Register on {ext.label}<ExternalLink size={17} /></> : event.registrationPolicy === 'APPROVAL' ? 'Request a place' : spots === 0 && event.waitlistEnabled ? 'Join waitlist' : 'Register'}</Btn>
              : <p className="rounded-2xl bg-mist px-4 py-3 text-center text-[14.5px] font-semibold">{spots === 0 ? 'All spots are taken.' : 'Registration is not open right now.'}</p>}
          </m.div>
        )}
      </AnimatePresence>
    );
  }

  // Event Helpers: their way to the door, above whatever else the card says.
  const helperDoor = detail.viewerIsHelper && (phase === 'BEFORE' || phase === 'LIVE') ? (
    <div className="flex flex-col gap-2 rounded-2xl bg-tint p-3">
      <p className="text-[14px] font-semibold text-green-text">You&apos;re an Event Helper for this event.</p>
      <Btn wide href={`/events/${event.slug}/manage`}>Open the door scanner</Btn>
    </div>
  ) : null;
  return (
    <div className={`flex flex-col gap-3 ${compact ? '' : 'rounded-[24px] border border-line bg-surface p-5 shadow-card'}`}>
      {helperDoor}
      {!compact && phase === 'BEFORE' && spots !== null && !active ? (
        <div className="flex items-center justify-between text-[14px]"><span className="font-semibold">{spots ? `${spots} spot${spots === 1 ? '' : 's'} left` : 'Full'}</span><span className="text-muted">of {event.capacity}</span></div>
      ) : null}
      {body}
      {canEditAnswers ? <Btn wide kind="secondary" onClick={() => setRegistrationForm('edit')} disabled={busy}>Edit registration answers</Btn> : null}
      <Sheet open={Boolean(registrationForm)} onClose={closeRegistration} title={registrationForm === 'edit' ? 'Edit registration answers' : 'Register for this event'}>
        {viewer ? <RegistrationForm questions={detail.registrationQuestions} viewer={viewer} busy={busy} onSubmit={registrationForm === 'edit' ? saveAnswers : go} editing={registrationForm === 'edit'} submitLabel={event.registrationPolicy === 'APPROVAL' ? 'Send request' : spots === 0 && event.waitlistEnabled ? 'Join waitlist' : 'Confirm registration'} initialAnswers={registrationForm === 'edit' ? reg?.answers : undefined} /> : null}
      </Sheet>
      <ConfirmSheet open={asking} onClose={() => setAsking(false)} title={reg?.status === 'WAITLISTED' ? 'Leave the waitlist?' : reg?.status === 'PENDING_APPROVAL' ? 'Withdraw your request?' : 'Give up your place?'}
        body={reg?.status === 'WAITLISTED' || reg?.status === 'PENDING_APPROVAL' ? <>Your request for <b>{event.title}</b> will be cancelled. Rejoining puts you at the end of the queue.</> : <>Your pass for <b>{event.title}</b> stops working{event.capacity ? ' and the place goes to someone else' : ''}. You can register again while registration is open.</>}
        confirmLabel={reg?.status === 'WAITLISTED' ? 'Leave waitlist' : reg?.status === 'PENDING_APPROVAL' ? 'Withdraw request' : 'Give up my place'} cancelLabel={active ? 'Keep my place' : 'Keep waiting'} onConfirm={giveUp} />
    </div>
  );
}
