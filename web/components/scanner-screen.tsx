'use client';
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { QrCamera, scanFeedback } from './qr-camera';

export type ScanResult = { ok: boolean; title: string; detail: string };

/** Full-screen door scanner, shared by the organizer's scanner and volunteer links. */
export function ScannerScreen({ title, subtitle, onScan, back }: {
  title: string;
  subtitle: string;
  onScan: (token: string, action: 'in' | 'out') => Promise<ScanResult>;
  back?: React.ReactNode;
}) {
  const [action, setAction] = useState<'in' | 'out'>('in');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [count, setCount] = useState({ in: 0, out: 0 });

  async function handle(token: string) {
    if (busy || !token.trim()) return;
    setBusy(true);
    const r = await onScan(token.trim(), action).catch((e: Error): ScanResult => ({ ok: false, title: 'Not scanned', detail: e.message }));
    scanFeedback(r.ok);
    if (r.ok) setCount((c) => ({ ...c, [action]: c[action] + 1 }));
    setResult(r);
    setBusy(false);
  }

  return (
    <div className="scanw">
      <header className="scant">{back}<div className="stack" style={{ gap: 0 }}><b>{title}</b><span>{subtitle}</span></div></header>
      <div className="seg" role="group" aria-label="Scan direction">
        <button type="button" aria-pressed={action === 'in'} onClick={() => setAction('in')}>Scan in</button>
        <button type="button" aria-pressed={action === 'out'} onClick={() => setAction('out')}>Scan out</button>
      </div>
      <QrCamera onRead={handle} paused={busy} />
      <p className="sh">Point the camera at the QR pass</p>
      {result ? (
        <div className={`res ${result.ok ? 'ok' : 'bad'}`} role="status">
          {result.ok ? <Check size={20} /> : <X size={20} />}
          <div className="stack" style={{ gap: 0 }}><b>{result.title}</b><span>{result.detail}</span></div>
        </div>
      ) : null}
      <div className="ctr"><div><b>{count.in}</b><span>Scanned in here</span></div><div><b>{count.out}</b><span>Scanned out here</span></div></div>
      <form className="typec" onSubmit={(e) => { e.preventDefault(); void handle(code).then(() => setCode('')); }}>
        <input aria-label="Pass code" placeholder="Or type the pass code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <button type="submit" className="btn p sm" disabled={busy || !code.trim()}>Check</button>
      </form>
    </div>
  );
}
