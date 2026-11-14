'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doorInfo, doorScan } from '@/lib/api';
import { ScannerScreen } from '@/components/scanner-screen';

/** The device id a volunteer link locks to. Kept in this browser so a reload keeps working. */
function deviceId() {
  try {
    const saved = localStorage.getItem('door-device');
    if (saved) return saved;
    const fresh = crypto.randomUUID();
    localStorage.setItem('door-device', fresh);
    return fresh;
  } catch {
    return 'no-storage';
  }
}

/** Volunteer scanner: works from a link, with no account, locked to the first phone that opens it. */
export default function DoorScannerPage() {
  const { token } = useParams<{ token: string }>();
  const [device, setDevice] = useState('');
  const [info, setInfo] = useState<{ title: string; label: string; scanningOpen: boolean } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { setDevice(deviceId()); }, []);
  useEffect(() => { if (device) doorInfo(token, device).then(setInfo).catch((e: Error) => setError(e.message)); }, [token, device]);

  if (error) return <div className="scanw"><p className="res bad" style={{ marginTop: 40 }}>{error}</p></div>;
  if (!info) return <div className="scanw"><p className="sh" style={{ marginTop: 40 }}>Opening the scanner…</p></div>;
  return (
    <ScannerScreen
      title={info.label || 'Door scanner'}
      subtitle={info.scanningOpen ? `${info.title}, no account needed` : `${info.title}. Scanning opens when the organizer opens check-in.`}
      onScan={async (pass, action) => {
        const r = await doorScan(token, pass, action, device);
        return { ok: true, title: r.student || 'Pass accepted', detail: action === 'in' ? 'Scanned in' : 'Scanned out' };
      }}
    />
  );
}
