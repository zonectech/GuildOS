'use client';

import { LogoSpinner } from '../../../../components/guildos/ui/loading';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { getCurrentUser } from '../../../../components/guildos/auth-api';
import { attendanceCheckIn, attendanceCheckOut, getEventLiveAttendance, organizerRegisterWalkIn, searchWalkInUsers, type LiveAttendance, type WalkInUser } from '../../../../components/guildos/event-api';
import { QrScanner, playSuccessFeedback } from '../../../../components/guildos/events/qr-scanner';
import { DashboardShell } from '../../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../../components/guildos/dashboard-topbar';
import { Button } from '../../../../components/guildos/ui/button';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-semibold text-slate-950">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function AttendanceScannerPage() {
  return (
    <Suspense fallback={null}>
      <AttendanceScannerPageInner />
    </Suspense>
  );
}

function AttendanceScannerPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const eventId = params.get('eventId') ?? '';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState<LiveAttendance | null>(null);
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [walkInQuery, setWalkInQuery] = useState('');
  const [walkInResults, setWalkInResults] = useState<WalkInUser[]>([]);
  const [walkInBusy, setWalkInBusy] = useState(false);

  async function loadLive() {
    if (!eventId) return;
    try {
      const response = await getEventLiveAttendance(eventId);
      setLive(response.live);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load attendance');
    }
  }

  useEffect(() => {
    void (async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      await loadLive();
      setIsLoading(false);
    })();
    const interval = setInterval(() => void loadLive(), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function scanValue(token: string) {
    const value = token.trim();
    if (!value) return;
    try {
      setBusy(true);
      setMessage('');
      if (mode === 'in') {
        const result = await attendanceCheckIn({ token: value });
        setMessage(`Checked in: ${result.student || 'success'}`);
      } else {
        const result = await attendanceCheckOut({ token: value });
        const dur = `${Math.floor(result.attendanceDuration / 60)}h ${result.attendanceDuration % 60}m`;
        setMessage(`${result.student}: ${dur} · ${result.certificateEligible ? 'Certificate eligible' : 'Partial attendance'} · +${result.guildScoreAwarded} pts`);
      }
      playSuccessFeedback();
      setCode('');
      await loadLive();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to process');
    } finally {
      setBusy(false);
    }
  }

  async function searchWalkIn(q: string) {
    setWalkInQuery(q);
    if (q.trim().length < 2) {
      setWalkInResults([]);
      return;
    }
    try {
      const result = await searchWalkInUsers(eventId, q);
      setWalkInResults(result.users);
    } catch {
      setWalkInResults([]);
    }
  }

  async function registerWalkIn(userId: string) {
    try {
      setWalkInBusy(true);
      setMessage('');
      const result = await organizerRegisterWalkIn(eventId, userId);
      setMessage(`Walk-in checked in: ${result.student}`);
      playSuccessFeedback();
      setWalkInQuery('');
      setWalkInResults([]);
      await loadLive();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to register walk-in');
    } finally {
      setWalkInBusy(false);
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

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader eyebrow="Events" title="Attendance Scanner" subtitle={live?.title ?? 'Scan attendee event passes to verify presence.'} />

      {!eventId ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Open the scanner from an event (add <span className="font-mono">?eventId=...</span>).</div> : null}
      {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {live ? (
        <>
          {live.day ? (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <span className="rounded-full bg-indigo-600 px-3 py-1 text-sm font-bold text-white">
                {live.day.current >= 1 ? `Day ${live.day.current} of ${live.day.total}` : `${live.day.total}-day event`}
              </span>
              <span className="text-sm text-indigo-900">
                <strong>{live.day.checkedInToday}</strong> checked in today
                {live.day.current >= 1 ? <> · <strong>{live.day.expectedToday}</strong> expected today</> : null}
              </span>
              {live.day.current < 1 ? <span className="text-xs text-indigo-700">Outside the scheduled days — scans still record to today’s date.</span> : null}
            </div>
          ) : null}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Registrations" value={live.registrations} />
            <Stat label="Checked in" value={live.checkedIn} />
            <Stat label="Checked out" value={live.checkedOut} />
            <Stat label="Pending arrivals" value={live.pendingArrivals} />
            <Stat label="Walk-ins" value={live.walkIns} />
            <Stat label="Completed" value={live.completed} />
            <Stat label="Early departures" value={live.earlyDepartures} />
            <Stat label="Cert. eligible" value={live.certificateEligible} />
            <Stat label="Avg. duration" value={`${live.averageDuration}m`} />
            <Stat label="Attendance" value={`${live.attendanceRate}%`} />
          </div>
        </>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">Scan Event Pass</h2>
          <div className="inline-flex rounded-xl border border-slate-200 p-1 text-sm">
            <button onClick={() => setMode('in')} className={`rounded-lg px-3 py-1 ${mode === 'in' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Check-In</button>
            <button onClick={() => setMode('out')} className={`rounded-lg px-3 py-1 ${mode === 'out' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Check-Out</button>
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-500">{mode === 'in' ? 'Scan the student’s QR pass to verify arrival.' : 'Scan the same pass to verify departure and finalize participation.'}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm outline-none"
            placeholder="Enter check-in code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void scanValue(code); }}
          />
          <Button variant="primary" onClick={() => void scanValue(code)} disabled={busy || !code.trim()}>{mode === 'in' ? 'Check In' : 'Check Out'}</Button>
          <Button variant="secondary" onClick={() => setScanning((s) => !s)}>{scanning ? 'Stop Scanner' : 'Scan QR'}</Button>
        </div>
        {scanning ? <QrScanner onResult={(value) => { setScanning(false); void scanValue(value); }} onClose={() => setScanning(false)} /> : null}
        {message ? <p className="mt-3 text-sm font-medium text-slate-800">{message}</p> : null}
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Register Walk-In</h2>
        <p className="mt-1 text-sm text-slate-500">Search for a student who arrived without registering, then check them in.</p>
        <input
          className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
          placeholder="Search by name, email, or username"
          value={walkInQuery}
          onChange={(e) => void searchWalkIn(e.target.value)}
        />
        {walkInResults.length ? (
          <div className="mt-3 space-y-2">
            {walkInResults.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
                  <p className="text-xs text-slate-500">{[user.username, user.email].filter(Boolean).join(' · ')}</p>
                </div>
                <Button variant="primary" onClick={() => void registerWalkIn(user.id)} disabled={walkInBusy}>Check In</Button>
              </div>
            ))}
          </div>
        ) : walkInQuery.trim().length >= 2 ? (
          <p className="mt-3 text-sm text-slate-500">No matching students.</p>
        ) : null}
      </div>
    </DashboardShell>
  );
}
