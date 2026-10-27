'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MoreHorizontal } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../components/guildos/ui/loading';
import { getManagedCommunities, type CommunitySummary } from '../../../components/guildos/community-list-api';
import {
  archiveEvent,
  cloneEvent,
  deleteEvent,
  getCommunityFeedbackInsights,
  listManagedEvents,
  publishEvent,
  announceEvent,
  postponeEvent,
  resumeEvent,
  setEventStatus,
  setEventRegistrationClosed,
  cancelEventDays,
  messageEventAttendees,
  getEventInviteLink,
  createScannerPasses,
  listScannerPasses,
  revokeScannerPass,
  type CommunityFeedbackInsights,
  type ScannerPassEntry,
  type EventStatus,
  type EventSummary,
} from '../../../components/guildos/event-api';
import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { Badge } from '../../../components/guildos/ui/badge';
import { Button } from '../../../components/guildos/ui/button';
import { CommunityPicker } from '../../../components/guildos/dashboard/community-picker';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { statusShareHref } from '../../../components/guildos/status-store';

/** Event statuses the server lets you share as a status card (mirrors SHAREABLE_EVENT_STATUSES). */
const STATUS_SHAREABLE: EventStatus[] = ['ANNOUNCED', 'PUBLISHED', 'POSTPONED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED'];

type EventFilter = 'ALL' | 'UPCOMING' | 'LIVE' | 'DRAFT' | 'PAST';

const EVENT_FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'LIVE', label: 'Live now' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PAST', label: 'Past' },
];

function matchesFilter(status: EventStatus, filter: EventFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'UPCOMING') return ['ANNOUNCED', 'PUBLISHED', 'POSTPONED'].includes(status);
  if (filter === 'LIVE') return status === 'CHECK_IN' || status === 'CHECK_OUT';
  if (filter === 'DRAFT') return status === 'DRAFT';
  return status === 'COMPLETED' || status === 'ARCHIVED';
}

/** Status in organizer words: what attendees can do right now. */
function statusLabel(event: { status: EventStatus; registrationClosed?: boolean }) {
  switch (event.status) {
    case 'DRAFT': return 'Draft';
    case 'ANNOUNCED': return 'Announced';
    case 'PUBLISHED': return event.registrationClosed ? 'Registration closed' : 'Registration open';
    case 'POSTPONED': return 'Postponed';
    case 'CHECK_IN': return 'Check-in open';
    case 'CHECK_OUT': return 'Check-out open';
    case 'COMPLETED': return 'Completed';
    case 'ARCHIVED': return 'Archived';
    default: return String(event.status).replace(/_/g, ' ').toLowerCase();
  }
}

function statusTone(status: EventStatus) {
  if (status === 'PUBLISHED' || status === 'CHECK_IN' || status === 'CHECK_OUT') return 'success';
  if (status === 'DRAFT' || status === 'POSTPONED' || status === 'ANNOUNCED') return 'warning';
  if (status === 'ARCHIVED') return 'danger';
  return 'default';
}

type RowMenuItem = { label: string; href?: string; onSelect?: () => void; danger?: boolean };

