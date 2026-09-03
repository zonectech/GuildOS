'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Camera, Check, DoorOpen, ScanLine, X } from 'lucide-react';

import { doorScan, getDoorScannerInfo, type DoorScannerInfo } from '../../../components/guildos/event-api';
import { QrScanner, playSuccessFeedback } from '../../../components/guildos/events/qr-scanner';

/**
 * PUBLIC gate-helper scanner — no GuildOS account needed. The organizer shares
 * /scan/<token> with door volunteers; the link itself is the authorization and
 * only works while the organizer has check-in/check-out open. Regenerating the
 * link from the dashboard revokes every copy instantly.
 */
export default function DoorScannerPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';
  const [info, setInfo] = useState<DoorScannerInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [deviceId, setDeviceId] = useState('');

  // Stable per-device identity: the first device to open the link claims it,
  // and the pass refuses every other device afterwards.
  useEffect(() => {
    const KEY = 'guildos-scanner-device';
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    setDeviceId(id);
  }, []);

  useEffect(() => {
    if (!token || !deviceId) return;
    void getDoorScannerInfo(token, deviceId)
      .then(setInfo)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Invalid scanner link'));
  }, [token, deviceId]);

  async function scanValue(value: string) {
    const pass = value.trim();
    if (!pass || busy) return;
    try {
      setBusy(true);
      const outcome = await doorScan(token, pass, mode, deviceId);
      playSuccessFeedback();
      // Section events: tell the gate crew which room to point the attendee to.
      const direct = mode === 'in' && outcome.section ? ` → ${outcome.section.name}${outcome.section.venue ? ` (${outcome.section.venue})` : ''}` : '';
      setResult({ ok: true, text: `${outcome.student || 'Attendee'} — ${mode === 'in' ? 'checked in' : 'checked out'} ✓${direct}` });
      setScanCount((n) => n + 1);
      setCode('');
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Scan failed' });
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <X className="mx-auto h-10 w-10 text-rose-500" />
        <h1 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">Scanner link not valid</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
      </main>
    );
  }

  if (!info) {
    return <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500 dark:text-slate-400">Loading scanner…</main>;
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-600">
          <DoorOpen className="h-4 w-4" /> GuildOS door scanner{info.label ? ` · ${info.label}` : ''}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{info.title}</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{info.venue || 'Online event'}{info.startDate ? ` · ${new Date(info.startDate).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}` : ''}</p>

        {!info.scanningOpen ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300">
            Scanning is closed right now — it opens when the organizer starts check-in.
          </div>
        ) : (
          <>
            <div className="mt-4 inline-flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 text-sm font-medium">
              <button onClick={() => setMode('in')} className={`rounded-lg px-4 py-1.5 ${mode === 'in' ? 'bg-slate-900 text-white' : 'text-slate-600 dark:text-slate-400'}`}>Check-In</button>
              <button onClick={() => setMode('out')} className={`rounded-lg px-4 py-1.5 ${mode === 'out' ? 'bg-slate-900 text-white' : 'text-slate-600 dark:text-slate-400'}`}>Check-Out</button>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{mode === 'in' ? 'Scan each attendee’s QR pass as they arrive.' : 'Scan the same pass as they leave to record their departure.'}</p>

            {cameraOpen ? (
              <QrScanner onResult={(value) => void scanValue(value)} onClose={() => setCameraOpen(false)} />
            ) : (
              <button onClick={() => setCameraOpen(true)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white">
                <Camera className="h-4 w-4" /> Open camera scanner
              </button>
            )}

            <div className="mt-4 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void scanValue(code); }}
                placeholder="…or type the gate code (e.g. K7M-2PX)"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
              />
              <button onClick={() => void scanValue(code)} disabled={busy || !code.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <ScanLine className="h-4 w-4" /> {busy ? '…' : mode === 'in' ? 'Check in' : 'Check out'}
              </button>
            </div>

            {result ? (
              <div className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300'}`}>
                {result.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
                {result.text}
              </div>
            ) : null}
            {scanCount > 0 ? <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">{scanCount} scan{scanCount === 1 ? '' : 's'} this session</p> : null}
          </>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">This link is locked to this device. Keep the page open at the gate — a data connection is required for each scan.</p>
    </main>
  );
}
