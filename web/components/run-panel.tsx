'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Copy, ScanLine } from 'lucide-react';
import {
  cancelEvent, createScannerPass, endEventNow, extendEvent, listScannerPasses, publishEvent, setEventStatus,
  type EventSummary, type ScannerPass,
} from '@/lib/api';
import { bucketOf } from '@/lib/events';
import { AttendanceReport } from './attendance-report';
import { EventRatings } from './event-ratings';

const STATUS_TEXT: Record<string, string> = {
  DRAFT: 'Draft, not published', ANNOUNCED: 'Announced, registration not open yet', PUBLISHED: 'Published, registration open',
  CHECK_IN: 'Check-in is open', CHECK_OUT: 'Check-out is open', COMPLETED: 'Attendance closed', POSTPONED: 'Postponed', ARCHIVED: 'Archived',
};

/** What an organizer sees on their own event page. No separate dashboard. */
export function RunPanel({ event, onChange }: { event: EventSummary & { checkedInCount?: number; completedCount?: number; qrEnabled?: boolean }; onChange: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [passes, setPasses] = useState<ScannerPass[] | null>(null);
  const live = ['CHECK_IN', 'CHECK_OUT'].includes(event.status);
  const external = event.attendanceSource === 'EXTERNAL';
  const singleDay = (event.days ?? []).length <= 1;
  const ended = Boolean(event.endDate) && new Date(event.endDate as string).getTime() <= Date.now();
  // Ending early only makes sense once it has begun; the backend refuses it before the start.
  const started = !event.startDate || new Date(event.startDate).getTime() <= Date.now();
  const cancelled = bucketOf(event) === 'CANCELLED';
  // Cancelling is for an event that has not started running yet: once check-in opens, it is happening.
  const cancellable = ['ANNOUNCED', 'PUBLISHED', 'POSTPONED'].includes(event.status) && !started;

  async function run(action: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setError('');
    try { await action(); await onChange(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(false); }
  }
  async function showPasses(create = false) {
    setError('');
    try { if (create) await createScannerPass(event._id); setPasses((await listScannerPasses(event._id)).passes); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load scanner links'); }
  }

  return (
    <section className="run" aria-label="Run this event">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b>{cancelled ? 'Cancelled' : ended && ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'].includes(event.status) && external ? 'Event ended, attendance to report' : ended && event.status === 'PUBLISHED' ? 'Event ended' : STATUS_TEXT[event.status] ?? event.status}</b>
        {bucketOf(event) === 'LIVE' ? <span className="chip live">Live now</span> : null}
      </div>
      {cancelled ? <p className="small">Everyone who registered was told by email and notification, and their places were cancelled.</p> : null}
      {!cancelled ? <div className="stats3 dark">
        <div><b>{event.registrationCount}</b><span>Registered</span></div>
        {/* Partner-site events have no door scans; attendance arrives with the report. */}
        {!external ? <div><b>{event.checkedInCount ?? 0}</b><span>Scanned in</span></div> : null}
        <div><b>{event.completedCount ?? 0}</b><span>{external ? 'Attended' : 'Completed'}</span></div>
      </div> : null}
      {error ? <p className="error">{error}</p> : null}

      {event.status === 'DRAFT' || event.status === 'ANNOUNCED' ? <button type="button" className="btn p w" disabled={busy} onClick={() => run(() => publishEvent(event._id))}>Publish event</button> : null}
      {event.status === 'PUBLISHED' && !external ? <button type="button" className="btn p w" disabled={busy} onClick={() => run(() => setEventStatus(event._id, 'CHECK_IN'))}>Open check-in</button> : null}
      {live && !external ? <Link className="btn p w" href={`/events/${event.slug}/scan`}><ScanLine size={16} />Open scanner</Link> : null}
      {live && !external ? (
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          {event.status === 'CHECK_IN' ? <button type="button" className="btn s" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => setEventStatus(event._id, 'CHECK_OUT'))}>Open check-out</button> : null}
          {singleDay ? <button type="button" className="btn s" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => extendEvent(event._id, 30))}>Add 30 minutes</button> : null}
        </div>
      ) : null}
      {live && singleDay && started && !ended && !external ? <button type="button" className="linkb" disabled={busy} onClick={() => run(() => endEventNow(event._id), 'End this event now? The end time moves to now and check-out opens.')}>End event now</button> : null}
      {event.status === 'CHECK_OUT' && ended ? <button type="button" className="btn s w" disabled={busy} onClick={() => run(() => setEventStatus(event._id, 'COMPLETED'), 'Close attendance? Anyone not scanned out will not get a certificate.')}>Close attendance</button> : null}

      {external && ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'].includes(event.status) ? <AttendanceReport eventId={event._id} partner={event.partnerRegistrationLabel || 'the partner site'} ended={ended} closed={false} onChange={onChange} /> : null}
      {/* What attendees said, once it is over: ratings come from the thank-you email and the event page. */}
      {ended && !cancelled ? <div className="report"><EventRatings eventId={event._id} /></div> : null}

      <div className="stack" style={{ gap: 0 }}>
        <Link className="optl" href={`/events/${event.slug}/attendees`}><span><b>Attendees</b><span>{cancelled ? 'Who had registered, to download' : `${event.registrationCount} registered`}</span></span><ChevronRight size={18} /></Link>
        {!external && !cancelled ? <button type="button" className="optl" onClick={() => showPasses(false)}><span><b>Volunteer scanner links</b><span>For helpers at the door, no account needed</span></span><ChevronRight size={18} /></button> : null}
        {passes ? (
          <div className="stack" style={{ gap: 8, padding: '10px 0' }}>
            {passes.map((p, i) => {
              const url = `${window.location.origin}/scan/${p.token}`;
              return <button key={p.id} type="button" className="btn s sm" onClick={() => navigator.clipboard.writeText(url).catch(() => undefined)}><Copy size={14} />Copy link {i + 1}{p.claimed ? ' (in use)' : ''}</button>;
            })}
            <button type="button" className="btn s sm" onClick={() => showPasses(true)}>Make a new link</button>
            <span className="small">Each link works on one phone. The first phone to open it keeps it.</span>
          </div>
        ) : null}
        {!cancelled ? <Link className="optl" href={`/events/new?edit=${event.slug}`}><span><b>Edit event</b><span>Details, registration, certificate</span></span><ChevronRight size={18} /></Link> : null}
      </div>

      {/* Everyone registered is emailed and notified automatically; the organizer only confirms. */}
      {cancellable ? <button type="button" className="linkb danger" disabled={busy} onClick={() => run(() => cancelEvent(event._id), 'Cancel this event? Everyone registered gets an email and a notification, and their place is cancelled. Co-hosts and speakers are told too. This cannot be undone.')}>{busy ? 'Working…' : 'Cancel event'}</button> : null}
    </section>
  );
}
