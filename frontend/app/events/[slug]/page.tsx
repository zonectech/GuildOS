'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

import {
  cancelRegistration,
  getEvent,
  registerForEvent,
  resolveEventImageUrl,
  walkInCheckIn,
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
  const [community, setCommunity] = useState<{ name: string } | null>(null);
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

  async function handleRegister() {
    if (!event) return;
    try {
      setBusy(true);
      setActionError('');
      setNotice('');
      const result = await registerForEvent(event._id);
      setRegistration(result.registration);
      setNotice(result.registration.status === 'WAITLISTED' ? 'You are on the waitlist.' : 'You are registered!');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to register');
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
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="h-56 bg-gradient-to-r from-indigo-600 to-sky-500">
          {event.bannerImage ? <img src={resolveEventImageUrl(event.bannerImage)} alt={event.title} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="p-6">
          <p className="text-sm font-medium text-indigo-600">{event.type.replace(/_/g, ' ')} · {event.mode}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">{event.title}</h1>
          {community ? <p className="mt-1 text-sm text-slate-500">by {community.name}</p> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-slate-700">
            <p><span className="text-slate-500">When:</span> {event.startDate ? new Date(event.startDate).toLocaleString() : 'TBA'}</p>
            <p><span className="text-slate-500">Where:</span> {event.venue || event.meetingLink || 'TBA'}</p>
            <p><span className="text-slate-500">Available seats:</span> {seats}</p>
            <p><span className="text-slate-500">Status:</span> {event.status.replace(/_/g, ' ')}</p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {activeRegistration ? (
              <>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">{activeRegistration.status.replace(/_/g, ' ')}</span>
                <button onClick={() => void handleCancel()} disabled={busy} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50">Cancel Registration</button>
              </>
            ) : registrationOpen ? (
              <button onClick={() => void handleRegister()} disabled={busy} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{ev.registrationPolicy === 'APPROVAL' ? 'Request to Register' : 'Register'}</button>
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

      <div className="flex flex-wrap gap-3">
        {googleCalendarUrl ? (
          <a href={googleCalendarUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900">Add to Google Calendar</a>
        ) : null}
        {eventStart ? (
          <button onClick={downloadIcs} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900">Download .ics</button>
        ) : null}
        <button onClick={() => void handleShare()} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900">Share Event</button>
      </div>

      {event.qrEnabled && activeRegistration && ['CONFIRMED', 'CHECKED_IN'].includes(activeRegistration.status) ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Your Check-In Pass</h2>
          <p className="mt-1 text-sm text-slate-500">Show this QR code to an organizer to check in. Remember to check out at the end to earn your certificate.</p>
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <QRCodeSVG value={activeRegistration.qrToken} size={160} includeMargin />
            </div>
            <div>
              <p className="text-sm text-slate-500">Check-in code</p>
              <p className="font-mono text-sm font-medium text-slate-900 break-all">{activeRegistration.qrToken}</p>
            </div>
          </div>
        </section>
      ) : null}

      {event.description ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">About</h2>
          <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{event.description || event.shortDescription}</p>
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
    </main>
  );
}
