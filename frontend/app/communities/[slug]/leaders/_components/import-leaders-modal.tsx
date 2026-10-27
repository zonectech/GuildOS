'use client';

import { useState } from 'react';
import { FileUp, Trash2, XCircle } from 'lucide-react';

import {
  bulkCreateCommunityLeaders, extractLeadersFromDocument,
  type ExtractedLeaderCandidate,
} from '../../../../../components/guildos/community-list-api';
import { validateSessionLabel } from '../../_components/session-label';

type ImportRow = ExtractedLeaderCandidate & { _rowId: number };

const ROW_INPUT = 'rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-xs outline-none focus:border-indigo-400';

/**
 * Import-from-document: step 1 uploads a PDF and gets AI-extracted candidates back,
 * step 2 lets the admin review/edit the rows before committing them all under one session.
 */
export function ImportLeadersModal({
  communityId,
  initialSession,
  onClose,
  onImported,
}: {
  communityId: string;
  initialSession: string;
  onClose: () => void;
  /** Called with the session the leaders were created under; the modal closes after it resolves. */
  onImported: (session: string) => Promise<void>;
}) {
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(initialSession);
  const [rows, setRows] = useState<ImportRow[]>([]);

  async function handleUpload(file: File) {
    try {
      setBusy(true);
      setError('');
      const result = await extractLeadersFromDocument(file);
      if (!result.candidates.length) {
        setError("Couldn't find any names in that document. Try a clearer PDF, or add leaders manually.");
        return;
      }
      setSession(result.session || session);
      setRows(result.candidates.map((c, i) => ({ ...c, _rowId: i })));
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to extract leaders from that document');
    } finally {
      setBusy(false);
    }
  }

  function updateRow(rowId: number, patch: Partial<ExtractedLeaderCandidate>) {
    setRows((current) => current.map((r) => (r._rowId === rowId ? { ...r, ...patch } : r)));
  }

  async function handleCommit() {
    if (!rows.length) return;
    const sessionError = validateSessionLabel(session);
    if (sessionError) {
      setError(sessionError);
      return;
    }
    if (!rows.some((r) => r.name.trim())) {
      setError('At least one row needs a name');
      return;
    }

    try {
      setBusy(true);
      setError('');
      const entries = rows
        .filter((r) => r.name.trim())
        .map((r) => ({ name: r.name.trim(), title: r.title.trim(), department: r.department.trim(), level: r.level.trim(), phone: r.phone.trim() }));
      await bulkCreateCommunityLeaders(communityId, session.trim(), entries);
      await onImported(session.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create leaders');
    } finally {
      setBusy(false);
    }
  }

  const errorBanner = error && (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300">{error}</div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white dark:bg-slate-900 p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Import from document</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {step === 'upload' ? (
          <div className="mt-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload a nomination or appointment-letter PDF (e.g. a leadership list) and we'll pull out names, offices,
              departments, levels and phone numbers for you to review before adding them.
            </p>
            {error && <div className="mt-3">{errorBanner}</div>}
            <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-800 px-4 py-10 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10">
              <FileUp className="h-8 w-8 text-indigo-400" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {busy ? 'Reading document…' : 'Click to choose a PDF'}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">PDF only, up to 10MB</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                }}
              />
            </label>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {errorBanner}
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Session (applies to all rows) *</label>
              <input
                type="text"
                value={session}
                onChange={(e) => setSession(e.target.value.slice(0, 20))}
                placeholder="e.g. 2026/2027"
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none transition focus:border-indigo-400"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{rows.length} candidate{rows.length === 1 ? '' : 's'} found. Review and edit them before adding.</p>
              {rows.map((row) => (
                <div key={row._rowId} className="grid grid-cols-12 gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 p-2">
                  <input value={row.name} onChange={(e) => updateRow(row._rowId, { name: e.target.value })} placeholder="Name *" className={`col-span-4 ${ROW_INPUT}`} />
                  <input value={row.title} onChange={(e) => updateRow(row._rowId, { title: e.target.value })} placeholder="Office/Title" className={`col-span-3 ${ROW_INPUT}`} />
                  <input value={row.department} onChange={(e) => updateRow(row._rowId, { department: e.target.value })} placeholder="Department" className={`col-span-2 ${ROW_INPUT}`} />
                  <input value={row.level} onChange={(e) => updateRow(row._rowId, { level: e.target.value })} placeholder="Level" className={`col-span-1 ${ROW_INPUT}`} />
                  <input value={row.phone} onChange={(e) => updateRow(row._rowId, { phone: e.target.value })} placeholder="Phone" className={`col-span-1 ${ROW_INPUT}`} />
                  <button
                    onClick={() => setRows((current) => current.filter((r) => r._rowId !== row._rowId))}
                    title="Remove row"
                    className="col-span-1 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => void handleCommit()}
                disabled={busy || !rows.length}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? 'Adding…' : `Create ${rows.length} leader${rows.length === 1 ? '' : 's'}`}
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