/** "⋯" dropdown for secondary row actions. Rendered position:fixed so the table's overflow doesn't clip it. */
function RowActionsMenu({ items, disabled }: { items: RowMenuItem[]; disabled?: boolean }) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });

  function toggle() {
    if (!open) {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        const menuHeight = items.length * 37 + 10; // approx row height + padding
        const right = Math.max(8, window.innerWidth - rect.right);
        // Flip upward (over the row) when there isn't enough room below.
        if (rect.bottom + menuHeight + 12 > window.innerHeight) {
          setPos({ bottom: window.innerHeight - rect.top + 6, right });
        } else {
          setPos({ top: rect.bottom + 6, right });
        }
      }
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 disabled:opacity-50"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-44 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 shadow-lg"
            style={{ top: pos.top, bottom: pos.bottom, right: pos.right }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (item.href) router.push(item.href);
                  else item.onSelect?.();
                }}
                className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${item.danger ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10' : 'text-slate-700 dark:text-slate-300'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

export default function EventsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [listFilter, setListFilter] = useState<EventFilter>('ALL');
  const visibleEvents = events.filter((e) => matchesFilter(e.status, listFilter));
  // Cancel-event modal: the reason is shown to every attendee and on the event page.
  const [cancelTarget, setCancelTarget] = useState<EventSummary | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  // Cancel-a-day modal (multi-day events): pick days + reason; day-scoped tickets refund automatically.
  const [dayCancelTarget, setDayCancelTarget] = useState<EventSummary | null>(null);
  const [dayCancelPicks, setDayCancelPicks] = useState<number[]>([]);
  const [dayCancelReason, setDayCancelReason] = useState('');
  const [dayCancelBusy, setDayCancelBusy] = useState(false);
  // AI feedback insights across the selected community's events.
  const [insights, setInsights] = useState<CommunityFeedbackInsights | null>(null);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  // Postpone modal: freezes the event without refunds; attendees are notified.
  const [postponeTarget, setPostponeTarget] = useState<EventSummary | null>(null);
  const [postponeNote, setPostponeNote] = useState('');
  const [postponeBusy, setPostponeBusy] = useState(false);
  // Message-attendees modal: bell + branded email to everyone registered for one event.
  const [messageTarget, setMessageTarget] = useState<EventSummary | null>(null);
  const [msgSubject, setMsgSubject] = useState('');
  const [msgSection, setMsgSection] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgBusy, setMsgBusy] = useState(false);
  // Door-scanner passes modal: single-device links for gate helpers.
  const [scannerTarget, setScannerTarget] = useState<EventSummary | null>(null);
  const [scannerPasses, setScannerPasses] = useState<ScannerPassEntry[]>([]);
  const [scannerBusy, setScannerBusy] = useState(false);
  const [copiedPass, setCopiedPass] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  // Action feedback renders as floating toasts — auto-dismiss so they never linger stale.
  useEffect(() => {
    if (!actionError && !notice) return;
    const t = setTimeout(() => {
      setActionError('');
      setNotice('');
    }, 8000);
    return () => clearTimeout(t);
  }, [actionError, notice]);

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        const response = await getManagedCommunities();
        setCommunities(response.communities);
        if (response.communities.length) setSelectedId(response.communities[0]._id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load communities');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [router]);

  async function loadEvents(communityId: string) {
    if (!communityId) return;
    try {
      setListLoading(true);
      setActionError('');
      const response = await listManagedEvents(communityId);
      setEvents(response.events);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to load events');
      setEvents([]);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    if (selectedId) void loadEvents(selectedId);
  }, [selectedId]);

  async function runAction(id: string, action: () => Promise<unknown>) {
    try {
      setBusyId(id);
      setActionError('');
      await action();
      await loadEvents(selectedId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId('');
    }
  }

  /** "Run it again" — clone into a fresh draft and jump straight into editing it. */
  async function handleClone(event: { _id: string; communityId: string }) {
    try {
      setBusyId(event._id);
      setActionError('');
      const { event: draft } = await cloneEvent(event._id);
      router.push(`/dashboard/events/create?communityId=${event.communityId}&slug=${draft.slug}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to clone event');
      setBusyId('');
    }
  }

  async function handleCancelEvent() {
    if (!cancelTarget || !cancelReason.trim()) return;
    try {
      setCancelBusy(true);
      setActionError('');
      await archiveEvent(cancelTarget._id, cancelReason.trim());
      setCancelTarget(null);
      setCancelReason('');
      await loadEvents(selectedId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to cancel event');
    } finally {
      setCancelBusy(false);
    }
  }

  async function handleCancelDays() {
    if (!dayCancelTarget || !dayCancelPicks.length || dayCancelReason.trim().length < 5) return;
    try {
      setDayCancelBusy(true);
      setActionError('');
      await cancelEventDays(dayCancelTarget._id, dayCancelPicks, dayCancelReason.trim());
      setDayCancelTarget(null);
      setDayCancelPicks([]);
      setDayCancelReason('');
      await loadEvents(selectedId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to cancel event days');
    } finally {
      setDayCancelBusy(false);
    }
  }

  async function handleMessageAttendees() {
    if (!messageTarget || msgSubject.trim().length < 3 || msgBody.trim().length < 5) return;
    try {
      setMsgBusy(true);
      setActionError('');
      const result = await messageEventAttendees(messageTarget._id, { subject: msgSubject.trim(), message: msgBody.trim(), sectionKey: msgSection || undefined });
      setMessageTarget(null);
      setMsgSubject('');
      setMsgBody('');
      setMsgSection('');
      setNotice(`Message sent to ${result.notified} attendee${result.notified === 1 ? '' : 's'}${result.section ? ` in ${result.section}` : ''}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to message attendees');
    } finally {
      setMsgBusy(false);
    }
  }

  async function handleCopyInviteLink(event: EventSummary) {
    try {
      setActionError('');
      const { inviteToken, slug } = await getEventInviteLink(event._id);
      const link = `${window.location.origin}/events/${slug}?invite=${inviteToken}`;
      await navigator.clipboard.writeText(link);
      setNotice('Invite link copied. Only people who open it can register.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to copy invite link');
    }
  }

  async function handleCopyScannerLink(event: EventSummary) {
    try {
      setActionError('');
      setScannerTarget(event);
      setScannerBusy(true);
      const { passes } = await listScannerPasses(event._id);
      setScannerPasses(passes);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to load scanner links');
      setScannerTarget(null);
    } finally {
      setScannerBusy(false);
    }
  }

  async function handleAddScannerPasses(count: number) {
    if (!scannerTarget) return;
    try {
      setScannerBusy(true);
      setActionError('');
      await createScannerPasses(scannerTarget._id, count);
      const { passes } = await listScannerPasses(scannerTarget._id);
      setScannerPasses(passes);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create scanner links');
    } finally {
      setScannerBusy(false);
    }
  }

  async function handleRevokeScannerPass(passId: string) {
    if (!scannerTarget) return;
    try {
      setScannerBusy(true);
      setActionError('');
      await revokeScannerPass(scannerTarget._id, passId);
      setScannerPasses((prev) => prev.filter((p) => p.id !== passId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to revoke scanner link');
    } finally {
      setScannerBusy(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 shadow-sm">
          <LogoSpinner />
        </div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Events"
        title="Events"
        subtitle="Publish, run check-in, and follow up with reports and certificates."
        action={
          <Button variant="primary" asChild href={selectedId ? `/dashboard/events/create?communityId=${selectedId}` : '/dashboard/events/create'}>
            Create event
          </Button>
        }
        toolbar={<CommunityPicker communities={communities} value={selectedId} onChange={setSelectedId} />}
      />

      {actionError ? (
        <div className="fixed inset-x-4 bottom-24 z-[100] mx-auto flex max-w-xl items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg dark:border-red-500/30 dark:bg-red-950 dark:text-red-300" role="alert">
          <span className="flex-1">{actionError}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setActionError('')} className="shrink-0 rounded-lg px-1.5 text-base font-semibold leading-none transition hover:bg-red-100 dark:hover:bg-red-500/20">×</button>
        </div>
      ) : null}
      {notice ? (
        <div className="fixed inset-x-4 bottom-24 z-[100] mx-auto flex max-w-xl items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-lg dark:border-emerald-500/30 dark:bg-emerald-950 dark:text-emerald-300" role="status">
          <span className="flex-1">{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice('')} className="shrink-0 rounded-lg px-1.5 text-base font-semibold leading-none transition hover:bg-emerald-100 dark:hover:bg-emerald-500/20">×</button>
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800 dark:border-slate-800">
          {EVENT_FILTERS.map((option) => {
            const count = events.filter((e) => matchesFilter(e.status, option.key)).length;
            const active = listFilter === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setListFilter(option.key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium transition ${active ? 'border-slate-900 text-slate-950 dark:border-white dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
              >
                {option.label}
                <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/20 dark:bg-slate-900/10' : 'bg-slate-100 dark:bg-slate-800'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {listLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>
        ) : !events.length ? (
          <div className="p-10 text-center">
            <p className="font-medium text-slate-900 dark:text-white">No events yet</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create your first event: set a date, open registration, and check people in with QR passes.</p>
            <Button variant="primary" className="mt-4" asChild href={selectedId ? `/dashboard/events/create?communityId=${selectedId}` : '/dashboard/events/create'}>Create event</Button>
          </div>
        ) : !visibleEvents.length ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Nothing in this view.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleEvents.map((event) => {
              const rowBusy = busyId === event._id;
              const start = event.startDate ? new Date(event.startDate) : null;
              const rate = event.registrationCount ? Math.round((event.checkedInCount / event.registrationCount) * 100) : 0;
              const tracks = (event.sections ?? []).length;
              return (
                <li key={event._id} className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-slate-50 py-1.5 text-center dark:bg-slate-950">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">{start ? start.toLocaleDateString('en-NG', { month: 'short' }) : 'TBA'}</span>
                      <span className="text-lg font-bold leading-none text-slate-900 dark:text-slate-100">{start ? start.getDate() : '–'}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {event.slug ? (
                          <a href={`/events/${event.slug}`} className="truncate font-semibold text-slate-950 hover:text-indigo-700 dark:text-white dark:hover:text-indigo-300">{event.title}</a>
                        ) : (
                          <span className="truncate font-semibold text-slate-950 dark:text-white">{event.title}</span>
                        )}
                        <Badge tone={statusTone(event.status)}>{statusLabel(event)}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {[event.type.replace(/_/g, ' ').toLowerCase(), event.mode.toLowerCase(), tracks ? `${tracks} track${tracks === 1 ? '' : 's'}` : '', event.venue || (event.meetingLink ? 'Online' : 'Venue TBA')].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 text-xs text-slate-500 dark:text-slate-400">
                    {event.registrationCount ? (
                      <>
                        <div className="flex justify-between gap-2">
                          <span><span className="font-semibold text-slate-800 dark:text-slate-200">{event.checkedInCount}</span> of {event.registrationCount} checked in</span>
                          <span className="tabular-nums">{rate}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(rate, 2)}%` }} />
                        </div>
                        {event.certificatesIssued ? <p className="mt-1">{event.certificatesIssued} certificate{event.certificatesIssued === 1 ? '' : 's'} sent</p> : null}
                      </>
                    ) : (
                      <span>No registrations yet</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" asChild href={`/dashboard/events/create?communityId=${event.communityId}&slug=${event.slug}`}>Edit</Button>
                    {['CHECK_IN', 'CHECK_OUT'].includes(event.status) ? (
                      <Button variant="secondary" asChild href={`/dashboard/events/scanner?eventId=${event._id}`}>Scanner</Button>
                    ) : null}
                    {event.status === 'DRAFT' ? (
                      <Button variant="primary" onClick={() => void runAction(event._id, () => publishEvent(event._id))} disabled={rowBusy}>Publish</Button>
                    ) : null}
                    {event.status === 'DRAFT' ? (
                      <Button variant="secondary" onClick={() => void runAction(event._id, () => announceEvent(event._id))} disabled={rowBusy} title="Go public for anticipation now; open registration later">Announce</Button>
                    ) : null}
                    {event.status === 'ANNOUNCED' ? (
                      <Button variant="primary" onClick={() => void runAction(event._id, () => publishEvent(event._id))} disabled={rowBusy} title="Everyone anticipating is notified that registration is open">Open Registration</Button>
                    ) : null}
                    {event.status === 'PUBLISHED' ? (
                      <Button variant="secondary" onClick={() => void runAction(event._id, () => setEventStatus(event._id, 'CHECK_IN'))} disabled={rowBusy}>Open Check-In</Button>
                    ) : null}
                    {event.status === 'POSTPONED' ? (
                      <Button variant="primary" onClick={() => void runAction(event._id, () => resumeEvent(event._id))} disabled={rowBusy} title="Set the new date via Edit first, then republish">Republish</Button>
                    ) : null}
                    {event.status === 'CHECK_IN' ? (
                      <Button variant="secondary" onClick={() => void runAction(event._id, () => setEventStatus(event._id, 'CHECK_OUT'))} disabled={rowBusy}>Open Check-Out</Button>
                    ) : null}
                    {event.status === 'CHECK_OUT' ? (
                      <Button variant="secondary" onClick={() => void runAction(event._id, () => setEventStatus(event._id, 'COMPLETED'))} disabled={rowBusy}>Complete</Button>
                    ) : null}
                    {['COMPLETED', 'ARCHIVED', 'CHECK_OUT'].includes(event.status) ? (
                      <Button variant="secondary" asChild href={`/dashboard/events/attendees?eventId=${event._id}`}>Report</Button>
                    ) : null}
                    <RowActionsMenu
                      disabled={rowBusy}
                      items={[
                        ...(!['COMPLETED', 'ARCHIVED', 'CHECK_OUT'].includes(event.status)
                          ? [{ label: 'Attendees', href: `/dashboard/events/attendees?eventId=${event._id}` }]
                          : []),
                        ...(event.type === 'HACKATHON' ? [{ label: 'Hackathon: teams, judging & results', href: `/dashboard/events/hackathon?event=${event._id}` }] : []),
                        ...(event.slug ? [{ label: 'View event page', href: `/events/${event.slug}` }] : []),
                        // Same rule as the server's event card: public and past the draft stage.
                        ...(event.slug && event.visibility === 'PUBLIC' && STATUS_SHAREABLE.includes(event.status)
                          ? [{ label: 'Share to status', href: statusShareHref({ attach: { type: 'EVENT', id: event.slug }, asCommunity: event.communityId }) }]
                          : []),
                        ...(event.slug && ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'].includes(event.status)
                          ? [{ label: 'Projector', href: `/dashboard/events/projector?slug=${event.slug}` }]
                          : []),
                        ...(['COMPLETED', 'ARCHIVED', 'PUBLISHED', 'CHECK_OUT'].includes(event.status)
                          ? [{ label: 'Run again', onSelect: () => void handleClone(event) }]
                          : []),
                        ...(['PUBLISHED', 'CHECK_IN'].includes(event.status)
                          ? [{ label: 'Postpone…', onSelect: () => { setPostponeTarget(event); setPostponeNote(''); } }]
                          : []),
                        ...(['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'].includes(event.status)
                          ? [{ label: 'Door scanners…', onSelect: () => void handleCopyScannerLink(event) }]
                          : []),
                        ...(!['DRAFT', 'ARCHIVED'].includes(event.status) && event.registrationCount > 0
                          ? [{ label: 'Message attendees…', onSelect: () => { setMessageTarget(event); setMsgSubject(''); setMsgBody(''); setMsgSection(''); } }]
                          : []),
                        ...(event.registrationPolicy === 'INVITE' && !['DRAFT', 'ARCHIVED'].includes(event.status)
                          ? [{ label: 'Copy invite link', onSelect: () => void handleCopyInviteLink(event) }]
                          : []),
                        ...(['PUBLISHED', 'CHECK_IN'].includes(event.status)
                          ? [{
                              label: event.registrationClosed ? 'Reopen registration' : 'Close registration',
                              onSelect: () => void runAction(event._id, () => setEventRegistrationClosed(event._id, !event.registrationClosed)),
                            }]
                          : []),
                        ...(['PUBLISHED', 'CHECK_IN'].includes(event.status) && (event.days ?? []).length > 1
                          ? [{ label: 'Cancel a day…', danger: true, onSelect: () => { setDayCancelTarget(event); setDayCancelPicks([]); setDayCancelReason(''); } }]
                          : []),
                        ...(['PUBLISHED', 'CHECK_IN'].includes(event.status)
                          ? [{ label: 'Cancel event…', danger: true, onSelect: () => setCancelTarget(event) }]
                          : []),
                        ...(event.status !== 'ARCHIVED' && !['PUBLISHED', 'CHECK_IN'].includes(event.status)
                          ? [{ label: 'Archive', onSelect: () => void runAction(event._id, () => archiveEvent(event._id)) }]
                          : []),
                        {
                          label: 'Delete',
                          danger: true,
                          onSelect: () => {
                            void (async () => {
                              const hasBuyers = ['PUBLISHED', 'CHECK_IN'].includes(event.status) && event.registrationCount > 0;
                              if (hasBuyers) {
                                // Live events with attendees go through the cancel flow so people get told why.
                                setCancelTarget(event);
                                return;
                              }
                              if (await confirmDialog({ title: 'Delete this event?', confirmLabel: 'Delete', tone: 'danger' })) {
                                await runAction(event._id, () => deleteEvent(event._id));
                              }
                            })();
                          },
                        },
                      ]}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* AI planning brief — digest of all attendee feedback for the next event. */}
      <div className="mt-6 rounded-xl border border-indigo-200 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Plan the next event with AI</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Summarizes every attendee rating and comment across your past events: what worked, what to fix and what to try next.</p>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              if (!selectedId) return;
              setInsightsBusy(true);
              setInsightsError('');
              getCommunityFeedbackInsights(selectedId)
                .then(setInsights)
                .catch((err) => setInsightsError(err instanceof Error ? err.message : 'Unable to build insights'))
                .finally(() => setInsightsBusy(false));
            }}
            disabled={!selectedId || insightsBusy}
          >
            {insightsBusy ? 'Analyzing feedback…' : insights ? 'Refresh insights' : 'Summarize feedback'}
          </Button>
        </div>
        {insightsError ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{insightsError}</p> : null}
        {insights ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="font-semibold text-slate-900 dark:text-slate-100">★ {insights.averageRating.toFixed(1)} <span className="font-normal text-slate-500 dark:text-slate-400">avg across {insights.ratedEvents} rated event{insights.ratedEvents === 1 ? '' : 's'} ({insights.totalRatings} ratings)</span></span>
              {insights.trend ? (
                <span className={`font-semibold ${insights.trend.recent >= insights.trend.earlier ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {insights.trend.recent >= insights.trend.earlier ? '↗' : '↘'} {insights.trend.earlier.toFixed(1)} → {insights.trend.recent.toFixed(1)}
                  <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">recent trend</span>
                </span>
              ) : null}
            </div>
            {insights.insights ? (
              <>
                <p className="text-sm text-slate-700 dark:text-slate-300">{insights.insights.summary}</p>
                <div className="grid gap-4 md:grid-cols-3">
                  {([
                    { title: 'What went well', items: insights.insights.wentWell, tone: 'text-emerald-700' },
                    { title: 'What to improve', items: insights.insights.improvements, tone: 'text-amber-700' },
                    { title: 'Try next time', items: insights.insights.suggestions, tone: 'text-indigo-700' },
                  ] as const).map((col) => (
                    <div key={col.title} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${col.tone}`}>{col.title}</p>
                      <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                        {col.items.length ? col.items.map((item, i) => <li key={i} className="flex gap-1.5"><span>•</span>{item}</li>) : <li>Nothing yet</li>}
                      </ul>
                    </div>
                  ))}
                </div>
                {insights.insights.nextEventOutlook ? (
                  <p className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-sm text-indigo-900"><span className="font-semibold">Outlook:</span> {insights.insights.nextEventOutlook}</p>
                ) : null}
              </>
            ) : insights.totalRatings === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No attendee ratings yet. Insights appear after your first rated event.</p>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">AI is not configured on this server, so only stats are shown.</p>
            )}
          </div>
        ) : null}
      </div>

      {postponeTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !postponeBusy && setPostponeTarget(null)}>
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Postpone “{postponeTarget.title}”?</h2>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300">
              <ul className="list-disc pl-5 text-xs">
                <li>Registrations and tickets stay valid, and nothing is refunded</li>
                <li>Sign-ups pause until you set a new date and republish</li>
                <li>Every registrant is notified that a new date is coming</li>
              </ul>
            </div>
            <textarea
              className="mt-3 min-h-20 w-full rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm"
              placeholder="Note to attendees (optional), e.g. why, or when to expect the new date"
              value={postponeNote}
              onChange={(e) => setPostponeNote(e.target.value.slice(0, 300))}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPostponeTarget(null)} disabled={postponeBusy}>Keep it live</Button>
              <Button
                variant="primary"
                disabled={postponeBusy}
                onClick={() => {
                  void (async () => {
                    if (!postponeTarget) return;
                    try {
                      setPostponeBusy(true);
                      await postponeEvent(postponeTarget._id, postponeNote);
                      setPostponeTarget(null);
                      await loadEvents(selectedId);
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : 'Unable to postpone event');
                    } finally {
                      setPostponeBusy(false);
                    }
                  })();
                }}
              >
                {postponeBusy ? 'Postponing…' : 'Postpone event'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !cancelBusy && setCancelTarget(null)}>
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Cancel “{cancelTarget.title}”?</h2>
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300">
              <p className="font-semibold">This cannot be undone. When you cancel:</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                <li>All registrations are cancelled and every attendee is notified with your reason</li>
                {(cancelTarget.ticketPrice ?? 0) > 0 || (cancelTarget.ticketTiers ?? []).length > 0 ? (
                  <li>Ticket buyers are automatically refunded in full. The held earnings for this event go back to them</li>
                ) : null}
                <li>The event page shows it as cancelled with your reason</li>
              </ul>
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Reason (shown to attendees)</span>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="e.g. The venue became unavailable and we couldn't secure a replacement in time."
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500">{cancelReason.length}/300</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCancelTarget(null)} disabled={cancelBusy}>Keep event</Button>
              <button
                onClick={() => void handleCancelEvent()}
                disabled={cancelBusy || cancelReason.trim().length < 5}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {cancelBusy ? 'Cancelling…' : 'Cancel event'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dayCancelTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !dayCancelBusy && setDayCancelTarget(null)}>
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Cancel a day of “{dayCancelTarget.title}”</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The rest of the programme keeps running. Everyone who planned these days is notified with your reason.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(dayCancelTarget.days ?? []).map((day, i) => {
                const n = i + 1;
                const already = Boolean(day.cancelled);
                const picked = dayCancelPicks.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={already}
                    title={already ? 'Already cancelled' : day.theme || undefined}
                    onClick={() => setDayCancelPicks((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)))}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${already ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 line-through' : picked ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-rose-300'}`}
                  >
                    Day {n}{day.date ? ` · ${new Date(day.date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}` : ''}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300">
              <ul className="list-disc pl-4">
                <li>Attendees who planned these days get a bell + email with your reason</li>
                <li>Day-only tickets covering just these days are refunded automatically</li>
                <li>Tickets covering these AND other days get a proportional partial refund, and the ticket stays valid for the rest</li>
                <li>Whole-event tickets are NOT refunded, because the other days still run</li>
                <li>Check-in is blocked on cancelled days</li>
              </ul>
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Reason (shown to attendees)</span>
              <textarea
                value={dayCancelReason}
                onChange={(e) => setDayCancelReason(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="e.g. The guest speaker for this day had to withdraw."
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500">{dayCancelReason.length}/300</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDayCancelTarget(null)} disabled={dayCancelBusy}>Keep all days</Button>
              <button
                onClick={() => void handleCancelDays()}
                disabled={dayCancelBusy || !dayCancelPicks.length || dayCancelReason.trim().length < 5}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {dayCancelBusy ? 'Cancelling…' : `Cancel ${dayCancelPicks.length === 1 ? `Day ${dayCancelPicks[0]}` : `${dayCancelPicks.length} days`}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {messageTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !msgBusy && setMessageTarget(null)}>
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Message attendees of “{messageTarget.title}”</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {msgSection ? 'Only the selected section gets it' : `Everyone registered (${messageTarget.registrationCount})`} gets an in-app notification and a branded email.
            </p>
            {(messageTarget.sections ?? []).length ? (
              <label className="mt-4 block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Audience</span>
                <select
                  value={msgSection}
                  onChange={(e) => setMsgSection(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  <option value="">All attendees</option>
                  {(messageTarget.sections ?? []).map((s) => (
                    <option key={s.key} value={s.key}>{s.name} section only</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Subject</span>
              <input
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value.slice(0, 120))}
                placeholder="e.g. Bring your laptop tomorrow"
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Message</span>
              <textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value.slice(0, 2000))}
                rows={5}
                placeholder="What do your attendees need to know?"
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500">{msgBody.length}/2000</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMessageTarget(null)} disabled={msgBusy}>Cancel</Button>
              <button
                onClick={() => void handleMessageAttendees()}
                disabled={msgBusy || msgSubject.trim().length < 3 || msgBody.trim().length < 5}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {msgBusy ? 'Sending…' : msgSection
                  ? `Send to ${(messageTarget.sections ?? []).find((s) => s.key === msgSection)?.name ?? 'section'}`
                  : `Send to ${messageTarget.registrationCount} attendee${messageTarget.registrationCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {scannerTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !scannerBusy && setScannerTarget(null)}>
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Door scanners: “{scannerTarget.title}”</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Each link is for <span className="font-semibold text-slate-700 dark:text-slate-300">one helper</span>. The first phone that opens it claims it, and it stops working on any other device. No GuildOS account needed. Links only scan while check-in is open.
            </p>
            <div className="mt-4 space-y-2">
              {scannerPasses.length ? scannerPasses.map((pass) => (
                <div key={pass.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{pass.label}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {pass.claimed ? `In use since ${pass.claimedAt ? new Date(pass.claimedAt).toLocaleString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}` : 'Not opened yet'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(`${window.location.origin}/scan/${pass.token}`);
                        setCopiedPass(pass.id);
                        setTimeout(() => setCopiedPass(''), 2000);
                      }}
                      className="rounded-lg border border-indigo-300 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                    >
                      {copiedPass === pass.id ? 'Copied ✓' : 'Copy link'}
                    </button>
                    <button
                      onClick={() => void handleRevokeScannerPass(pass.id)}
                      disabled={scannerBusy}
                      className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              )) : (
                <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  No scanner links yet. Create one per gate helper below.
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button onClick={() => void handleAddScannerPasses(1)} disabled={scannerBusy || scannerPasses.length >= 10} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">+ Add 1</button>
                <button onClick={() => void handleAddScannerPasses(3)} disabled={scannerBusy || scannerPasses.length > 7} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-50">+ Add 3</button>
                <button onClick={() => void handleAddScannerPasses(6)} disabled={scannerBusy || scannerPasses.length > 4} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-50">+ Add 6</button>
              </div>
              <Button variant="ghost" onClick={() => setScannerTarget(null)} disabled={scannerBusy}>Done</Button>
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Max 10 links per event. Revoke a link and it dies instantly on the helper’s phone.</p>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}