'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Bookmark, BookmarkCheck, Check, ExternalLink, MapPin, Phone, Share2 } from 'lucide-react';
import { toggleSaved } from '@/lib/account';
import { cancelRegistration, getEvent, imageUrl, partnerOpened, registerForEvent, respondPartnership, type EventDetail, type Registration } from '@/lib/api';
import { bucketOf, longDate, placeLabel, registrationOpen } from '@/lib/events';
import { useSession } from '@/lib/session';
import { GeneratedCover } from '@/components/cover';
import { Avatar, Button, CertLabel, DateBadge } from '@/components/ui';
import { RunPanel } from '@/components/run-panel';
import { AttendedSeal } from '@/components/seal';
import { renderMarkdown } from '@/components/markdown';

const ACTIVE = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'];
const CERT_HINT = {
  INSTANT: 'Scan in at the door and out at the end to get your certificate straight away.',
  AFTER_EVENT: 'Your certificate is issued after the event, once attendance is confirmed.',
  NONE: 'No certificate for this event. Scan in and out and it still counts on your profile.',
};
const CERT_HINT_PAST: Record<EventDetail['certificateOffer'], string> = {
  INSTANT: 'Attendees got their certificate when they scanned out.',
  AFTER_EVENT: 'Attendees got their certificate after the event, once attendance was confirmed.',
  NONE: 'This event did not offer a certificate. Attendance still counted on profiles.',
};

function Pass({ registration, title }: { registration: Registration; title: string }) {
  const scannedIn = Boolean(registration.checkInAt);
  const scannedOut = Boolean(registration.checkOutAt);
  const steps = [['Registered', true], ['Scanned in', scannedIn], ['Scanned out', scannedOut], ['Certificate', registration.certificateIssued]] as const;
  return (
    <div className="pass">
      <h3>Your pass</h3>
      <div className="qr"><QRCodeSVG value={registration.qrToken} size={200} /></div>
      {registration.passCode ? <p>Pass code <b>{registration.passCode}</b></p> : null}
      {registration.status === 'COMPLETED' ? <p className="note">You attended{registration.certificateIssued ? ', certificate issued' : ''}.</p> : <p className="small">Show this at the door for {title}. You will scan again at the end.</p>}
      <div className="steps">
        {steps.map(([label, done]) => <div key={label} className={`step${done ? ' done' : ''}`}><i>{done ? <Check size={13} strokeWidth={3} /> : null}</i>{label}</div>)}
      </div>
    </div>
  );
}

