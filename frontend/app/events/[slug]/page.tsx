'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, MapPin, Share2, Ticket, Video, X } from 'lucide-react';

import { StudentNav } from '../../../components/guildos/student-nav';
import {
  cancelRegistration,
  getEvent,
  registerForEvent,
  resolveEventImageUrl,
  respondEventPartnership,
  selfCheckIn,
  selfCheckOut,
  submitSponsorshipInquiry,
  SPONSOR_PERK_LABEL,
  walkInCheckIn,
  type EventAttendanceMode,
  type EventCoHost,
  type EventRegistration,
  type EventSpeaker,
  type EventSponsor,
  type EventSummary,
} from '../../../components/guildos/event-api';

export default function PublicEventPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [sponsors, setSponsors] = useState<EventSponsor[]>([]);
  const [community, setCommunity] = useState<{ name: string; slug?: string } | null>(null);
  const [coHosts, setCoHosts] = useState<EventCoHost[]>([]);
  const [partnershipInvite, setPartnershipInvite] = useState<{ partnershipId: string; communityName: string } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        const detail = await getEvent(slug);
        if (cancelled) return;
        setEvent(detail.event);
        setSpeakers(detail.speakers);
        setSponsors(detail.sponsors);
        setCommunity(detail.community);
        setCoHosts(detail.coHosts ?? []);
        setPartnershipInvite(detail.viewerPartnershipInvite ?? null);
        setRegistration(detail.viewerRegistration);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load event');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </main>
    );
  }

  if (!event) {
    return <main className="mx-auto max-w-3xl px-4 py-10"><p className="text-slate-500">Loading event…</p></main>;
  }

  const seats = event.capacity === 0 ? 'Unlimited' : `${Math.max(0, event.capacity - event.registrationCount)} of ${event.capacity}`;

  const activeRegistration = registration && registration.status !== 'CANCELLED' && registration.status !== 'REJECTED' ? registration : null;
  const registrationOpen = event.status === 'PUBLISHED' || event.status === 'CHECK_IN';
  const eventLive = event.status === 'CHECK_IN' || event.status === 'CHECK_OUT';
  // Attends over the internet: virtual events, or hybrid registrations that chose online.
  const onlineAttendee = Boolean(
    activeRegistration && (event.mode === 'VIRTUAL' || (event.mode === 'HYBRID' && activeRegistration.attendanceMode !== 'PHYSICAL')),
  );
  const meetingHref = event.meetingLink ? (event.meetingLink.startsWith('http') ? event.meetingLink : `https://${event.meetingLink}`) : '';

  async function handleRespondInvite(action: 'ACCEPT' | 'DECLINE') {
    if (!partnershipInvite) return;
    try {
      setInviteBusy(true);
      setActionError('');
      await respondEventPartnership(partnershipInvite.partnershipId, action);
      if (action === 'ACCEPT') {
        setNotice(`${partnershipInvite.communityName} is now co-hosting this event. 🤝`);
        const detail = await getEvent(slug);
        setCoHosts(detail.coHosts ?? []);
      } else {
        setNotice('Invite declined.');
      }
      setPartnershipInvite(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to respond to invite');
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRegister(attendanceMode?: EventAttendanceMode) {
    if (!event) return;
    try {
      setBusy(true);
      setActionError('');
      setNotice('');
      const result = await registerForEvent(event._id, attendanceMode);
      setRegistration(result.registration);
      setNotice(result.registration.status === 'WAITLISTED' ? 'You are on the waitlist.' : 'You are registered!');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to register');
    } finally {
      setBusy(false);
    }
  }

  async function handleSelfCheckIn() {
    if (!event) return;
    try {
      setBusy(true);
      setActionError('');
      setNotice('');
      const result = await selfCheckIn(event._id);
      setRegistration(result.registration);
      setNotice('Checked in — enjoy the event! 🎥');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to check in');
    } finally {
      setBusy(false);
    }
  }

  async function handleSelfCheckOut() {
    if (!event) return;
    try {
      setBusy(true);
      setActionError('');
      setNotice('');
      const result = await selfCheckOut(event._id);
      setRegistration(result.registration);
      setNotice(result.registration.status === 'COMPLETED' ? 'Checked out — attendance completed! 🎉' : 'Checked out — partial attendance recorded (you left before the end).');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to check out');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!event) return;
    try {
      setBusy(true);
      setActionError('');
      setNotice('');
      await cancelRegistration(event._id);
      setRegistration(null);
      setNotice('Registration cancelled.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to cancel');
    } finally {
      setBusy(false);
    }
  }

  async function handleWalkIn() {
    if (!event) return;
    try {
      setBusy(true);
      setActionError('');
      setNotice('');
      const result = await walkInCheckIn(event._id);
      setRegistration(result.registration);
      setNotice('You are checked in!');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to check in');
    } finally {
      setBusy(false);
    }
  }

  const ev = event;
  const eventStart = ev.startDate ? new Date(ev.startDate) : null;
  const eventEnd = ev.endDate ? new Date(ev.endDate) : eventStart ? new Date(eventStart.getTime() + 3600000) : null;
  function icsStamp(d: Date) {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }
  const googleCalendarUrl = eventStart && eventEnd
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${icsStamp(eventStart)}/${icsStamp(eventEnd)}&details=${encodeURIComponent(ev.shortDescription || '')}&location=${encodeURIComponent(ev.venue || ev.meetingLink || '')}`
    : '';
  function downloadIcs() {
    if (!eventStart || !eventEnd) return;
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GuildOS//EN', 'BEGIN:VEVENT',
      `UID:${ev._id}@guildos`, `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(eventStart)}`, `DTEND:${icsStamp(eventEnd)}`,
      `SUMMARY:${ev.title}`, `DESCRIPTION:${(ev.shortDescription || '').replace(/\r?\n/g, ' ')}`,
      `LOCATION:${ev.venue || ev.meetingLink || ''}`, 'END:VEVENT', 'END:VCALENDAR',
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ev.slug}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const nav = navigator as Navigator & { share?: (data: { title: string; url: string }) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: ev.title, url }); } catch { /* share cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setNotice('Event link copied to clipboard.');
      } catch {
        setActionError('Unable to copy link');
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav active="/events" />
      <main className="mx-auto max-w-6xl px-4 py-6">
      <Link href="/events" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-x-0.5 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      <div className="mt-4 lg:flex lg:items-start lg:gap-5">
      {/* ── Main column ── */}
      <div className="min-w-0 flex-1 space-y-5">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="h-56 bg-gradient-to-r from-indigo-600 to-sky-500">
          {event.bannerImage ? <img src={resolveEventImageUrl(event.bannerImage)} alt={event.title} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="p-6">
          <p className="text-sm font-medium text-indigo-600">{event.type.replace(/_/g, ' ')} · {event.mode}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">{event.title}</h1>
          {event.theme ? <p className="mt-1 text-sm font-medium italic text-slate-600">Theme: {event.theme}</p> : null}
          {community ? (
            <p className="mt-1 text-sm text-slate-500">
              by{' '}
              {community.slug ? (
                <Link href={`/communities/${encodeURIComponent(community.slug)}`} className="font-medium text-indigo-600 hover:underline">{community.name}</Link>
              ) : (
                community.name
              )}
            </p>
          ) : null}
          {event.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {event.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">#{tag}</span>
              ))}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {activeRegistration ? (
              <>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${['COMPLETED', 'CHECKED_OUT'].includes(activeRegistration.status) ? 'bg-emerald-600 text-white' : activeRegistration.status === 'PARTIAL_ATTENDANCE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                  {activeRegistration.status === 'COMPLETED' ? '✓ Attendance completed' : activeRegistration.status.replace(/_/g, ' ')}
                </span>
                {activeRegistration.status === 'COMPLETED' && event.certificateEnabled ? (
                  <span className="text-sm text-slate-500">🎓 Your certificate will appear in <a href="/my-events" className="text-indigo-600 hover:underline">My events</a> once issued.</span>
                ) : null}
                {/* Cancelling only makes sense before attendance begins. */}
                {['CONFIRMED', 'WAITLISTED', 'PENDING_APPROVAL'].includes(activeRegistration.status) ? (
                  <button onClick={() => void handleCancel()} disabled={busy} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50">Cancel Registration</button>
                ) : null}
                {/* Online attendance: self check-in unlocks the meeting link; check-out completes attendance. */}
                {onlineAttendee && eventLive && !activeRegistration.checkInAt && activeRegistration.status === 'CONFIRMED' ? (
                  <button onClick={() => void handleSelfCheckIn()} disabled={busy} className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">🎥 Check in (online)</button>
                ) : null}
                {onlineAttendee && eventLive && activeRegistration.checkInAt && !activeRegistration.checkOutAt ? (
                  <>
                    {meetingHref ? (
                      <a href={meetingHref} target="_blank" rel="noreferrer" className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Join meeting →</a>
                    ) : null}
                    <button onClick={() => void handleSelfCheckOut()} disabled={busy} className="rounded-2xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-800 disabled:opacity-50">Check out</button>
                  </>
                ) : null}
              </>
            ) : registrationOpen ? (
              event.mode === 'HYBRID' ? (
                <>
                  <span className="w-full text-sm font-medium text-slate-600">How will you attend?</span>
                  <button onClick={() => void handleRegister('PHYSICAL')} disabled={busy} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">📍 {ev.registrationPolicy === 'APPROVAL' ? 'Request — In person' : 'Register — In person'}</button>
                  <button onClick={() => void handleRegister('ONLINE')} disabled={busy} className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">🎥 {ev.registrationPolicy === 'APPROVAL' ? 'Request — Online' : 'Register — Online'}</button>
                </>
              ) : (
                <button onClick={() => void handleRegister()} disabled={busy} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{ev.registrationPolicy === 'APPROVAL' ? 'Request to Register' : 'Register'}</button>
              )
            ) : (
              <span className="text-sm text-slate-500">Registration is closed.</span>
            )}
            {ev.allowWalkIns && ev.status === 'CHECK_IN' && (!activeRegistration || !activeRegistration.checkInAt) ? (
              <button onClick={() => void handleWalkIn()} disabled={busy} className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 disabled:opacity-50">Check in now (walk-in)</button>
            ) : null}
          </div>
          {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
          {actionError ? <p className="mt-3 text-sm text-red-600">{actionError}</p> : null}
        </div>
      </div>

      {partnershipInvite ? (
        <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5">
          <p className="text-sm font-semibold text-indigo-900">🤝 Co-host invitation</p>
          <p className="mt-1 text-sm text-indigo-800">
            <strong>{partnershipInvite.communityName}</strong> has been invited to co-host this event. Accepting lets your
            coordinators help manage it, and your community appears on the event page and certificates.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => void handleRespondInvite('ACCEPT')} disabled={inviteBusy} className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Accept</button>
            <button onClick={() => void handleRespondInvite('DECLINE')} disabled={inviteBusy} className="rounded-2xl border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-800 disabled:opacity-50">Decline</button>
          </div>
        </section>
      ) : null}

      {(event.gallery ?? []).length ? <EventGallery images={event.gallery!} title={event.title} /> : null}

      {event.description || event.shortDescription ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">About</h2>
          <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{event.description || event.shortDescription}</p>
        </section>
      ) : null}

      {(event.features ?? []).length ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">What to expect</h2>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {(event.features ?? []).map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-600">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {speakers.length ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Speakers</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {speakers.map((s) => (
              <div key={s._id} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                {s.photo ? <img src={resolveEventImageUrl(s.photo)} alt={s.fullName} className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-slate-100" />}
                <div>
                  <p className="font-medium text-slate-900">{s.fullName}</p>
                  <p className="text-sm text-slate-500">{[s.title, s.organization].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {sponsors.length ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Sponsors</h2>
          <div className="mt-4 flex flex-wrap gap-4">
            {sponsors.map((s) => (
              <div key={s._id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">{s.name}</div>
            ))}
          </div>
        </section>
      ) : null}

      {coHosts.length || (event.partners ?? []).length ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">In partnership with</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {coHosts.map((c) => (
              <Link key={c.partnershipId} href={`/communities/${encodeURIComponent(c.slug)}`} className="flex items-center gap-2.5 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-2.5 transition hover:border-indigo-300">
                {c.logo ? (
                  <img src={resolveEventImageUrl(c.logo)} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">{c.name.slice(0, 1)}</span>
                )}
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{c.name}</span>
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-indigo-500">Co-host</span>
                </span>
              </Link>
            ))}
            {(event.partners ?? []).map((p, i) => {
              const body = (
                <>
                  {p.logo ? (
                    <img src={resolveEventImageUrl(p.logo)} alt="" className="h-8 w-8 rounded-lg object-contain" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500">{p.name.slice(0, 1)}</span>
                  )}
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{p.name}</span>
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">Partner</span>
                  </span>
                </>
              );
              return p.website ? (
                <a key={`partner-${i}`} href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-2xl border border-slate-200 px-4 py-2.5 transition hover:border-slate-400">
                  {body}
                </a>
              ) : (
                <div key={`partner-${i}`} className="flex items-center gap-2.5 rounded-2xl border border-slate-200 px-4 py-2.5">{body}</div>
              );
            })}
          </div>
        </section>
      ) : null}

      {event.sponsorshipOpen && ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'].includes(event.status) ? (
        <SponsorThisEvent event={event} />
      ) : null}
      </div>

      {/* ── Right rail ── */}
      <aside className="mt-5 space-y-4 lg:sticky lg:top-20 lg:mt-0 lg:w-[340px] lg:shrink-0 lg:self-start">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Event details</h2>
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-start gap-2.5">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Date & time</p>
                <p className="font-medium text-slate-800">{event.startDate ? new Date(event.startDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'TBA'}</p>
                {event.endDate ? <p className="text-xs text-slate-500">until {new Date(event.endDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p> : null}
              </div>
            </div>
            {event.mode === 'PHYSICAL' || event.mode === 'HYBRID' ? (
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">In person</p>
                  <p className="font-medium text-slate-800">{event.venue || 'Venue TBA'}</p>
                  {event.address ? <p className="text-xs text-slate-500">{event.address}</p> : null}
                  {event.refreshments ? <p className="mt-0.5 text-xs font-medium text-amber-700">🍛 Refreshments provided (Item 7)</p> : null}
                </div>
              </div>
            ) : null}
            {event.mode === 'VIRTUAL' || event.mode === 'HYBRID' ? (
              <div className="flex items-start gap-2.5">
                <Video className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Online</p>
                  {event.meetingLink ? (
                    activeRegistration?.checkInAt ? (
                      <a href={meetingHref} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">Join meeting →</a>
                    ) : (
                      // The link is the reward for checking in — never shown before attendance is recorded.
                      <p className="font-medium text-slate-800">{activeRegistration ? 'Unlocks when you check in (once the event is live)' : 'Link unlocked at check-in'}</p>
                    )
                  ) : (
                    <p className="font-medium text-slate-800">Link TBA</p>
                  )}
                </div>
              </div>
            ) : null}
            <div className="flex items-start gap-2.5">
              <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Seats</p>
                <p className="font-medium text-slate-800">{seats} · {event.status.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>
        </div>

        {(event.contacts ?? []).length ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Contact the organizers</h2>
            <div className="mt-3 space-y-3">
              {(event.contacts ?? []).map((contact, i) => (
                <div key={i} className="text-sm">
                  {contact.name ? <p className="font-medium text-slate-800">{contact.name}</p> : null}
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {contact.phone ? (
                      <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="text-xs text-indigo-600 hover:underline">📞 {contact.phone}</a>
                    ) : null}
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="text-xs text-indigo-600 hover:underline">✉️ {contact.email}</a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {googleCalendarUrl ? (
              <a href={googleCalendarUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Google Calendar</a>
            ) : null}
            {eventStart ? (
              <button onClick={downloadIcs} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Download .ics</button>
            ) : null}
            <button onClick={() => void handleShare()} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Share2 className="h-3.5 w-3.5" /> Share</button>
          </div>
        </div>

        {event.qrEnabled && !onlineAttendee && activeRegistration && ['CONFIRMED', 'CHECKED_IN'].includes(activeRegistration.status) ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Your Check-In Pass</h2>
            <p className="mt-1 text-xs text-slate-500">Show this QR to an organizer to check in. Check out at the end to earn your certificate.</p>
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <QRCodeSVG value={activeRegistration.qrToken} size={150} includeMargin />
              </div>
              <p className="break-all text-center font-mono text-xs text-slate-500">{activeRegistration.qrToken}</p>
            </div>
          </section>
        ) : null}
      </aside>
      </div>
      </main>
    </div>
  );
}

/** Flyer/photo slideshow: arrows + dots + thumbnails, click to preview full-screen. */
function EventGallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const current = images[Math.min(index, images.length - 1)];
  const go = (dir: number) => setIndex((i) => (i + dir + images.length) % images.length);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Flyers & photos</h2>
      <div className="relative mt-4 overflow-hidden rounded-2xl bg-slate-100">
        <img
          src={resolveEventImageUrl(current)}
          alt={`${title} — image ${index + 1} of ${images.length}`}
          onClick={() => setLightbox(true)}
          className="mx-auto max-h-[26rem] w-full cursor-zoom-in object-contain"
        />
        {images.length > 1 ? (
          <>
            <button onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-700 shadow hover:bg-white" aria-label="Previous image"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-700 shadow hover:bg-white" aria-label="Next image"><ChevronRight className="h-5 w-5" /></button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => setIndex(i)} className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-2 bg-white/60'}`} aria-label={`Go to image ${i + 1}`} />
              ))}
            </div>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button key={img} onClick={() => setIndex(i)} className={`shrink-0 overflow-hidden rounded-xl border-2 ${i === index ? 'border-indigo-500' : 'border-transparent opacity-70 hover:opacity-100'}`}>
              <img src={resolveEventImageUrl(img)} alt={`Thumbnail ${i + 1}`} className="h-16 w-16 object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {lightbox ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setLightbox(false)}>
          <button onClick={() => setLightbox(false)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close preview"><X className="h-5 w-5" /></button>
          {images.length > 1 ? (
            <button onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Previous image"><ChevronLeft className="h-6 w-6" /></button>
          ) : null}
          <img src={resolveEventImageUrl(current)} alt={`${title} preview`} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-auto max-w-[92vw] rounded-xl object-contain" />
          {images.length > 1 ? (
            <button onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Next image"><ChevronRight className="h-6 w-6" /></button>
          ) : null}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">{index + 1} / {images.length}</p>
        </div>
      ) : null}
    </section>
  );
}

