'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { getCurrentUser } from '../../../../components/guildos/auth-api';
import { QrScanner, playSuccessFeedback } from '../../../../components/guildos/events/qr-scanner';
import {
  approveRegistration,
  attendanceCheckIn,
  checkInRegistration,
  checkOutRegistration,
  finalizeEventAttendance,
  getEventAnalytics,
  issueEventCertificates,
  listEventRegistrations,
  rejectRegistration,
  type EventAnalytics,
  type EventRegistrationEntry,
} from '../../../../components/guildos/event-api';
import { DashboardShell } from '../../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../../components/guildos/dashboard-topbar';
import { Badge } from '../../../../components/guildos/ui/badge';
import { Button } from '../../../../components/guildos/ui/button';
import { Table } from '../../../../components/guildos/ui/table';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';
import { TableShell } from '../../../../components/guildos/ui/table-shell';

function tone(status: string) {
  if (status === 'COMPLETED' || status === 'CHECKED_OUT') return 'success';
  if (status === 'CHECKED_IN') return 'indigo';
  if (status === 'WAITLISTED' || status === 'PENDING_APPROVAL' || status === 'PARTIAL_ATTENDANCE') return 'warning';
  if (status === 'CANCELLED' || status === 'REJECTED') return 'danger';
  return 'default';
}

export default function EventAttendeesPage() {
  return (
    <Suspense fallback={null}>
      <EventAttendeesPageInner />
    </Suspense>
  );
}

function EventAttendeesPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const eventId = params.get('eventId') ?? '';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<EventRegistrationEntry[]>([]);
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [stationMsg, setStationMsg] = useState('');
  const [stationBusy, setStationBusy] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    if (!eventId) return;
    try {
      setError('');
      const [regs, stats] = await Promise.all([listEventRegistrations(eventId), getEventAnalytics(eventId).catch(() => null)]);
      setRows(regs.registrations);
      setAnalytics(stats?.analytics ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load attendees');
    }
  }

  useEffect(() => {
    void (async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      await load();
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function act(id: string, fn: () => Promise<unknown>) {
    try {
      setBusyId(id);
      setError('');
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId('');
    }
  }

  async function checkInWithToken(token: string) {
    const value = token.trim();
    if (!value) return;
    try {
      setStationBusy(true);
      setStationMsg('');
      const result = await attendanceCheckIn({ token: value });
      setStationMsg(`✅ Checked in: ${result.student || 'success'}`);
      playSuccessFeedback();
      setCode('');
      await load();
    } catch (err) {
      setStationMsg(err instanceof Error ? err.message : 'Unable to check in with this code');
    } finally {
      setStationBusy(false);
    }
  }

  async function handleFinalize() {
    if (!window.confirm('Finalize attendance? Registered students who never checked in will be marked NO_SHOW, and those who never checked out will be marked PARTIAL_ATTENDANCE.')) return;
    try {
      setBusyId('finalize');
      setError('');
      setNotice('');
      const result = await finalizeEventAttendance(eventId);
      setNotice(`Attendance finalized: ${result.noShows} no-show(s), ${result.partials} partial attendance.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to finalize attendance');
    } finally {
      setBusyId('');
    }
  }

  async function handleIssueCertificates() {
    try {
      setBusyId('issue');
      setError('');
      setNotice('');
      const result = await issueEventCertificates(eventId);
      setNotice(`Issued ${result.issued} certificate(s). ${result.totalCertificates} total.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to issue certificates');
    } finally {
      setBusyId('');
    }
  }

  const stats = useMemo(() => {
    const total = rows.filter((r) => r.registration.status !== 'CANCELLED').length;
    const checkedIn = rows.filter((r) => ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'].includes(r.registration.status)).length;
    return { total, checkedIn };
  }, [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter(({ registration, user }) => {
        if (filterStatus && registration.status !== filterStatus) return false;
        if (filterType && registration.registrationType !== filterType) return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = [user?.fullName, user?.email, user?.department, user?.faculty, user?.university].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [rows, filterStatus, filterType, search],
  );

  function csvCell(value: unknown) {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv() {
    const header = ['Name', 'Email', 'Department', 'Faculty', 'University', 'Registration Status', 'Type', 'Check-In Time', 'Check-Out Time'];
    const lines = filteredRows.map(({ registration, user }) => [
      user?.fullName ?? '', user?.email ?? '', user?.department ?? '', user?.faculty ?? '', user?.university ?? '',
      registration.status, registration.registrationType,
      registration.checkInAt ? new Date(registration.checkInAt).toISOString() : '',
      registration.checkOutAt ? new Date(registration.checkOutAt).toISOString() : '',
    ]);
    const csv = [header, ...lines].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendees.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader eyebrow="Events" title="Attendees" subtitle="Manage registrations, check-in and check-out." />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge tone="indigo">{stats.total} registered</Badge>
        <Badge tone="success">{stats.checkedIn} checked-in</Badge>
        <Button variant="primary" onClick={() => void handleIssueCertificates()} disabled={busyId === 'issue'}>Issue Certificates</Button>
        <Button variant="secondary" onClick={() => void handleFinalize()} disabled={busyId === 'finalize'}>Finalize Attendance</Button>
        <Button variant="secondary" onClick={() => router.push('/dashboard/events')}>Back to events</Button>
      </div>

      {analytics ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Registrations" value={analytics.registrationCount} />
          <StatCard label="Confirmed" value={analytics.confirmedCount} />
          <StatCard label="Pending approvals" value={analytics.pendingCount} />
          <StatCard label="Waitlist" value={analytics.waitlistCount} />
          <StatCard label="Walk-ins" value={analytics.walkInCount} />
          <StatCard label="Attendance rate" value={`${analytics.attendanceRate}%`} />
          <StatCard label="Completion rate" value={`${analytics.completionRate}%`} />
          <StatCard label="Avg. duration" value={`${analytics.averageAttendanceDuration}m`} />
        </div>
      ) : null}

      {notice ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Check-In Station</h2>
        <p className="mt-1 text-sm text-slate-500">Scan an attendee&apos;s QR pass, or enter their check-in code.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm outline-none"
            placeholder="Enter check-in code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void checkInWithToken(code); }}
          />
          <Button variant="primary" onClick={() => void checkInWithToken(code)} disabled={stationBusy || !code.trim()}>Check In</Button>
          <Button variant="secondary" onClick={() => setScanning((s) => !s)}>{scanning ? 'Stop Scanner' : 'Scan QR'}</Button>
        </div>
        {scanning ? (
          <QrScanner
            onResult={(value) => { setScanning(false); void checkInWithToken(value); }}
            onClose={() => setScanning(false)}
          />
        ) : null}
        {stationMsg ? <p className="mt-3 text-sm text-slate-700">{stationMsg}</p> : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['PENDING_APPROVAL', 'CONFIRMED', 'WAITLISTED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All types</option>
          {['OPEN', 'APPROVAL', 'INVITE', 'WALK_IN'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <input
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
          placeholder="Search name, email, department, faculty, university"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="secondary" onClick={exportCsv} disabled={!filteredRows.length}>Export CSV</Button>
      </div>

      <TableShell title="Registrations" subtitle="Check attendees in and out to record attendance.">
        <Table>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Attendee</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Attendance</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRows.length ? (
                filteredRows.map(({ registration, user }) => {
                  const rowBusy = busyId === registration._id;
                  return (
                    <tr key={registration._id} className="align-top text-slate-700">
                      <td className="px-6 py-5">
                        <div className="font-medium text-slate-950">{user?.fullName ?? `User ${registration.userId}`}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{[user?.department, user?.email].filter(Boolean).join(' · ')}</div>
                        {registration.registrationType === 'WALK_IN' ? <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Walk-in</span> : null}
                      </td>
                      <td className="px-6 py-5"><Badge tone={tone(registration.status)}>{registration.status.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {registration.checkInAt ? `In: ${new Date(registration.checkInAt).toLocaleTimeString()}` : '—'}
                        {registration.checkOutAt ? ` · Out: ${new Date(registration.checkOutAt).toLocaleTimeString()}` : ''}
                        {registration.attendanceMinutes ? ` · ${registration.attendanceMinutes}m` : ''}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          {registration.status === 'PENDING_APPROVAL' ? (
                            <>
                              <Button variant="primary" onClick={() => void act(registration._id, () => approveRegistration(eventId, registration._id))} disabled={rowBusy}>Approve</Button>
                              <Button variant="ghost" onClick={() => void act(registration._id, () => rejectRegistration(eventId, registration._id))} disabled={rowBusy}>Reject</Button>
                            </>
                          ) : null}
                          {['CONFIRMED', 'WAITLISTED'].includes(registration.status) && !registration.checkInAt ? (
                            <Button variant="primary" onClick={() => void act(registration._id, () => checkInRegistration(eventId, registration._id))} disabled={rowBusy}>Check In</Button>
                          ) : null}
                          {registration.checkInAt && !registration.checkOutAt ? (
                            <Button variant="secondary" onClick={() => void act(registration._id, () => checkOutRegistration(eventId, registration._id))} disabled={rowBusy}>Check Out</Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td className="px-6 py-8 text-sm text-slate-500" colSpan={4}>No registrations yet.</td></tr>
              )}
            </tbody>
          </table>
        </Table>
      </TableShell>
    </DashboardShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
