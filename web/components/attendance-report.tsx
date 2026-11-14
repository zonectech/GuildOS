'use client';
import { useState } from 'react';
import { Upload } from 'lucide-react';
import { applyAttendanceReport, previewAttendanceReport, setEventStatus, type ReportPreview } from '@/lib/api';

/**
 * For events run on another site: after the event, the organizer uploads that site's attendance
 * export (a CSV, or a Zoom or Teams report), checks who it matched, applies it, then closes attendance.
 * People are matched by the verified email on their account, so nobody is added by mistake.
 */
export function AttendanceReport({ eventId, partner, ended, closed, onChange }: {
  eventId: string; partner: string; ended: boolean; closed: boolean; onChange: () => Promise<unknown>;
}) {
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [applied, setApplied] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (closed) return null;
  if (!ended) return <p className="small dim">After the event, upload the attendance export from {partner} here. Attendees get their stamp, and their certificate if you offer one.</p>;

  async function read(file?: File) {
    if (!file) return;
    setBusy(true); setError(''); setApplied(null);
    try { setPreview(await previewAttendanceReport(eventId, await file.text(), file.name)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to read the report'); setPreview(null); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (!preview) return;
    setBusy(true); setError('');
    try { const r = await applyAttendanceReport(eventId, preview.reportId); setApplied(r.applied); setPreview(null); await onChange(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to apply the report'); }
    finally { setBusy(false); }
  }
  async function close() {
    if (!window.confirm('Close attendance? Certificates go out to everyone the report marked as attended, and the report can no longer change.')) return;
    setBusy(true); setError('');
    try { await setEventStatus(eventId, 'COMPLETED'); await onChange(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to close attendance'); }
    finally { setBusy(false); }
  }

  const review = preview?.rows.filter((r) => !r.matched) ?? [];
  return (
    <div className="stack report" style={{ gap: 10 }}>
      <b>Attendance from {partner}</b>
      <p className="small dim">Upload their export: a CSV with an email column (minutes optional), or a Zoom or Teams attendance report. People are matched by the verified email on their account.</p>
      <label className="btn s w"><Upload size={16} />{busy && !preview ? 'Reading…' : applied !== null ? 'Upload another report' : 'Upload attendance report'}
        <input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" hidden onChange={(e) => { void read(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {error ? <p className="error">{error}</p> : null}
      {preview ? (
        <div className="stack" style={{ gap: 8 }}>
          <p className="small"><b>{preview.matched}</b> matched{preview.needsReview ? <>, <b>{preview.needsReview}</b> need a look</> : null} in {preview.filename}.</p>
          {review.length ? (
            <div className="stack" style={{ gap: 4, maxHeight: 160, overflowY: 'auto' }}>
              {review.slice(0, 50).map((r) => <span key={r.row} className="small dim">Row {r.row}: {r.email || 'no email'} · {r.reason}</span>)}
            </div>
          ) : null}
          <button type="button" className="btn p w" disabled={busy || !preview.matched} onClick={() => void apply()}>{busy ? 'Applying…' : `Apply ${preview.matched} attendee${preview.matched === 1 ? '' : 's'}`}</button>
        </div>
      ) : null}
      {applied !== null ? <p className="note">{applied} attendee{applied === 1 ? '' : 's'} marked from the report. Close attendance when you are done.</p> : null}
      <button type="button" className="btn s w" disabled={busy} onClick={() => void close()}>Close attendance</button>
    </div>
  );
}
