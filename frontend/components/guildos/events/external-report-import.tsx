'use client';
import { useEffect, useState } from 'react';
import { externalRequest, type ExternalReportPreview, type ExternalReportHistory } from './external-event-api';
export function ExternalReportImport({ eventId, onApplied }: { eventId: string; onApplied: () => Promise<void> }) {
  const [kind, setKind] = useState<'REGISTRATION' | 'ATTENDANCE'>('ATTENDANCE'); const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<ExternalReportPreview | null>(null); const [history, setHistory] = useState<ExternalReportHistory[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  async function loadHistory() { const r = await externalRequest<{ reports: ExternalReportHistory[] }>(eventId + '/external-reports'); setHistory(r.reports); }
  useEffect(() => { setPreview(null); void loadHistory().catch(() => undefined); }, [eventId]);
  async function inspect(reportId?: string) {
    setBusy(true); setError(''); setMessage(''); setPreview(null);
    try {
      if (reportId) setPreview(await externalRequest<ExternalReportPreview>(eventId + '/external-reports/' + reportId));
      else {
        if (!file) throw new Error('Choose an exported CSV or TSV report');
        if (file.size > 2 * 1024 * 1024) throw new Error('Use a file smaller than 2 MB');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
        const text = new TextDecoder(encoding).decode(bytes);
        setPreview(await externalRequest<ExternalReportPreview>(eventId + '/external-reports/preview', { text, kind, filename: file.name }));
        await loadHistory();
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to preview report'); } finally { setBusy(false); }
  }
  async function apply() {
    if (!preview) return; setBusy(true); setError(''); setMessage('');
    try {
      const r = await externalRequest<{ applied: number; needsReview: number; conflicts?: number }>(eventId + '/external-reports/' + preview.reportId + '/apply', {});
      setMessage(r.applied + ' member record(s) applied. ' + r.needsReview + ' report row(s) need review. ' + (r.conflicts ? 'Some records changed during the import; recheck matches and try those rows again. ' : '') + 'Certificates can be issued from the existing Issue Certificates button.');
      setPreview(null); await onApplied(); await loadHistory();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to apply report'); } finally { setBusy(false); }
  }
  function downloadUnmatched() {
    if (!preview) return;
    const cell = (v: unknown) => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
    const csv = [['email', 'day', 'minutes', 'reason'], ...preview.rows.filter(r => !r.matched).map(r => [r.email, r.day, r.minutes ?? '', r.reason])].map(row => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'attendance-needs-verification.csv'; link.click(); URL.revokeObjectURL(url);
  }
  return <section className="mb-6 rounded-lg border border-indigo-200 bg-white p-5 dark:border-indigo-900 dark:bg-slate-900">
    <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Import external platform reports</h2>
    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Match the platform&apos;s exported emails to verified GuildOS member emails. Attendance reports replace a second check-in here when the event uses external attendance.</p>
    <p className="mt-2 text-xs text-slate-500">CSV/TSV, up to 2 MB and 5,000 rows. Columns: email, minutes (when required), day (YYYY-MM-DD for multi-day events). Common Email, Duration and In-meeting duration headings are recognized. Combine repeated sessions per email/day before uploading. A registration list confirms registration only.</p>
    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Evidence: organizer reported. GuildOS matches identities and checks attendance rules; it cannot authenticate an uploaded spreadsheet.</p>
    <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm">Report type<select aria-label="External report type" className="ev-input mt-1 block" disabled={busy} value={kind} onChange={e => { setKind(e.target.value as typeof kind); setPreview(null); }}><option value="ATTENDANCE">Attendance report</option><option value="REGISTRATION">Registration list</option></select></label><label className="min-w-0 text-sm">Exported file<input aria-label="External report file" className="mt-1 block max-w-full text-sm" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); }} /></label><button type="button" disabled={busy || !file} onClick={() => void inspect()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Working…' : 'Preview matches'}</button></div>
    {error ? <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}{message ? <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
    {preview ? <div className="mt-4"><p className="font-medium">{preview.filename} · {preview.kind.toLowerCase()} · {preview.matched} matched · {preview.needsReview} need review</p><p className="mt-1 text-xs text-slate-500">Only matching, eligible records will be applied. Unmatched rows stay available for rechecking after members verify their email. Attendance rows replace the recorded duration for that attendee and day, including lower corrected values. A zero-minute row removes previously imported attendance for that day. Other days stay unchanged; issued certificates are locked.</p><div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Email</th><th className="p-2">Day</th><th className="p-2">Minutes</th><th className="p-2">Result</th></tr></thead><tbody>{preview.rows.slice(0, 200).map(r => <tr key={r.row} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2">{r.email}</td><td className="p-2">{r.day || 'Single day'}</td><td className="p-2">{r.minutes ?? 'Not provided'}</td><td className="p-2">{r.matched ? r.action === 'REMOVE' ? 'Remove prior attendance' : r.action === 'REPLACE' ? 'Replace prior attendance (' + (r.previousMinutes ?? 'unknown') + ' min)' : 'Matched' : r.reason}</td></tr>)}</tbody></table></div>{preview.rows.length > 200 ? <p className="mt-2 text-xs">Showing the first 200 rows. All {preview.rows.length} rows are included in the match counts.</p> : null}<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || !preview.matched} onClick={() => void apply()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Apply matched records</button><button type="button" disabled={!preview.needsReview} onClick={downloadUnmatched} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50">Download rows needing verification</button><button type="button" onClick={() => setPreview(null)} className="px-3 text-sm">Close preview</button></div></div> : null}
    {history.length ? <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">Previous imports and unresolved matches</summary><ul className="mt-2 space-y-2">{history.map(r => <li key={r._id} className="flex flex-wrap items-center justify-between gap-2"><span>{r.filename} · {r.kind.toLowerCase()} · {r.appliedAt ? 'Applied' : 'Preview only'}</span><button type="button" disabled={busy} className="font-medium text-indigo-600 dark:text-indigo-300" onClick={() => void inspect(r._id)}>Recheck matches</button></li>)}</ul></details> : null}
  </section>;
}