function SponsorThisEvent({ event }: { event: EventSummary }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleSubmit() {
    try {
      setSubmitting(true);
      setFormError('');
      await submitSponsorshipInquiry(event._id, {
        companyName,
        contactName,
        email,
        phone,
        website,
        packageName: selectedPackage,
        message,
        hp: honeypot,
      });
      setSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit inquiry');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Sponsor this event</h2>
      {event.sponsorshipPitch ? <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{event.sponsorshipPitch}</p> : null}
      <p className="mt-2 text-xs text-slate-500">{event.registrationCount} registered attendee{event.registrationCount === 1 ? '' : 's'} · attendance is verified on GuildOS</p>

      {event.sponsorshipPackages.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {event.sponsorshipPackages.map((pkg) => (
            <button
              key={pkg.name}
              type="button"
              onClick={() => {
                setSelectedPackage(pkg.name === selectedPackage ? '' : pkg.name);
                setShowForm(true);
              }}
              className={`rounded-2xl border p-4 text-left transition ${selectedPackage === pkg.name ? 'border-indigo-500 bg-white ring-2 ring-indigo-200' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
            >
              <p className="font-semibold text-slate-900">{pkg.name}</p>
              {pkg.price ? <p className="mt-0.5 text-sm font-medium text-indigo-600">{pkg.price}</p> : null}
              {pkg.perks?.length ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {pkg.perks.map((key) => (
                    <li key={key} className="flex items-start gap-1.5">
                      <span className="mt-0.5 text-emerald-600">✓</span>
                      {SPONSOR_PERK_LABEL[key] ?? key}
                    </li>
                  ))}
                </ul>
              ) : null}
              {pkg.benefits ? <p className="mt-2 whitespace-pre-line text-xs text-slate-500">{pkg.benefits}</p> : null}
            </button>
          ))}
        </div>
      ) : null}

      {sent ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Thanks! Your inquiry has been sent to the organizers — they will contact you at {email}.
        </div>
      ) : showForm ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          {/* Honeypot — invisible to humans, bots fill it and get silently dropped */}
          <input
            type="text"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            name="company_fax"
            autoComplete="off"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Company name *" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Contact person *" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <input type="email" className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Company website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Message to the organizers (optional)" value={message} onChange={(e) => setMessage(e.target.value)} />
          {selectedPackage ? <p className="text-xs text-slate-500">Selected package: <span className="font-medium text-slate-700">{selectedPackage}</span></p> : null}
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting || !companyName.trim() || !contactName.trim() || !email.trim()}
            className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send inquiry'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          Become a sponsor
        </button>
      )}
    </section>
  );
}
