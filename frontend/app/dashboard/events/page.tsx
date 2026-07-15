'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

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

export default function EventsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
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
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" asChild href={`/dashboard/events/create?communityId=${event.communityId}&slug=${event.slug}`}>Edit</Button>
                          <Button variant="secondary" asChild href={`/dashboard/events/attendees?eventId=${event._id}`}>Attendees</Button>
                          {['CHECK_IN', 'CHECK_OUT'].includes(event.status) ? (
                            <Button variant="secondary" asChild href={`/dashboard/events/scanner?eventId=${event._id}`}>Scanner</Button>
                          ) : null}
                          {event.status === 'DRAFT' ? (
                            <Button variant="primary" onClick={() => void runAction(event._id, () => publishEvent(event._id))} disabled={rowBusy}>Publish</Button>
                          ) : null}
                          {event.status === 'PUBLISHED' ? (
                            <Button variant="ghost" onClick={() => void runAction(event._id, () => setEventStatus(event._id, 'CHECK_IN'))} disabled={rowBusy}>Open Check-In</Button>
                          ) : null}
                          {event.status === 'CHECK_IN' ? (
                            <Button variant="ghost" onClick={() => void runAction(event._id, () => setEventStatus(event._id, 'CHECK_OUT'))} disabled={rowBusy}>Open Check-Out</Button>
                          ) : null}
                          {event.status === 'CHECK_OUT' ? (
                            <Button variant="ghost" onClick={() => void runAction(event._id, () => setEventStatus(event._id, 'COMPLETED'))} disabled={rowBusy}>Complete</Button>
                          ) : null}
                          {event.slug ? (
                            <Button variant="ghost" asChild href={`/events/${event.slug}`}>View</Button>
                          ) : null}
                          {event.slug && ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'].includes(event.status) ? (
                            <Button variant="ghost" asChild href={`/dashboard/events/projector?slug=${event.slug}`}>Projector</Button>
                          ) : null}
                          {['COMPLETED', 'ARCHIVED', 'PUBLISHED', 'CHECK_OUT'].includes(event.status) ? (
                            <Button variant="secondary" onClick={() => void handleClone(event)} disabled={rowBusy}>Run again</Button>
                          ) : null}
                          {event.status !== 'ARCHIVED' ? (
                            <Button variant="ghost" onClick={() => void runAction(event._id, () => archiveEvent(event._id))} disabled={rowBusy}>Archive</Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            onClick={() => {
                              void (async () => {
                                if (await confirmDialog({ title: 'Delete this event?', confirmLabel: 'Delete', tone: 'danger' })) {
                                  await runAction(event._id, () => deleteEvent(event._id));
                                }
                              })();
                            }}
                            disabled={rowBusy}
                          >
                            Delete
                          </Button>
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
    </DashboardShell>
  );
}