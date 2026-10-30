'use client';
import { useState } from 'react';
import type { EventInput } from '../api/event-api';
import { externalRequest, type EventLinkDraft } from './external-event-api';
export function EventLinkImport({ communityId, onApply }: { communityId: string; onApply: (draft: EventInput) => void }) {
  const [url, setUrl] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [preview, setPreview] = useState<EventLinkDraft | null>(null);
  async function inspect() {
    setBusy(true); setError(''); setPreview(null);
    try { setPreview(await externalRequest<EventLinkDraft>('import-link', { communityId, url })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to read this event page'); } finally { setBusy(false); }
  }
  return <section className="py-1">
    <h2 className="font-semibold text-slate-900 dark:text-white">Already created this event elsewhere?</h2>
    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Paste its public event link to prepare a draft. You can review the details before adding them to this form.</p>
    <div className="mt-3 flex flex-wrap gap-2"><input aria-label="Existing event URL" className="ev-input min-w-0 flex-1" type="url" placeholder="https://…" value={url} onChange={e => { setUrl(e.target.value); setPreview(null); }} /><button type="button" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !communityId || !url} onClick={() => void inspect()}>{busy ? 'Reading page…' : 'Preview event'}</button></div>
    {error ? <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
    {preview ? <div className="mt-4 rounded-xl bg-white p-4 dark:bg-slate-900"><h3 className="font-semibold">{preview.draft.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm">{preview.draft.shortDescription}</p><p className="mt-2 text-sm">{preview.draft.startDate ? new Date(preview.draft.startDate).toLocaleString() : 'Date and time need review'}{preview.draft.venue ? ' · ' + preview.draft.venue : ''}</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">{preview.warnings.map(w => <li key={w}>{w}</li>)}</ul><button type="button" className="mt-3 rounded-xl border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300" onClick={() => { onApply({ ...preview.draft, attendanceSource: 'EXTERNAL', qrEnabled: false, checkOutRequired: false, allowWalkIns: false }); setPreview(null); }}>Use these details in the form</button></div> : null}
  </section>;
}
