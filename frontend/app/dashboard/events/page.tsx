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
  listManagedEvents,
  publishEvent,
  setEventStatus,
  setEventRegistrationClosed,
  cancelEventDays,
  messageEventAttendees,
  getEventInviteLink,
  type EventStatus,
  type EventSummary,
} from '../../../components/guildos/event-api';
import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { Badge } from '../../../components/guildos/ui/badge';
import { Button } from '../../../components/guildos/ui/button';
import { Table } from '../../../components/guildos/ui/table';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { TableShell } from '../../../components/guildos/ui/table-shell';

function statusTone(status: EventStatus) {
  if (status === 'PUBLISHED' || status === 'CHECK_IN' || status === 'CHECK_OUT') return 'success';
  if (status === 'DRAFT') return 'warning';
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
        className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
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
                className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-slate-50 ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700'}`}
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
  // Cancel-event modal: the reason is shown to every attendee and on the event page.
  const [cancelTarget, setCancelTarget] = useState<EventSummary | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  // Cancel-a-day modal (multi-day events): pick days + reason; day-scoped tickets refund automatically.
  const [dayCancelTarget, setDayCancelTarget] = useState<EventSummary | null>(null);
  const [dayCancelPicks, setDayCancelPicks] = useState<number[]>([]);
  const [dayCancelReason, setDayCancelReason] = useState('');
  const [dayCancelBusy, setDayCancelBusy] = useState(false);
  // Message-attendees modal: bell + branded email to everyone registered for one event.
  const [messageTarget, setMessageTarget] = useState<EventSummary | null>(null);
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgBusy, setMsgBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

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
      const result = await messageEventAttendees(messageTarget._id, { subject: msgSubject.trim(), message: msgBody.trim() });
      setMessageTarget(null);
      setMsgSubject('');
      setMsgBody('');
      setNotice(`Message sent to ${result.notified} attendee${result.notified === 1 ? '' : 's'}.`);
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
      setNotice('Invite link copied — only people who open it can register.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to copy invite link');
    }
  }

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <LogoSpinner />
        </div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Events"
        title="Event Management"
        subtitle="Create, publish, and run attendance-ready events for your community."
      />

      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <label className="flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:items-center sm:gap-3">
          <span className="font-medium text-slate-900">Community</span>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {communities.length ? (
              communities.map((item) => (
                <option key={item._id} value={item._id}>{item.name}</option>
              ))
            ) : (
              <option value="">No communities</option>
            )}
          </select>
        </label>
        <Button variant="primary" asChild href={selectedId ? `/dashboard/events/create?communityId=${selectedId}` : '/dashboard/events/create'}>
          Create event
        </Button>
      </div>

      {actionError ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div> : null}
      {notice ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      <TableShell title="Events" subtitle="Manage publishing, lifecycle, and attendance.">
        <Table>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Event</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Schedule</th>
                <th className="px-6 py-4 font-medium">Counts</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {listLoading ? (
                <tr><td className="px-6 py-8 text-sm text-slate-500" colSpan={5}>Loading events…</td></tr>
              ) : events.length ? (
                events.map((event) => {
                  const rowBusy = busyId === event._id;
                  return (
                    <tr key={event._id} className="align-top text-slate-700">
                      <td className="px-6 py-5">
                        <div className="font-medium text-slate-950">{event.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{event.type.replace(/_/g, ' ')} · {event.mode}</div>
                      </td>
                      <td className="px-6 py-5"><Badge tone={statusTone(event.status)}>{event.status.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-slate-700">{event.startDate ? new Date(event.startDate).toLocaleDateString() : 'No date'}</div>
                        <div className="mt-1 text-sm text-slate-500">{event.venue || event.meetingLink || '—'}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="grid gap-1 text-xs text-slate-500">
                          <span>Registrations: {event.registrationCount}</span>
                          <span>Checked-in: {event.checkedInCount}</span>
                          <span>Certificates: {event.certificatesIssued}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="secondary" asChild href={`/dashboard/events/create?communityId=${event.communityId}&slug=${event.slug}`}>Edit</Button>
                          {['CHECK_IN', 'CHECK_OUT'].includes(event.status) ? (
                            <Button variant="secondary" asChild href={`/dashboard/events/scanner?eventId=${event._id}`}>Scanner</Button>
                          ) : null}
                          {event.status === 'DRAFT' ? (
                            <Button variant="primary" onClick={() => void runAction(event._id, () => publishEvent(event._id))} disabled={rowBusy}>Publish</Button>
                          ) : null}
                          {event.status === 'PUBLISHED' ? (
                            <Button variant="secondary" onClick={() => void runAction(event._id, () => setEventStatus(event._id, 'CHECK_IN'))} disabled={rowBusy}>Open Check-In</Button>
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
                              ...(event.slug ? [{ label: 'View event page', href: `/events/${event.slug}` }] : []),
                              ...(event.slug && ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'].includes(event.status)
                                ? [{ label: 'Projector', href: `/dashboard/events/projector?slug=${event.slug}` }]
                                : []),
                              ...(['COMPLETED', 'ARCHIVED', 'PUBLISHED', 'CHECK_OUT'].includes(event.status)
                                ? [{ label: 'Run again', onSelect: () => void handleClone(event) }]
                                : []),
                              ...(!['DRAFT', 'ARCHIVED'].includes(event.status) && event.registrationCount > 0
                                ? [{ label: 'Message attendees…', onSelect: () => { setMessageTarget(event); setMsgSubject(''); setMsgBody(''); } }]
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
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td className="px-6 py-8 text-sm text-slate-500" colSpan={5}>No events yet. Create your first event.</td></tr>
              )}
            </tbody>
          </table>
        </Table>
      </TableShell>

      {cancelTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !cancelBusy && setCancelTarget(null)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-950">Cancel “{cancelTarget.title}”?</h2>
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <p className="font-semibold">This cannot be undone. When you cancel:</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                <li>All registrations are cancelled and every attendee is notified with your reason</li>
                {(cancelTarget.ticketPrice ?? 0) > 0 || (cancelTarget.ticketTiers ?? []).length > 0 ? (
                  <li>Ticket buyers are automatically refunded in full — the held earnings for this event go back to them</li>
                ) : null}
                <li>The event page shows it as cancelled with your reason</li>
              </ul>
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">Reason (shown to attendees)</span>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="e.g. The venue became unavailable and we couldn't secure a replacement in time."
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="text-xs text-slate-400">{cancelReason.length}/300</span>
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
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-950">Cancel a day of “{dayCancelTarget.title}”</h2>
            <p className="mt-1 text-sm text-slate-500">The rest of the programme keeps running — everyone who planned these days is notified with your reason.</p>
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
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${already ? 'border-slate-200 bg-slate-50 text-slate-400 line-through' : picked ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-rose-300'}`}
                  >
                    Day {n}{day.date ? ` · ${new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              <ul className="list-disc pl-4">
                <li>Attendees who planned these days get a bell + email with your reason</li>
                <li>Day-only tickets covering just these days are refunded automatically</li>
                <li>Whole-event tickets are NOT refunded — the other days still run</li>
                <li>Check-in is blocked on cancelled days</li>
              </ul>
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">Reason (shown to attendees)</span>
              <textarea
                value={dayCancelReason}
                onChange={(e) => setDayCancelReason(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="e.g. The guest speaker for this day had to withdraw."
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="text-xs text-slate-400">{dayCancelReason.length}/300</span>
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
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-950">Message attendees of “{messageTarget.title}”</h2>
            <p className="mt-1 text-sm text-slate-500">Everyone registered ({messageTarget.registrationCount}) gets an in-app notification and a branded email.</p>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">Subject</span>
              <input
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value.slice(0, 120))}
                placeholder="e.g. Bring your laptop tomorrow"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-slate-700">Message</span>
              <textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value.slice(0, 2000))}
                rows={5}
                placeholder="What do your attendees need to know?"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="text-xs text-slate-400">{msgBody.length}/2000</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMessageTarget(null)} disabled={msgBusy}>Cancel</Button>
              <button
                onClick={() => void handleMessageAttendees()}
                disabled={msgBusy || msgSubject.trim().length < 3 || msgBody.trim().length < 5}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {msgBusy ? 'Sending…' : `Send to ${messageTarget.registrationCount} attendee${messageTarget.registrationCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}