/** Agenda, tracks, speakers, partners and contacts, shown only when the organizer added them. */
function EventExtras({ detail, past }: { detail: EventDetail; past: boolean }) {
  const { event } = detail;
  const days = (event.days ?? []).filter((d) => d.date || d.theme);
  const tz = event.timezone || 'Africa/Lagos';
  return (
    <>
      {days.length > 1 ? <><h3>Agenda</h3>{days.map((d, i) => <div key={i} className="line"><b style={{ minWidth: 56 }}>Day {i + 1}</b><span className="stack" style={{ gap: 1 }}><span>{d.theme || (d.date ? new Date(d.date).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'short', timeZone: tz }) : '')}{d.cancelled ? ' · Cancelled' : ''}</span><span className="small">{[d.date ? new Date(d.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: tz }) : '', d.startTime && d.endTime ? `${d.startTime} to ${d.endTime}` : '', d.venue].filter(Boolean).join(' · ')}</span></span></div>)}</> : null}
      {event.sections?.length ? <><h3>Tracks</h3>{event.sections.map((s) => <div key={s.key} className="line"><span className="stack" style={{ gap: 1 }}><b>{s.name}</b><span className="small">{[s.description, s.venue, s.capacity && !past ? `${s.capacity} places` : ''].filter(Boolean).join(' · ')}</span></span></div>)}</> : null}
      {detail.speakers?.length ? <><h3>Speakers</h3><div className="people">{detail.speakers.map((s) => <div key={s._id} className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><Avatar name={s.fullName} src={imageUrl(s.photo)} size={44} /><span className="stack" style={{ gap: 0 }}><b>{s.fullName}</b><span className="small">{[s.title, s.organization].filter(Boolean).join(', ')}</span></span></div>)}</div></> : null}
      {detail.coHosts?.length || event.partners?.length ? <><h3>In partnership with</h3><div className="people">{(detail.coHosts ?? []).map((c) => <Link key={c.partnershipId} href={`/communities/${c.slug}`} className="row" style={{ gap: 10 }}><Avatar name={c.name} src={imageUrl(c.logo)} size={36} /><b>{c.name}</b></Link>)}{(event.partners ?? []).map((p) => <a key={p.name} href={p.website || undefined} target="_blank" rel="noopener noreferrer nofollow" className="row" style={{ gap: 10 }}><Avatar name={p.name} src={imageUrl(p.logo)} size={36} /><b>{p.name}</b></a>)}</div></> : null}
      {event.contacts?.length ? <><h3>{past ? 'Organizer contacts' : 'Questions?'}</h3>{event.contacts.map((c) => <div key={c.name} className="line"><span className="fi" style={{ width: 40, height: 40 }}><Phone size={16} /></span><span className="stack" style={{ gap: 0 }}><b>{c.name}</b><span className="small">{[c.phone, c.email].filter(Boolean).join(' · ')}</span></span></div>)}</> : null}
    </>
  );
}

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => getEvent(slug).then(setDetail).catch((e: Error) => setError(e.message)), [slug]);
  useEffect(() => { void load(); }, [load, user?.id]);

  if (error && !detail) return <div className="wrap page"><p className="error">{error}</p><Link className="lk" href="/events">All events</Link></div>;
  if (!detail) return <div className="wrap page"><p className="empty">Loading event…</p></div>;

  const { event, community, viewerRegistration: reg } = detail;
  const when = longDate(event);
  const active = reg && ACTIVE.includes(reg.status);
  const open = registrationOpen(event);
  const external = event.attendanceSource === 'EXTERNAL' && event.partnerRegistrationUrl;
  const bucket = bucketOf(event);
  const past = bucket === 'ENDED' || bucket === 'CANCELLED';
  // Check-out can stay open after the end time, so someone still inside keeps their pass until then.
  const scanningOpen = ['CHECK_IN', 'CHECK_OUT'].includes(event.status);
  // Events run on another site have no QR pass: attendance comes from that site's report afterwards.
  const showPass = Boolean(!external && active && reg && reg.status !== 'COMPLETED' && (!past || (scanningOpen && bucket !== 'CANCELLED')));
  const partnerLabel = event.partnerRegistrationLabel || 'the partner site';
  const reported = Boolean(event.attendanceFinalizedAt) || event.status === 'COMPLETED';
  const missed = past && !showPass && reg && ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'PARTIAL_ATTENDANCE', 'NO_SHOW'].includes(reg.status)
    ? external
      ? (reported ? `The organizer's attendance report from ${partnerLabel} did not include you, so this event does not count on your profile.` : `Waiting for the organizer's attendance report from ${partnerLabel}. Your stamp appears once it is in.`)
      : reg.checkInAt ? 'You were scanned in but not out at the end, so this event does not count on your profile.' : 'You registered but were not scanned in, so this event does not count on your profile.'
    : '';

  async function register() {
    if (!user) { router.push(`/login?next=${encodeURIComponent(`/events/${slug}`)}`); return; }
    // Open the partner's page straight from the tap: phone browsers block a new tab opened after waiting on the network.
    if (external) window.open(event.partnerRegistrationUrl, '_blank', 'noopener');
    setBusy(true); setError('');
    try {
      await registerForEvent(event._id);
      if (external) await partnerOpened(event._id).catch(() => undefined);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to register'); }
    finally { setBusy(false); }
  }
  async function answerInvite(accept: boolean) {
    const invite = detail?.viewerPartnershipInvite;
    if (!invite) return;
    if (!accept && !window.confirm(`Decline the invitation for ${invite.communityName} to co-host?`)) return;
    setBusy(true); setError('');
    try { await respondPartnership(invite.partnershipId, accept); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to answer the invitation'); }
    finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true); setError('');
    try { await cancelRegistration(event._id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to cancel'); }
    finally { setBusy(false); }
  }

  const action = (() => {
    if (detail.canManage) return null;
    if (reg?.status === 'PENDING_APPROVAL') return <p className="note">You asked to join. The organizer will approve or decline your place.</p>;
    if (reg?.status === 'WAITLISTED') return <p className="note">You are on the waitlist. We will tell you if a place opens.</p>;
    if (active) return null;
    if (bucket === 'CANCELLED') return <p className="small">This event was cancelled.</p>;
    if (bucket === 'ENDED') return null;
    if (!open) return <p className="small">Registration is not open right now.</p>;
    return <Button wide onClick={register} disabled={busy}>{busy ? 'Registering…' : external ? <>Register on {event.partnerRegistrationLabel || 'the partner site'}<ExternalLink size={16} /></> : 'Register'}</Button>;
  })();

  return (
    <div className="wrap page">
      <Link href="/events" className="small">‹ All events</Link>
      <div className="ev">
        <div className="stack" style={{ gap: 16 }}>
          <div className="media" style={{ position: 'relative' }}>
            {event.bannerImage ? <img src={imageUrl(event.bannerImage)} alt="" /> : <GeneratedCover seed={event.title} type={event.type} />}
            {past ? <span className="chip off ended">{bucket === 'CANCELLED' ? 'Cancelled' : 'Past event'}</span> : null}
          </div>
          <h1>{event.title}</h1>
          {community ? <Link href={`/communities/${community.slug}`} className="host"><Avatar name={community.name} src={imageUrl(community.logo)} size={34} /><span>Hosted by <b>{community.name}</b></span></Link> : null}
          {event.description || event.shortDescription ? <><h3>About this event</h3><div className="prose md">{renderMarkdown(event.description || event.shortDescription || '')}</div></> : null}
          <EventExtras detail={detail} past={past} />
        </div>
        <aside className="side">
          {detail.viewerPartnershipInvite ? (
            <div className="invite">
              <b>Co-host invitation</b>
              <p className="small">{community?.name ?? 'The organizers'} invited <b>{detail.viewerPartnershipInvite.communityName}</b> to co-host this event. Co-hosts are shown on the event page, can help scan people in and out, and get a Co-hosted seal and points when attendance closes.</p>
              <div className="row">
                <Button disabled={busy} onClick={() => void answerInvite(true)}>Accept</Button>
                <Button kind="s" disabled={busy} onClick={() => void answerInvite(false)}>Decline</Button>
              </div>
            </div>
          ) : null}
          {detail.viewerHostRole ? (
            <div className="sealbox">
              <AttendedSeal kind={detail.viewerHostRole} title={event.title} date={event.startDate} timezone={event.timezone} attendedCount={event.completedCount} />
              <p><b>{detail.viewerHostRole === 'HOSTED' ? 'You hosted this event.' : 'Your community co-hosted this event.'}</b> It counts on your profile{detail.viewerHostPoints ? `, +${detail.viewerHostPoints} Guild Score` : ''}.</p>
            </div>
          ) : null}
          {detail.canManage ? <RunPanel event={event} onChange={load} /> : null}
          <div className="fact"><DateBadge value={event.startDate} tz={event.timezone} /><div><b>{when.day}</b><span>{past ? `${when.time} · ${bucket === 'CANCELLED' ? 'Cancelled' : 'Ended'}` : when.time}</span></div></div>
          <div className="fact"><span className="fi"><MapPin size={20} /></span><div><b>{placeLabel(event)}</b><span>{past ? (event.mode === 'HYBRID' ? 'Held in person and online' : event.mode === 'VIRTUAL' ? 'Held online' : 'Held in person') : event.mode === 'HYBRID' ? 'In person and online' : event.mode === 'VIRTUAL' ? 'Join from anywhere' : 'In person'}</span></div></div>
          {user && !detail.canManage ? <div className="row">{!past ? <button type="button" className="btn s sm" onClick={() => void toggleSaved(event._id).then((r) => setDetail((d) => (d ? { ...d, viewerBookmarked: r.bookmarked } : d))).catch(() => undefined)}>{detail.viewerBookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}{detail.viewerBookmarked ? 'Saved' : 'Save'}</button> : null}<button type="button" className="btn s sm" onClick={() => void navigator.clipboard.writeText(window.location.href).catch(() => undefined)}><Share2 size={15} />Copy link</button></div> : null}
          {reg?.status !== 'COMPLETED' ? <><CertLabel offer={detail.certificateOffer} past={past} />
          <p className="small">{detail.certificateOffer === 'NONE' && detail.event.attendanceSource === 'EXTERNAL' ? (past ? 'This event did not offer a certificate.' : 'This event does not offer a certificate.') : (past ? CERT_HINT_PAST : CERT_HINT)[detail.certificateOffer]}</p></> : null}
          {error ? <p className="error">{error}</p> : null}
          {action}
          {reg?.status === 'COMPLETED' ? (
            <div className="sealbox">
              <AttendedSeal title={event.title} date={event.startDate} checkInAt={reg.checkInAt} checkOutAt={reg.checkOutAt} timezone={event.timezone} />
              <p><b>You attended.</b> It counts on your profile{detail.viewerPointsAwarded ? `, +${detail.viewerPointsAwarded} Guild Score` : ''}.</p>
              {detail.viewerCertificateSerial ? <Button wide href={`/certificates/${detail.viewerCertificateSerial}`}>View your certificate</Button> : null}
            </div>
          ) : missed ? <p className="note">{missed}</p> : external && active && reg && !past ? (
            <div className="invite">
              <b>You are registered here</b>
              <p className="small">This event runs on {partnerLabel}. Finish registering there too: their attendance report is how your attendance reaches your profile{detail.certificateOffer !== 'NONE' ? ' and your certificate' : ''}. Use the same email as your account here.</p>
              <a className="btn p w" href={event.partnerRegistrationUrl} target="_blank" rel="noopener noreferrer" onClick={() => void partnerOpened(event._id).catch(() => undefined)}>Open {partnerLabel}<ExternalLink size={16} /></a>
              <Button kind="d" wide onClick={cancel} disabled={busy}>Cancel my place</Button>
            </div>
          ) : showPass && reg ? <><Pass registration={reg} title={event.title} />{!reg.checkInAt ? <Button kind="d" wide onClick={cancel} disabled={busy}>Cancel my place</Button> : null}</> : null}
          {past && bucket === 'ENDED' ? (event.completedCount || event.registrationCount ? <p className="small">{[event.completedCount ? `${event.completedCount} attended` : '', event.registrationCount ? `${event.registrationCount} registered` : ''].filter(Boolean).join(' · ')}</p> : null)
            : event.registrationCount && !past ? <p className="small">{event.registrationCount} {event.registrationCount === 1 ? 'person' : 'people'} going</p> : null}
        </aside>
      </div>
    </div>
  );
}
