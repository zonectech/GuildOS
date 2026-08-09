'use client';

import { useEffect, useState } from 'react';
import { FileText, Plus, Trash2, ExternalLink, Pencil } from 'lucide-react';

import {
  getMyCredentials, getUserCredentials, createCredential, updateCredential, deleteCredential,
  uploadCredentialFile, resolveCredentialFileUrl, type ExternalCredential,
} from './credential-api';
import { toast } from './ui/toast';

const MAX_CREDENTIALS = 10;

function formatDate(iso: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

/**
 * Editable "Other credentials" card for the account/settings pages — lets a
 * user attach external, self-reported credentials (Coursera, internships,
 * past hackathons, etc). These are NOT verified by GuildOS and are kept
 * visually + structurally separate from the cryptographically-verified
 * Certificates gallery.
 */
export function OtherCredentialsCard() {
  const [credentials, setCredentials] = useState<ExternalCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const result = await getMyCredentials();
        setCredentials(result.credentials);
      } catch {
        // best-effort — leave list empty
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function resetForm() {
    setTitle('');
    setIssuer('');
    setIssueDate('');
    setDescription('');
    setFile(null);
    setAdding(false);
    setEditingId(null);
  }

  function startEdit(c: ExternalCredential) {
    setTitle(c.title);
    setIssuer(c.issuer);
    setIssueDate(c.issueDate ? c.issueDate.slice(0, 10) : '');
    setDescription(c.description);
    setFile(null);
    setEditingId(c.id);
    setAdding(true);
  }

  async function handleAdd() {
    if (!title.trim()) {
      toast.error('A title is required');
      return;
    }
    setBusy(true);
    try {
      let fileUrl = '';
      let fileName = '';
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        const uploaded = await uploadCredentialFile(fd);
        fileUrl = uploaded.file;
        fileName = uploaded.fileName;
      }
      const payload = {
        title: title.trim(),
        issuer: issuer.trim(),
        issueDate: issueDate || null,
        description: description.trim(),
        fileUrl,
        fileName,
      };
      if (editingId) {
        const result = await updateCredential(editingId, payload);
        setCredentials((list) => list.map((c) => (c.id === editingId ? result.credential : c)));
        toast.success('Credential updated');
      } else {
        const result = await createCredential(payload);
        setCredentials((list) => [result.credential, ...list]);
        toast.success('Credential added');
      }
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save credential');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCredential(id);
      setCredentials((list) => list.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to remove credential');
    }
  }

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Other credentials</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Add certificates or credentials you earned elsewhere (Coursera, internships, past hackathons). These are self-reported and shown separately from your GuildOS-verified certificates.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-2">
          {credentials.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{c.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[c.issuer, formatDate(c.issueDate)].filter(Boolean).join(' · ') || 'No issuer or date given'}
                </p>
                {c.description ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.description}</p> : null}
                {c.fileUrl ? (
                  <a href={resolveCredentialFileUrl(c.fileUrl)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
                    <FileText className="h-3.5 w-3.5" /> View file <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => startEdit(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Edit credential">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => void handleDelete(c.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" aria-label="Remove credential">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {!credentials.length ? <p className="text-xs text-slate-400 dark:text-slate-500">No other credentials added yet.</p> : null}
        </div>
      )}

      {adding ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600 dark:text-slate-400">Title *</span>
              <input className="ev-input w-full" placeholder="e.g. Google Data Analytics Certificate" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600 dark:text-slate-400">Issuer</span>
              <input className="ev-input w-full" placeholder="e.g. Coursera" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600 dark:text-slate-400">Date issued</span>
              <input type="date" className="ev-input w-full" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600 dark:text-slate-400">Attach file (PDF/image, optional)</span>
              <input type="file" accept=".pdf,image/*" className="w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-400">Description</span>
            <textarea className="ev-input w-full" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button onClick={() => void handleAdd()} disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Save credential'}
            </button>
            <button onClick={resetForm} disabled={busy} className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={credentials.length >= MAX_CREDENTIALS}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add a credential
        </button>
      )}
      {credentials.length >= MAX_CREDENTIALS ? <p className="text-xs text-slate-400">You've reached the {MAX_CREDENTIALS}-credential limit.</p> : null}
    </section>
  );
}

/**
 * Read-only "Other credentials" section for public profile pages. Renders
 * nothing while loading/empty so it never clutters a profile that has none.
 */
export function OtherCredentialsSection({ username }: { username: string }) {
  const [credentials, setCredentials] = useState<ExternalCredential[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getUserCredentials(username);
        if (!cancelled) setCredentials(result.credentials);
      } catch {
        // profile may be private or user not found — just show nothing
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [username]);

  if (!loaded || !credentials.length) return null;

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <FileText className="h-4 w-4" /> Other credentials
        </h3>
        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">Self-reported</span>
      </div>
      <div className="space-y-2">
        {credentials.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{[c.issuer, formatDate(c.issueDate)].filter(Boolean).join(' · ')}</p>
            {c.description ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.description}</p> : null}
            {c.fileUrl ? (
              <a href={resolveCredentialFileUrl(c.fileUrl)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
                View <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
