'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowDown, ArrowLeft, Bookmark, Check, GraduationCap, Handshake, MapPin, Mic, Star, Video, X } from 'lucide-react';

import { StudentNav } from '../../../components/guildos/student-nav';
import { EventCountdown } from '../../../components/guildos/events/event-countdown';
import { EventGallery } from '../../../components/guildos/events/event-gallery';
import { EventAgenda } from '../../../components/guildos/events/event-agenda';
import { EventDetailsRail } from '../../../components/guildos/events/event-details-rail';
import { CheckinPassCard } from '../../../components/guildos/events/checkin-pass-card';
import { SponsorThisEvent } from '../../../components/guildos/events/sponsor-this-event';
import { RateEventCard, ManagerFeedbackCard } from '../../../components/guildos/events/event-feedback';
import { TicketPurchasePanel, TicketSalesCard, GuestClaimsPanel } from '../../../components/guildos/events/ticket-panels';
import { CancelRegistrationDialog, STUDENT_CANCEL_REASONS } from '../../../components/guildos/events/cancel-registration-dialog';
import { getCurrentUser } from '../../../components/guildos/auth-api';
import {
  cancelRegistration,
  checkMyTicketPayment,
  claimTicket,
  getEvent,
  getEventFeedback,
  getTicketClaims,
  getTicketQuote,
  getTicketSales,
  recordEventView,
  registerForEvent,
  resolveEventImageUrl,
  respondEventPartnership,
  selfCheckIn,
  selfCheckOut,
  startTicketCheckout,
  toggleEventBookmark,
  transferTicket,
  verifyTicketPayment,
  walkInCheckIn,
  type EventAttendanceMode,
  type EventCoHost,
  type EventFeedbackSummary,
  type EventRegistration,
  type EventSpeaker,
  type EventSponsor,
  type EventSummary,
  type TicketQuote,
  type TicketSales,
} from '../../../components/guildos/event-api';
import { renderMarkdown } from '../../../components/guildos/markdown';

