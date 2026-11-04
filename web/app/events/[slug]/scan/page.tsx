'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getEvent, scanPass, type EventDetail } from '@/lib/api';
import { ScannerScreen } from '@/components/scanner-screen';

/** The organizer's own scanner, opened from the event page. */
export default function OrganizerScannerPage() {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { getEvent(slug).then(setDetail).catch((e: Error) => setError(e.message)); }, [slug]);

  const back = <Link href={`/events/${slug}`} aria-label="Back to the event"><ChevronLeft size={24} /></Link>;
  if (error) return <div className="scanw"><p className="res bad" style={{ marginTop: 40 }}>{error}</p></div>;
  if (!detail) return <div className="scanw"><p className="sh" style={{ marginTop: 40 }}>Opening the scanner…</p></div>;
  if (!detail.canManage) return <div className="scanw"><p className="res bad" style={{ marginTop: 40 }}>Only the event&apos;s organizers can scan passes.</p></div>;

  const open = ['CHECK_IN', 'CHECK_OUT'].includes(detail.event.status);
  return (
    <ScannerScreen
      back={back}
      title={detail.event.title}
      subtitle={open ? (detail.event.status === 'CHECK_OUT' ? 'Check-out is open' : 'Check-in is open') : 'Open check-in on the event page first'}
      onScan={async (token, action) => {
        const r = await scanPass(detail.event._id, token, action);
        const certificate = action === 'out' && r.status === 'COMPLETED' ? '. Certificate on its way' : '';
        return { ok: true, title: r.student || 'Pass accepted', detail: `${action === 'in' ? 'Scanned in' : 'Scanned out'}${certificate}` };
      }}
    />
  );
}
