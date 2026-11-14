'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { useParams } from 'next/navigation';
import { answerRegistration, getEvent, listAttendees, type Attendee, type EventDetail } from '@/lib/api';

const LABEL: Record<string, string> = {
  PENDING_APPROVAL: 'Waiting for approval', CONFIRMED: 'Registered', WAITLISTED: 'Waitlist', CHECKED_IN: 'Scanned in', CHECKED_OUT: 'Scanned out',
  COMPLETED: 'Completed', PARTIAL_ATTENDANCE: 'Partial', CANCELLED: 'Cancelled', REJECTED: 'Declined', NO_SHOW: 'Did not come',
};
const stamp = (v?: string | null) => (v ? new Date(v).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '');
// Quote every cell, and stop spreadsheet apps from running a cell that starts like a formula.
const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

/** Saves the attendees shown as a CSV that opens in Excel or Google Sheets. */
function downloadCsv(rows: Attendee[], title: string, filterLabel: string) {
  const head = ['Name', 'Email', 'University', 'Status', 'Registered', 'Scanned in', 'Scanned out', 'Certificate'];
  const body = rows.map((r) => [r.user?.fullName ?? '', r.user?.email ?? '', r.user?.university ?? '', LABEL[r.status] ?? r.status,
    stamp(r.registeredAt ?? (r as { createdAt?: string }).createdAt), stamp(r.checkInAt), stamp(r.checkOutAt), r.certificateIssued ? 'Sent' : '']);
  const csv = '﻿' + [head, ...body].map((line) => line.map(cell).join(',')).join('\r\n');
  const name = `${title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'event'}-${filterLabel.toLowerCase().replace(/\s+/g, '-')}-attendees.csv`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const time = (v: string | null) => (v ? new Date(v).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) : '');

export default function AttendeesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [rows, setRows] = useState<Attendee[] | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await getEvent(slug);
      setDetail(d);
      setRows((await listAttendees(d.event._id)).registrations);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load attendees'); setRows([]); }
  }, [slug]);
  useEffect(() => { void load(); }, [load]);

  async function answer(r: Attendee, approve: boolean) {
    if (!detail) return;
    setBusy(r._id); setError('');
    try { await answerRegistration(detail.event._id, r._id, approve); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update'); }
    finally { setBusy(''); }
  }

  const all = rows ?? [];
  const groups = [['ALL', 'All'], ['PENDING_APPROVAL', 'Waiting'], ['CHECKED_IN', 'Scanned in'], ['COMPLETED', 'Completed']] as const;
  const shown = filter === 'ALL' ? all : all.filter((r) => r.status === filter);

  return (
    <div className="wrap page">
      <Link href={`/events/${slug}`} className="small">‹ Back to the event</Link>
      <h1>Attendees</h1>
      {detail ? <p className="muted">{detail.event.title}</p> : null}
      <div className="row" role="group" aria-label="Filter attendees">
        {groups.map(([key, label]) => <button key={key} type="button" className="pill" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} ({key === 'ALL' ? all.length : all.filter((r) => r.status === key).length})</button>)}
      </div>
      {rows?.length ? (
        <button type="button" className="btn s" style={{ alignSelf: 'flex-start' }} disabled={!shown.length}
          onClick={() => downloadCsv(shown, detail?.event.title ?? slug, groups.find(([k]) => k === filter)?.[1] ?? 'All')}>
          <Download size={16} />Download {filter === 'ALL' ? 'list' : 'these'} ({shown.length})
        </button>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {rows === null ? <p className="empty">Loading attendees…</p> : null}
      <div className="table" role="table" aria-label="Attendees">
        {shown.map((r) => (
          <div key={r._id} className="trow" role="row">
            <span className="stack" style={{ gap: 0 }} role="cell"><b>{r.user?.fullName ?? 'Student'}</b><span className="small">{r.user?.email}</span></span>
            <span role="cell" className="small">{r.checkInAt ? `In ${time(r.checkInAt)}` : ''}{r.checkOutAt ? ` · Out ${time(r.checkOutAt)}` : ''}</span>
            <span role="cell" className="row" style={{ justifyContent: 'flex-end' }}>
              {r.status === 'PENDING_APPROVAL' ? <>
                <button type="button" className="btn p sm" disabled={busy === r._id} onClick={() => answer(r, true)}>Approve</button>
                <button type="button" className="btn s sm" disabled={busy === r._id} onClick={() => answer(r, false)}>Decline</button>
              </> : <span className={`chip ${r.status === 'COMPLETED' ? 'ok' : 'off'}`}>{LABEL[r.status] ?? r.status}{r.certificateIssued ? ', certificate sent' : ''}</span>}
            </span>
          </div>
        ))}
        {rows !== null && !shown.length ? <p className="empty">Nobody here yet.</p> : null}
      </div>
    </div>
  );
}