export default function PublicEventPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [speakerDetail, setSpeakerDetail] = useState<EventSpeaker | null>(null);
  const [sponsors, setSponsors] = useState<EventSponsor[]>([]);
  const [community, setCommunity] = useState<{ name: string; slug?: string; logo?: string } | null>(null);
  const [coHosts, setCoHosts] = useState<EventCoHost[]>([]);
  const [partnershipInvite, setPartnershipInvite] = useState<{ partnershipId: string; communityName: string } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [ratingSummary, setRatingSummary] = useState<{ average: number; count: number }>({ average: 0, count: 0 });
  const [canRate, setCanRate] = useState(false);
  const [viewerFeedback, setViewerFeedback] = useState<{ rating: number; comment: string } | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [managerFeedback, setManagerFeedback] = useState<EventFeedbackSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [error, setError] = useState('');
  const [ticketQuote, setTicketQuote] = useState<TicketQuote | null>(null);
  const [ticketSales, setTicketSales] = useState<TicketSales | null>(null);
  // Ticket order state: selected tier / quantity / applied promo code.
  const [selTier, setSelTier] = useState('');
  const [qty, setQty] = useState(1);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [myClaims, setMyClaims] = useState<{ token: string; claimed: boolean; claimedByName: string | null }[]>([]);
  const [viewerName, setViewerName] = useState('');
  const [viewerUsername, setViewerUsername] = useState('');
  // Self-cancel asks WHY (options + free text) — organizers learn from drop-offs.
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  // ?invite=INV-… from the organizer's shareable link (INVITE-policy events).
  const [inviteToken, setInviteToken] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  // Multi-day RSVP: which days the viewer plans to attend (empty set = all days).
  const [pickedDays, setPickedDays] = useState<number[]>([]);
  // Seat availability for days with their own cap ("Day 2: 3 seats left", full = disabled).
  const [dayAvailability, setDayAvailability] = useState<{ day: number; capacity: number; taken: number }[]>([]);

  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get('invite');
    if (invite) setInviteToken(invite);
  }, []);

  // Page-view ping (once per browser session per event — powers the organizer's sales funnel)
  // + referral capture: ?ref=<username> survives the login/checkout hops via sessionStorage.
  useEffect(() => {
    if (!slug) return;
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) sessionStorage.setItem(`guildos-ref-${slug}`, ref.slice(0, 40));
    const viewedKey = `guildos-viewed-${slug}`;
    if (!sessionStorage.getItem(viewedKey)) {
      sessionStorage.setItem(viewedKey, '1');
      void recordEventView(slug).catch(() => undefined);
    }
  }, [slug]);

  useEffect(() => {
    void getCurrentUser().then((user) => {
      setViewerName(user?.fullName ?? '');
      setViewerUsername(user?.profile?.username ?? '');
    }).catch(() => undefined);
  }, []);

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
        setRatingSummary(detail.feedback ?? { average: 0, count: 0 });
        setCanRate(Boolean(detail.viewerCanRate));
        setCanManage(Boolean(detail.canManage));
        setBookmarked(Boolean(detail.viewerBookmarked));
        setViewerFeedback(detail.viewerFeedback ?? null);
        setDayAvailability(detail.dayAvailability ?? []);
        // Full days can't be RSVP'd — preselect only the days with space so the
        // register button works without the student having to figure out why it failed.
        const fullDays = (detail.dayAvailability ?? []).filter((a) => a.capacity - a.taken <= 0).map((a) => a.day);
        if (fullDays.length) {
          const total = Math.max((detail.event.days ?? []).length, 1);
          setPickedDays(Array.from({ length: total }, (_, i) => i + 1).filter((d) => !fullDays.includes(d) && !(detail.event.days ?? [])[d - 1]?.cancelled));
        }
        if (detail.canManage && (detail.feedback?.count ?? 0) > 0) {
          void getEventFeedback(detail.event._id).then(({ feedback }) => setManagerFeedback(feedback)).catch(() => undefined);
        }
        if ((detail.event.ticketPrice ?? 0) > 0 || (detail.event.ticketTiers ?? []).length > 0) {
          if (detail.canManage) {
            void getTicketSales(detail.event._id).then(setTicketSales).catch(() => undefined);
          }
          if (detail.viewerRegistration) {
            void getTicketClaims(detail.event._id).then(({ claims }) => setMyClaims(claims)).catch(() => undefined);
          }
          // Returning from the payment gateway? Verify the reference, then refresh the registration.
          const search = new URLSearchParams(window.location.search);
          const reference = search.get('reference') || search.get('trxref') || search.get('tx_ref');
          if (reference && reference.startsWith('TKT-') && !detail.viewerRegistration) {
            try {
              const outcome = await verifyTicketPayment(detail.event._id, reference);
              if (cancelled) return;
              if (outcome.status === 'PAID') {
                setNotice('Payment confirmed — you have a ticket!');
                const refreshed = await getEvent(slug);
                if (!cancelled) setRegistration(refreshed.viewerRegistration);
              } else if (outcome.status === 'REFUNDED') {
                setNotice('This event was cancelled — your payment is being refunded.');
              } else {
                setActionError('Payment was not completed. You can try again below.');
              }
            } catch (err) {
              if (!cancelled) setActionError(err instanceof Error ? err.message : 'Unable to verify payment');
            }
            window.history.replaceState(null, '', window.location.pathname);
          }
          // Guest arriving with a claim link? Redeem it — they get their own QR pass.
          const claimToken = search.get('ticket_claim');
          if (claimToken) {
            try {
              const outcome = await claimTicket(claimToken);
              if (cancelled) return;
              if (outcome.claimed || outcome.alreadyYours) {
                setNotice(outcome.alreadyYours ? 'This ticket is already yours — see your QR pass below.' : 'Ticket claimed — you are in!');
                const refreshed = await getEvent(slug);
                if (!cancelled) setRegistration(refreshed.viewerRegistration);
              }
            } catch (err) {
              if (!cancelled) setActionError(err instanceof Error ? err.message : 'Unable to claim ticket');
            }
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load event');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Live order quote: re-priced whenever the buyer changes tier, quantity, or promo code.
  const isPaidEvent = Boolean(event && ((event.ticketPrice ?? 0) > 0 || (event.ticketTiers ?? []).length > 0));
  useEffect(() => {
    if (!event || !isPaidEvent) return;
    let cancelled = false;
    void getTicketQuote(event._id, {
      tierName: selTier || undefined,
      promoCode: appliedPromo || undefined,
      quantity: qty,
    })
      .then((quote) => {
        if (cancelled) return;
        setTicketQuote(quote);
        if (!selTier && quote.tierName) setSelTier(quote.tierName);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?._id, isPaidEvent, selTier, appliedPromo, qty]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </main>
    );
  }

  if (!event) {
    return <main className="mx-auto max-w-3xl px-4 py-10"><p className="text-slate-500 dark:text-slate-400">Loading event…</p></main>;
  }

  const seats = event.capacity === 0 ? 'Unlimited' : `${Math.max(0, event.capacity - event.registrationCount)} of ${event.capacity}`;

  const activeRegistration = registration && registration.status !== 'CANCELLED' && registration.status !== 'REJECTED' ? registration : null;
  const registrationOpen = (event.status === 'PUBLISHED' || event.status === 'CHECK_IN') && !event.registrationClosed;
  const eventLive = event.status === 'CHECK_IN' || event.status === 'CHECK_OUT';
  // Attends over the internet: virtual events, or hybrid registrations that chose online.
  const onlineAttendee = Boolean(
    activeRegistration && (event.mode === 'VIRTUAL' || (event.mode === 'HYBRID' && activeRegistration.attendanceMode !== 'PHYSICAL')),
  );
  const meetingHref = event.meetingLink ? (event.meetingLink.startsWith('http') ? event.meetingLink : `https://${event.meetingLink}`) : '';

  // Multi-day events: attendance is per calendar day, keyed in the event's
  // timezone to match the backend (invalid/missing timezone falls back to UTC).
  const spanDays = event.startDate && event.endDate
    ? Math.round((Date.parse(new Date(event.endDate).toISOString().slice(0, 10)) - Date.parse(new Date(event.startDate).toISOString().slice(0, 10))) / 86400000) + 1
    : 1;
  const isMultiDay = (event.days ?? []).length > 1 || spanDays > 1;
  let todayKey = new Date().toISOString().slice(0, 10);
  if (event.timezone) {
    try {
      todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: event.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch { /* invalid timezone — keep UTC */ }
  }
  const todayEntry = (activeRegistration?.attendanceDays ?? []).find((d) => d.day === todayKey && d.checkInAt) ?? null;
  const checkedInToday = isMultiDay ? Boolean(todayEntry) : Boolean(activeRegistration?.checkInAt);
  const checkedOutToday = isMultiDay ? Boolean(todayEntry?.checkOutAt) : Boolean(activeRegistration?.checkOutAt);

  // Speakers assigned to a specific agenda day (1-based) — shown inside that day's card.
  const daySpeakers = speakers.reduce<Record<number, EventSpeaker[]>>((acc, s) => {
    if (s.day) (acc[s.day] ??= []).push(s);
    return acc;
  }, {});
  const totalDays = Math.max((event.days ?? []).length, spanDays);
  // Many days = many venues; the sidebar then shows the mode and points to the agenda.
  const hasPerDayVenues = isMultiDay && (event.days ?? []).some((d) => d.venue);

  async function handleRespondInvite(action: 'ACCEPT' | 'DECLINE') {
    if (!partnershipInvite) return;
    try {
      setInviteBusy(true);
      setActionError('');
      await respondEventPartnership(partnershipInvite.partnershipId, action);
      if (action === 'ACCEPT') {
        setNotice(`${partnershipInvite.communityName} is now co-hosting this event.`);
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

  /** Anonymous viewer clicked an authed action — send them to log in, then straight back here. */
  function failOrLogin(err: unknown, fallback: string) {
    const message = err instanceof Error ? err.message : fallback;
    if (/authorization token|session expired|not authenticated/i.test(message)) {
      router.push(`/login?next=${encodeURIComponent(`/events/${slug}`)}`);
      return;
    }
    setActionError(message);
  }

  async function handleRegister(attendanceMode?: EventAttendanceMode) {
    if (!event) return;
    try {
      setBusy(true);
      setActionError('');
      setNotice('');
      // Partial-day plans only matter for multi-day events; picking every day = attending all.
      const plan = isMultiDay && pickedDays.length && pickedDays.length < totalDays ? pickedDays : undefined;
      const result = await registerForEvent(event._id, attendanceMode, plan, inviteToken || undefined);
      setRegistration(result.registration);
      setNotice(result.registration.status === 'WAITLISTED' ? 'You are on the waitlist.' : 'You are registered!');
    } catch (err) {
      failOrLogin(err, 'Unable to register');
    } finally {
      setBusy(false);
    }
  }

  async function handleBuyTicket() {
    if (!event) return;
    try {
      setBusy(true);
      setActionError('');
      setNotice('');
      const result = await startTicketCheckout(event._id, {
        tierName: selTier || undefined,
        promoCode: appliedPromo || undefined,
        quantity: qty,
        inviteToken: inviteToken || undefined,
        referrer: sessionStorage.getItem(`guildos-ref-${slug}`) || undefined,
      });
      if (result.free) {
        // 100%-off or free tier — no gateway hop, the ticket is already confirmed.
        setNotice('Your free ticket is confirmed!');
        const refreshed = await getEvent(slug);
        setRegistration(refreshed.viewerRegistration);
        void getTicketClaims(event._id).then(({ claims }) => setMyClaims(claims)).catch(() => undefined);
        setBusy(false);
        return;
      }
      if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl;
        return;
      }
      setBusy(false);
    } catch (err) {
      failOrLogin(err, 'Unable to start checkout');
      setBusy(false);
    }
  }

  /** Missed the redirect back from the gateway? Re-check the payment directly. */
  async function handleCheckPayment() {
    if (!event) return;
    try {
      setBusy(true);
      setActionError('');
      const result = await checkMyTicketPayment(event._id);
      if (result.status === 'PAID') {
        setNotice('Payment confirmed — you have a ticket!');
        const refreshed = await getEvent(slug);
        setRegistration(refreshed.viewerRegistration);
        void getTicketClaims(event._id).then(({ claims }) => setMyClaims(claims)).catch(() => undefined);
      } else if (result.status === 'PENDING') {
        setNotice('');
        setActionError("Your last payment attempt wasn't completed. If you did pay, give it a minute and check again — if not, just use Get ticket (you won't be charged twice).");
      } else if (result.status === 'REFUNDED') {
        setNotice('This event was cancelled — your payment is being refunded.');
      } else if (result.status === 'NONE') {
        setActionError('No recent payment found for this event.');
      } else {
        setActionError('The payment did not complete. You can try again.');
      }
    } catch (err) {
      failOrLogin(err, 'Unable to check payment');
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
      setNotice('Checked in — enjoy the event!');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to check in');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleBookmark() {
    if (!event) return;
    try {
      setBookmarkBusy(true);
      const result = await toggleEventBookmark(event._id);
      setBookmarked(result.bookmarked);
    } catch (err) {
      failOrLogin(err, 'Unable to save event');
    } finally {
      setBookmarkBusy(false);
    }
  }

  async function handleTransferTicket(to: string) {
    if (!event) return;
    try {
      setActionError('');
      const result = await transferTicket(event._id, to);
      setNotice(`Ticket transferred to ${result.to.fullName} — they now have their own QR pass.`);
      const refreshed = await getEvent(slug);
      setRegistration(refreshed.viewerRegistration);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to transfer ticket');
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
      setNotice(result.registration.status === 'COMPLETED' ? 'Checked out — attendance completed!' : 'Checked out — partial attendance recorded (you left before the end).');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to check out');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(reason: string) {
    if (!event) return;
    try {
      setBusy(true);
      setActionError('');
      setNotice('');
      await cancelRegistration(event._id, reason);
      setRegistration(null);
      setCancelDialogOpen(false);
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
      failOrLogin(err, 'Unable to check in');
    } finally {
      setBusy(false);
    }
  }

  const ev = event;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav active="/events" />
      <main className="mx-auto max-w-6xl px-4 py-6">
      <Link href="/events" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 shadow-sm transition hover:-translate-x-0.5 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      <div className="mt-4 lg:flex lg:items-start lg:gap-5">
      {/* ── Main column ── */}
      <div className="min-w-0 flex-1 space-y-5">
      {event.status === 'ARCHIVED' && event.cancellationReason ? (
        <div className="rounded-3xl border border-rose-300 bg-rose-50 p-5">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold text-rose-900"><X className="h-4 w-4 shrink-0" /> This event has been cancelled</p>
          <p className="mt-1 text-sm text-rose-800">{event.cancellationReason}</p>
          <p className="mt-1 text-xs text-rose-700">All registrations were cancelled. Ticket buyers have been refunded — card refunds can take 3–15 days to appear.</p>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {/* 2:1 banner (matches the 1600×800 guidance in the wizard) — capped on very wide screens. */}
        <div className="aspect-[2/1] max-h-[420px] w-full bg-gradient-to-r from-indigo-600 to-sky-500">
          {event.bannerImage ? <img src={resolveEventImageUrl(event.bannerImage)} alt={event.title} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="p-6">
          <p className="text-sm font-medium text-indigo-600">{event.type.replace(/_/g, ' ')} · {event.mode}</p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
            <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">{event.title}</h1>
            {viewerName && !canManage ? (
              <button
                onClick={() => void handleToggleBookmark()}
                disabled={bookmarkBusy}
                title={bookmarked ? 'Remove from saved events' : 'Save for later'}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${bookmarked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-indigo-300'}`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? 'fill-white' : ''}`} /> {bookmarked ? 'Saved' : 'Save'}
              </button>
            ) : null}
          </div>
          <EventCountdown startDate={event.startDate} status={event.status} />
          {ratingSummary.count > 0 ? (
            <p className="mt-1 inline-flex items-center gap-0.5 text-sm text-amber-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={`h-4 w-4 ${star <= Math.round(ratingSummary.average) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              ))}
              <span className="ml-1.5 text-slate-500 dark:text-slate-400">{ratingSummary.average} · {ratingSummary.count} rating{ratingSummary.count === 1 ? '' : 's'}</span>
            </p>
          ) : null}
          {event.theme ? <p className="mt-1 text-sm font-medium italic text-slate-600 dark:text-slate-400">Theme: {event.theme}</p> : null}
          {community ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
            {!activeRegistration && registrationOpen && isMultiDay && totalDays > 1 ? (
              <div className="w-full">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Which days will you attend? <span className="font-normal text-slate-400 dark:text-slate-500">(helps the organizers plan — your pass works any day)</span></p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
                    const dayCancelled = Boolean((event.days ?? [])[d - 1]?.cancelled);
                    const avail = dayAvailability.find((a) => a.day === d);
                    const seatsLeft = avail ? Math.max(0, avail.capacity - avail.taken) : null;
                    const dayFull = seatsLeft === 0;
                    const blocked = dayCancelled || dayFull;
                    const picked = !blocked && (pickedDays.length === 0 || pickedDays.includes(d));
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={blocked}
                        title={dayCancelled ? 'This day has been cancelled' : dayFull ? 'This day is fully booked' : seatsLeft !== null ? `${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left` : undefined}
                        onClick={() => setPickedDays((prev) => {
                          const base = prev.length === 0 ? Array.from({ length: totalDays }, (_, i) => i + 1) : prev;
                          const next = base.includes(d) ? base.filter((x) => x !== d) : [...base, d].sort((a, b) => a - b);
                          return next.length === 0 ? base : next.length === totalDays ? [] : next;
                        })}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${blocked ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 line-through' : picked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-indigo-300'}`}
                      >
                        Day {d}
                        {dayFull ? ' · Full' : seatsLeft !== null && seatsLeft <= 10 ? ` · ${seatsLeft} left` : ''}
                      </button>
                    );
                  })}
                </div>
                {dayAvailability.some((a) => a.capacity - a.taken <= 0) ? (
                  <p className="mt-1.5 text-xs text-amber-600">Some days are fully booked — you'll be registered for the selected days only.</p>
                ) : null}
              </div>
            ) : null}
            {activeRegistration ? (
              <>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${['COMPLETED', 'CHECKED_OUT'].includes(activeRegistration.status) ? 'bg-emerald-600 text-white' : activeRegistration.status === 'PARTIAL_ATTENDANCE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                  {activeRegistration.status === 'COMPLETED' ? <><Check className="h-4 w-4" strokeWidth={3} /> Attendance completed</> : activeRegistration.status.replace(/_/g, ' ')}
                </span>
                {isMultiDay && (activeRegistration.plannedDays ?? []).length ? (
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                    Attending {(activeRegistration.plannedDays ?? []).map((d) => `Day ${d}`).join(', ')}
                  </span>
                ) : null}
                {activeRegistration.status === 'COMPLETED' && event.certificateEnabled ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400"><GraduationCap className="h-4 w-4 shrink-0 text-indigo-500" /> Your certificate will appear in <a href="/my-events" className="text-indigo-600 hover:underline">My events</a> once issued.</span>
                ) : null}
                {/* Cancelling only makes sense before attendance begins. */}
                {['CONFIRMED', 'WAITLISTED', 'PENDING_APPROVAL'].includes(activeRegistration.status) ? (
                  <button onClick={() => setCancelDialogOpen(true)} disabled={busy} className="rounded-2xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 disabled:opacity-50">Cancel Registration</button>
                ) : null}
                {/* Online attendance: self check-in unlocks the meeting link; check-out completes attendance.
                    Multi-day events repeat the cycle each day (status returns to CHECKED_OUT overnight). */}
                {onlineAttendee && eventLive && !checkedInToday && (activeRegistration.status === 'CONFIRMED' || (isMultiDay && ['CHECKED_IN', 'CHECKED_OUT'].includes(activeRegistration.status))) ? (
                  <button onClick={() => void handleSelfCheckIn()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Video className="h-4 w-4" /> Check in (online)</button>
                ) : null}
                {onlineAttendee && eventLive && checkedInToday && !checkedOutToday ? (
                  <>
                    {meetingHref ? (
                      <a href={meetingHref} target="_blank" rel="noreferrer" className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Join meeting →</a>
                    ) : null}
                    <button onClick={() => void handleSelfCheckOut()} disabled={busy} className="rounded-2xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-800 disabled:opacity-50">Check out</button>
                  </>
                ) : null}
              </>
            ) : registrationOpen ? (
              isPaidEvent ? (
                <TicketPurchasePanel
                  quote={ticketQuote}
                  fallbackPriceNgn={event.ticketPrice ?? 0}
                  busy={busy}
                  selTier={selTier}
                  onSelectTier={setSelTier}
                  qty={qty}
                  onQty={setQty}
                  promoInput={promoInput}
                  onPromoInput={setPromoInput}
                  appliedPromo={appliedPromo}
                  onApplyPromo={setAppliedPromo}
                  onBuy={() => void handleBuyTicket()}
                  onCheckPayment={() => void handleCheckPayment()}
                />
              ) : ev.mode === 'HYBRID' ? (
                <>
                  <span className="w-full text-sm font-medium text-slate-600 dark:text-slate-400">How will you attend?</span>
                  <button onClick={() => void handleRegister('PHYSICAL')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><MapPin className="h-4 w-4" /> {ev.registrationPolicy === 'APPROVAL' ? 'Request — In person' : 'Register — In person'}</button>
                  <button onClick={() => void handleRegister('ONLINE')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Video className="h-4 w-4" /> {ev.registrationPolicy === 'APPROVAL' ? 'Request — Online' : 'Register — Online'}</button>
                </>
              ) : (
                <button onClick={() => void handleRegister()} disabled={busy} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{ev.registrationPolicy === 'APPROVAL' ? 'Request to Register' : 'Register'}</button>
              )
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {event.registrationClosed && (event.status === 'PUBLISHED' || event.status === 'CHECK_IN')
                  ? 'The organizers have closed registration for this event.'
                  : 'Registration is closed.'}
              </span>
            )}
            {ev.allowWalkIns && ev.status === 'CHECK_IN' && (!activeRegistration || !checkedInToday) ? (
              <button onClick={() => void handleWalkIn()} disabled={busy} className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 disabled:opacity-50">Check in now (walk-in)</button>
            ) : null}
          </div>
          {notice ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-emerald-700">
              {notice}
              {activeRegistration && event.qrEnabled && !onlineAttendee ? (
                <button
                  onClick={() => document.getElementById('checkin-pass')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white"
                >
                  See your QR pass <ArrowDown className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </p>
          ) : null}
          {actionError ? <p className="mt-3 text-sm text-red-600">{actionError}</p> : null}
        </div>
      </div>

      {activeRegistration && myClaims.length ? <GuestClaimsPanel claims={myClaims} slug={event.slug} /> : null}

      {canManage && isPaidEvent && ticketSales ? <TicketSalesCard sales={ticketSales} /> : null}

      {partnershipInvite ? (
        <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-900"><Handshake className="h-4 w-4 shrink-0" /> Co-host invitation</p>
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
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">About</h2>
          <div className="mt-1">{renderMarkdown(event.description || event.shortDescription || '')}</div>
        </section>
      ) : null}

      {(event.features ?? []).length ? (
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">What to expect</h2>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {(event.features ?? []).map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(event.days ?? []).length ? <EventAgenda event={event} daySpeakers={daySpeakers} /> : null}

      {speakers.length ? (
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Speakers</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {speakers.map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => setSpeakerDetail(s)}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30"
              >
                {s.photo ? <img src={resolveEventImageUrl(s.photo)} alt={s.fullName} className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 dark:bg-slate-950"><Mic className="h-4 w-4 text-slate-400 dark:text-slate-500" /></div>}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                    <span className="truncate">{s.fullName}</span>
                    {s.day ? <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">Day {s.day}</span> : null}
                  </p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{[s.title, s.organization].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-indigo-600">View</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {sponsors.length ? (
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Sponsors</h2>
          <div className="mt-4 flex flex-wrap gap-4">
            {sponsors.map((s) => (
              <div key={s._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{s.name}</div>
            ))}
          </div>
        </section>
      ) : null}

      {coHosts.length || (event.partners ?? []).length ? (
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">In partnership with</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {coHosts.map((c) => (
              <Link key={c.partnershipId} href={`/communities/${encodeURIComponent(c.slug)}`} className="flex items-center gap-2.5 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-2.5 transition hover:border-indigo-300">
                {c.logo ? (
                  <img src={resolveEventImageUrl(c.logo)} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">{c.name.slice(0, 1)}</span>
                )}
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{c.name}</span>
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
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-950 text-sm font-bold text-slate-500 dark:text-slate-400">{p.name.slice(0, 1)}</span>
                  )}
                  <span>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{p.name}</span>
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Partner</span>
                  </span>
                </>
              );
              return p.website ? (
                <a key={`partner-${i}`} href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 transition hover:border-slate-400">
                  {body}
                </a>
              ) : (
                <div key={`partner-${i}`} className="flex items-center gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-2.5">{body}</div>
              );
            })}
          </div>
        </section>
      ) : null}

      {event.sponsorshipOpen && ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'].includes(event.status) ? (
        <SponsorThisEvent event={event} />
      ) : null}

      {canRate ? (
        <RateEventCard
          eventId={event._id}
          slug={slug}
          initial={viewerFeedback}
          onSummary={setRatingSummary}
          onError={setActionError}
        />
      ) : null}

      {canManage && managerFeedback && managerFeedback.count > 0 ? <ManagerFeedbackCard feedback={managerFeedback} /> : null}
      </div>

      {/* ── Right rail ── */}
      <aside className="mt-5 space-y-4 lg:sticky lg:top-20 lg:mt-0 lg:w-[340px] lg:shrink-0 lg:self-start">
        <EventDetailsRail
          event={event}
          isMultiDay={isMultiDay}
          totalDays={totalDays}
          hasPerDayVenues={hasPerDayVenues}
          seats={seats}
          activeRegistration={activeRegistration}
          checkedInToday={checkedInToday}
          meetingHref={meetingHref}
          referralCode={isPaidEvent ? viewerUsername : ''}
          onNotice={setNotice}
          onError={setActionError}
        />

        {event.qrEnabled && !onlineAttendee && activeRegistration && (['CONFIRMED', 'CHECKED_IN'].includes(activeRegistration.status) || (isMultiDay && activeRegistration.status === 'CHECKED_OUT')) ? (
          <CheckinPassCard
            event={event}
            registration={activeRegistration}
            viewerName={viewerName}
            communityName={community?.name ?? ''}
            communityLogo={community?.logo ?? ''}
            isMultiDay={isMultiDay}
            isPaidEvent={isPaidEvent}
            onTransfer={handleTransferTicket}
          />
        ) : null}
      </aside>
      </div>
      </main>

      <CancelRegistrationDialog
        open={cancelDialogOpen}
        title="Cancel your registration?"
        subtitle={isPaidEvent ? 'Note: cancelling does not refund a paid ticket — transfer it to someone else from your QR pass instead if you can\u2019t attend.' : 'Your spot goes back to the pool (the waitlist is promoted automatically).'}
        reasons={STUDENT_CANCEL_REASONS}
        busy={busy}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={(reason) => void handleCancel(reason)}
      />

      {/* Facilitator profile — opens when a speaker card is tapped. */}
      {speakerDetail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`About ${speakerDetail.fullName}`}
          onClick={() => setSpeakerDetail(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-slate-900 px-6 pb-5 pt-6">
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSpeakerDetail(null)}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-4">
                {speakerDetail.photo ? (
                  <img src={resolveEventImageUrl(speakerDetail.photo)} alt={speakerDetail.fullName} className="h-20 w-20 rounded-2xl object-cover shadow-sm" />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-950">
                    <Mic className="h-7 w-7 text-slate-400 dark:text-slate-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
                    <span className="truncate">{speakerDetail.fullName}</span>
                    {speakerDetail.day ? <span className="shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">Day {speakerDetail.day}</span> : null}
                  </p>
                  {speakerDetail.title || speakerDetail.organization ? (
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{[speakerDetail.title, speakerDetail.organization].filter(Boolean).join(' · ')}</p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="space-y-4 px-6 py-5">
              {speakerDetail.bio ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">{speakerDetail.bio}</p>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">The organizers haven&apos;t added a bio for this speaker yet.</p>
              )}
              {speakerDetail.linkedinUrl && /^https?:\/\//i.test(speakerDetail.linkedinUrl) ? (
                <a
                  href={speakerDetail.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950"
                >
                  View LinkedIn profile
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
