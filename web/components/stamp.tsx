import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import type { AttendanceStamp } from '@/lib/account';

const ROLE: Record<AttendanceStamp['role'], string> = { ATTENDED: 'Attended', HOSTED: 'Hosted', CO_HOSTED: 'Co-hosted' };
const clock = (v: string | null, timeZone: string) => (v ? new Date(v).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }) : '');
// A small fixed tilt per event, so a page of stamps looks hand-pressed but never reshuffles.
const tilt = (seed: string) => ((seed.split('').reduce((n, c) => n + c.charCodeAt(0), 0) % 5) - 2) * 0.8;

/** Proof of one attended event: the date, the scan-in and scan-out times, and whether a certificate was given. Opens the event, where the seal and certificate live. */
export function Stamp({ stamp }: { stamp: AttendanceStamp }) {
  const tz = stamp.timezone || 'Africa/Lagos';
  const hosting = stamp.role === 'HOSTED' || stamp.role === 'CO_HOSTED';
  const when = stamp.startDate ? new Date(stamp.startDate) : null;
  const inAt = clock(stamp.checkInAt, tz);
  const outAt = clock(stamp.checkOutAt, tz);
  return (
    <Link href={`/events/${stamp.eventSlug}`} className={`stamp${hosting ? ' hosting' : ''}`} style={{ ['--tilt' as string]: `${tilt(stamp.eventId)}deg` }}>
      <span className="stamp-top"><span>{ROLE[stamp.role ?? 'ATTENDED']}</span>{when ? <b>{when.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz })}</b> : null}</span>
      <b className="stamp-title">{stamp.eventTitle}</b>
      {stamp.communityName ? <span className="small">{stamp.communityName}</span> : null}
      <span className="stamp-times">
        {hosting ? (stamp.attendedCount ? `${stamp.attendedCount} attended` : 'Attendance closed') : stamp.evidence === 'REPORTED' ? 'Reported by the organizer' : stamp.daysAttended > 1 ? `${stamp.daysAttended} days` : inAt && outAt ? `In ${inAt} · Out ${outAt}` : 'Scanned in and out'}
      </span>
      {stamp.certificateSerial ? <span className="stamp-cert"><BadgeCheck size={14} />Certificate</span> : null}
    </Link>
  );
}

export function StampGrid({ stamps }: { stamps: AttendanceStamp[] }) {
  return <div className="stamps">{stamps.map((s) => <Stamp key={`${s.role}-${s.eventId}`} stamp={s} />)}</div>;
}
