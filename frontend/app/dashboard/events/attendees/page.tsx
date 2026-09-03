'use client';

import { confirmDialog } from '../../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../../components/guildos/ui/loading';
import { SelectMenu } from '../../../../components/guildos/ui/select-menu';

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
  organizerCancelRegistration,
  sendEventAppreciation,
  type AppreciationDesign,
  type EventAnalytics,
  type EventRegistrationEntry,
} from '../../../../components/guildos/event-api';
import { CancelRegistrationDialog, ORGANIZER_CANCEL_REASONS } from '../../../../components/guildos/events/cancel-registration-dialog';
import { DashboardShell } from '../../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../../components/guildos/dashboard-topbar';
import { navigateBack } from '../../../../components/guildos/back-navigation';
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
  const [eventSections, setEventSections] = useState<{ key: string; name: string }[]>([]);
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  // Which registration the organizer is removing ('' = dialog closed). Reason required; paid tickets auto-refund.
  const [cancelTarget, setCancelTarget] = useState('');
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [stationMsg, setStationMsg] = useState('');
  const [stationBusy, setStationBusy] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [search, setSearch] = useState('');
  const [designerOpen, setDesignerOpen] = useState(false);

  async function load() {
    if (!eventId) return;
    try {
      setError('');
      const [regs, stats] = await Promise.all([listEventRegistrations(eventId), getEventAnalytics(eventId).catch(() => null)]);
      setRows(regs.registrations);
      setEventSections(regs.sections ?? []);
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
        setStationMsg(`Checked in: ${result.student || 'success'}${result.section ? ` → ${result.section.name}${result.section.venue ? ` (${result.section.venue})` : ''}` : ''}`);
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
    if (!(await confirmDialog({ title: 'Finalize attendance?', message: 'Registered students who never checked in will be marked NO_SHOW, and those who never checked out will be marked PARTIAL_ATTENDANCE.', confirmLabel: 'Finalize' }))) return;
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

  async function handleAppreciation() {
    setDesignerOpen(true);
  }

  async function sendDesignedAppreciation(design: AppreciationDesign) {
    try {
      setBusyId('appreciation');
      setError('');
      setNotice('');
      const result = await sendEventAppreciation(eventId, design);
      setDesignerOpen(false);
      setNotice(`Appreciation sent — ${result.emailed} email(s) and ${result.notified} in-app notification(s) to ${result.attendees} attendee(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send appreciation');
      setDesignerOpen(false);
    } finally {
      setBusyId('');
    }
  }

  async function handleIssueCertificates() {
    let autoSent = false;
    try {
      setBusyId('issue');
      setError('');
      setNotice('');
      const result = await issueEventCertificates(eventId);
      autoSent = Boolean(result.appreciationSent);
      setNotice(`Issued ${result.issued} certificate(s). ${result.totalCertificates} total.${autoSent ? ' Appreciation email sent automatically.' : ''}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to issue certificates');
      return;
    } finally {
      setBusyId('');
    }
    // Pair issuance with appreciation when it hasn't gone out yet (AUTO events
    // send it above; CUSTOM/OFF organizers get offered the designer).
    if (autoSent) return;
    const alsoThank = await confirmDialog({
      title: 'Certificates issued',
      message: 'Want to design an appreciation email for everyone who attended while you are at it?',
        confirmLabel: 'Design appreciation',
      cancelLabel: 'Not now',
    });
    if (alsoThank) await handleAppreciation();
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
        if (filterSection && registration.sectionKey !== filterSection) return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = [user?.fullName, user?.email, user?.department, user?.faculty, user?.university].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [rows, filterStatus, filterType, filterSection, search],
  );

  function csvCell(value: unknown) {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  /** Days an attendee actually showed up (multi-day = distinct days with a check-in). */
  function daysAttendedOf(reg: EventRegistrationEntry['registration']) {
    const perDay = (reg.attendanceDays ?? []).filter((d) => d.checkInAt).length;
    if (perDay) return perDay;
    return reg.checkInAt ? 1 : 0;
  }

  /** Friendly section name for a registration ('' when the event has no sections). */
  function sectionNameOf(reg: EventRegistrationEntry['registration']) {
    if (!reg.sectionKey) return '';
    return eventSections.find((s) => s.key === reg.sectionKey)?.name ?? reg.sectionKey;
  }

  // Custom registration questions answered by anyone in the roster (first-seen order).
  const answerColumns = (() => {
    const seen = new Map<string, string>();
    for (const { registration } of rows) {
      for (const a of registration.answers ?? []) {
        if (!seen.has(a.key)) seen.set(a.key, a.label);
      }
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  })();
  const answerOf = (reg: EventRegistrationEntry['registration'], key: string) =>
    (reg.answers ?? []).find((a) => a.key === key)?.value ?? '';

  function exportCsv() {
    // How many agenda days the event spans (0/1 = single-day → hide the column).
    const totalDays = Math.max(
      0,
      ...filteredRows.map((r) => (r.registration.attendanceDays ?? []).length),
      ...filteredRows.map((r) => Math.max(0, ...(r.registration.plannedDays ?? []))),
    );
    const multiDay = totalDays > 1;

    // Summary block (event totals) above the roster.
    const summary: string[][] = [
      ['Attendance report'],
      ['Generated', new Date().toLocaleString('en-NG')],
    ];
    if (analytics) {
      summary.push(
        ['Registrations', String(analytics.registrationCount)],
        ['Confirmed', String(analytics.confirmedCount)],
        ['Walk-ins', String(analytics.walkInCount)],
        ['Checked in', String(analytics.checkedInCount)],
        ['Completed', String(analytics.completedCount)],
        ['Attendance rate', `${analytics.attendanceRate}%`],
        ['Completion rate', `${analytics.completionRate}%`],
        ['Avg. duration (min)', String(analytics.averageAttendanceDuration)],
      );
    }
    if (multiDay) summary.push(['Event days', String(totalDays)]);

    const header = [
      'Name', 'Email', 'Department', 'Faculty', 'University',
      'Registration Status', 'Type', ...(eventSections.length ? ['Section'] : []), 'Check-In Time', 'Check-Out Time',
      'Attendance (min)', ...(multiDay ? ['Days Attended'] : []), 'Certificate Eligible',
      ...answerColumns.map((c) => c.label),
    ];
    const lines = filteredRows.map(({ registration, user }) => [
      user?.fullName ?? '', user?.email ?? '', user?.department ?? '', user?.faculty ?? '', user?.university ?? '',
      registration.status, registration.registrationType,
      ...(eventSections.length ? [sectionNameOf(registration)] : []),
      registration.checkInAt ? new Date(registration.checkInAt).toLocaleString('en-NG') : '',
      registration.checkOutAt ? new Date(registration.checkOutAt).toLocaleString('en-NG') : '',
      String(registration.attendanceMinutes ?? 0),
      ...(multiDay ? [`${daysAttendedOf(registration)} of ${totalDays}`] : []),
      registration.certificateEligible ? 'Yes' : 'No',
      ...answerColumns.map((c) => answerOf(registration, c.key)),
    ]);

    const csv = [...summary, [], header, ...lines].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 shadow-sm">
          <LogoSpinner />
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
        <Button variant="secondary" onClick={() => void handleAppreciation()} disabled={busyId === 'appreciation'}>{busyId === 'appreciation' ? 'Sending…' : 'Send Appreciation'}</Button>
        <Button variant="secondary" onClick={() => void handleFinalize()} disabled={busyId === 'finalize'}>Finalize Attendance</Button>
        <Button variant="secondary" onClick={() => navigateBack(router, '/dashboard/events')}>Back to events</Button>
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

      {notice ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</div> : null}

      {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}

      <div className="mb-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Check-In Station</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Scan an attendee&apos;s QR pass, or enter their check-in code.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 font-mono text-sm outline-none"
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
        {stationMsg ? <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{stationMsg}</p> : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <SelectMenu
          aria-label="Filter by status"
          className="w-44"
          size="sm"
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: '', label: 'All statuses' },
            ...['PENDING_APPROVAL', 'CONFIRMED', 'WAITLISTED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW'].map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
          ]}
        />
        <SelectMenu
          aria-label="Filter by type"
          className="w-40"
          size="sm"
          value={filterType}
          onChange={setFilterType}
          options={[
            { value: '', label: 'All types' },
            ...['OPEN', 'APPROVAL', 'INVITE', 'WALK_IN'].map((t) => ({ value: t, label: t.replace(/_/g, ' ') })),
          ]}
        />
        {eventSections.length ? (
          <SelectMenu
            aria-label="Filter by section"
            className="w-44"
            size="sm"
            value={filterSection}
            onChange={setFilterSection}
            options={[
              { value: '', label: 'All sections' },
              ...eventSections.map((s) => ({ value: s.key, label: s.name })),
            ]}
          />
        ) : null}
        <input
          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none"
          placeholder="Search name, email, department, faculty, university"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="secondary" onClick={exportCsv} disabled={!filteredRows.length}>Download report</Button>
      </div>

      <TableShell title="Registrations" subtitle="Check attendees in and out to record attendance.">
        <Table>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Attendee</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Attendance</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredRows.length ? (
                filteredRows.map(({ registration, user }) => {
                  const rowBusy = busyId === registration._id;
                  return (
                    <tr key={registration._id} className="align-top text-slate-700 dark:text-slate-300">
                      <td className="px-6 py-5">
                        <div className="font-medium text-slate-950 dark:text-white">{user?.fullName ?? `User ${registration.userId}`}</div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{[user?.department, user?.email].filter(Boolean).join(' · ')}</div>
                        {registration.registrationType === 'WALK_IN' ? <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Walk-in</span> : null}
                        {sectionNameOf(registration) ? <span className="mt-1 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{sectionNameOf(registration)}</span> : null}
                        {(registration.answers ?? []).length ? (
                          <div className="mt-1 space-y-0.5">
                            {(registration.answers ?? []).map((a) => (
                              <p key={a.key} className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                                <span className="font-medium text-slate-600 dark:text-slate-300">{a.label}:</span> {a.value}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-5">
                        <Badge tone={tone(registration.status)}>{registration.status.replace(/_/g, ' ')}</Badge>
                        {registration.status === 'CANCELLED' && registration.cancellationReason ? (
                          <p className="mt-1 max-w-[180px] text-[11px] leading-snug text-slate-400 dark:text-slate-500" title={registration.cancellationReason}>
                            {registration.cancelledBy === 'ORGANIZER' ? 'By organizers: ' : ''}{registration.cancellationReason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                        {registration.checkInAt ? `In: ${new Date(registration.checkInAt).toLocaleTimeString('en-NG')}` : '—'}
                        {registration.checkOutAt ? ` · Out: ${new Date(registration.checkOutAt).toLocaleTimeString('en-NG')}` : ''}
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
                          {['CONFIRMED', 'WAITLISTED'].includes(registration.status) && !registration.checkInAt ? (
                            <Button variant="ghost" onClick={() => setCancelTarget(registration._id)} disabled={rowBusy}>Cancel</Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400" colSpan={4}>No registrations yet.</td></tr>
              )}
            </tbody>
          </table>
        </Table>
      </TableShell>

      <AppreciationDesigner
        open={designerOpen}
        busy={busyId === 'appreciation'}
        onClose={() => setDesignerOpen(false)}
        onSend={(design) => void sendDesignedAppreciation(design)}
      />

      <CancelRegistrationDialog
        open={Boolean(cancelTarget)}
        title="Remove this attendee?"
        subtitle="They will be notified with the reason you pick. If they paid for a ticket, the payment is refunded automatically and the freed seat goes to the waitlist."
        reasons={ORGANIZER_CANCEL_REASONS}
        confirmLabel="Remove attendee"
        busy={Boolean(busyId)}
        onClose={() => setCancelTarget('')}
        onConfirm={(reason) => {
          const id = cancelTarget;
          setCancelTarget('');
          void act(id, () => organizerCancelRegistration(eventId, id, reason));
        }}
      />
    </DashboardShell>
  );
}

const APPRECIATION_STYLES = {
  CONGRATS: { label: 'Celebration', accent: '#059669', chip: 'Congratulations', chipBg: '#ecfdf5', chipInk: '#047857' },
  CONFIRMATION: { label: 'Formal', accent: '#0369a1', chip: 'Confirmed', chipBg: '#eff6ff', chipInk: '#075985' },
  INFO: { label: 'Announcement', accent: '#1d2d4f', chip: 'Announcement', chipBg: '#eef2ff', chipInk: '#3730a3' },
} as const;

type AppreciationStyleKey = keyof typeof APPRECIATION_STYLES;

/** Design the attendee thank-you email with a live preview of the branded shell. */
function AppreciationDesigner({ open, busy, onClose, onSend }: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSend: (design: AppreciationDesign) => void;
}) {
  const [style, setStyle] = useState<AppreciationStyleKey>('CONGRATS');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  if (!open) return null;
  const meta = APPRECIATION_STYLES[style];
  const previewSubject = subject.trim() || 'Thank you for attending!';
  const previewMessage = message.trim() || 'Thank you for attending. Your presence made the event a success — we hope to see you at the next one!';
  const showCta = ctaLabel.trim() && /^https?:\/\//i.test(ctaUrl.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="grid max-h-[90vh] w-full max-w-4xl gap-0 overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl lg:grid-cols-2" onClick={(e) => e.stopPropagation()}>
        {/* ── Form ── */}
        <div className="space-y-4 overflow-y-auto p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Design your appreciation email</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sent once to everyone who checked in, plus an in-app notification.</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Tone</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(Object.keys(APPRECIATION_STYLES) as AppreciationStyleKey[]).map((key) => (
                <button key={key} onClick={() => setStyle(key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${style === key ? 'text-white' : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`} style={style === key ? { backgroundColor: APPRECIATION_STYLES[key].accent } : undefined}>
                  {APPRECIATION_STYLES[key].label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} placeholder="Thank you for attending!" className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Message</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={6} placeholder="Write your thank-you… blank line = new paragraph" className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Button label (optional)</span>
              <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={40} placeholder="See upcoming events" className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Button link</span>
              <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} maxLength={300} placeholder="https://…" className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button
              onClick={() => onSend({ category: style, subject: subject.trim() || undefined, message: message.trim() || undefined, ctaLabel: showCta ? ctaLabel.trim() : undefined, ctaUrl: showCta ? ctaUrl.trim() : undefined })}
              disabled={busy}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: meta.accent }}
            >
              {busy ? 'Sending…' : 'Send to attendees'}
            </button>
          </div>
        </div>

        {/* ── Live preview (mirrors the branded email shell) ── */}
        <div className="hidden overflow-y-auto bg-slate-100 dark:bg-slate-950 p-6 lg:block">
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Email preview</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div style={{ height: 5, backgroundColor: meta.accent }} />
            <div className="px-6 pt-5">
              <span className="text-lg font-extrabold tracking-wide text-slate-900 dark:text-slate-100">Guild<span style={{ color: '#b8933a' }}>OS</span></span>
            </div>
            <div className="px-6 pb-2 pt-4">
              <span className="inline-block rounded-full px-3 py-1 text-[11px] font-bold" style={{ backgroundColor: meta.chipBg, color: meta.chipInk }}>{meta.chip}</span>
              <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{previewSubject}</h3>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                <p>Hi <strong>Attendee</strong>,</p>
                {previewMessage.split(/\n{2,}/).map((block, i) => (
                  <p key={i} className="whitespace-pre-line">{block}</p>
                ))}
              </div>
              {showCta ? (
                <span className="mt-4 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: meta.accent }}>{ctaLabel}</span>
              ) : null}
            </div>
            <div className="mt-4 border-t border-slate-100 px-6 py-4">
              <p className="text-[11px] text-slate-400 dark:text-slate-500">GuildOS — Turn campus activity into a verified professional portfolio.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
