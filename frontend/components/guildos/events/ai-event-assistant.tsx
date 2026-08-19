'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, UploadCloud, X } from 'lucide-react';
import { generateEventDraft, parseEventDocument, type RichEventDraft } from '../event-api';
import { Button } from '../ui/button';
import { Section } from './event-form-ui';

type Mode = 'prompt' | 'document';

export function AiEventAssistant({ onApply }: { onApply: (draft: RichEventDraft) => void }) {
  const [mode, setMode] = useState<Mode>('prompt');
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dayMode, setDayMode] = useState<'single' | 'multi' | 'auto'>('auto');
  const [draft, setDraft] = useState<RichEventDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    try {
      setBusy(true);
      setError('');
      setDraft(null);
      const result = await generateEventDraft(prompt);
      setDraft(result.draft as RichEventDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate draft');
    } finally {
      setBusy(false);
    }
  }

  async function handleParseDocument() {
    if (!file) return;
    try {
      setBusy(true);
      setError('');
      setDraft(null);
      const result = await parseEventDocument(file, dayMode);
      setDraft(result.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to parse document');
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setDraft(null);
    setError('');
  }

  function clearFile() {
    setFile(null);
    setDraft(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <Section title="AI Event Assistant">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 p-1 w-fit">
        <button
          type="button"
          onClick={() => { setMode('prompt'); setDraft(null); setError(''); }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            mode === 'prompt'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Describe event
        </button>
        <button
          type="button"
          onClick={() => { setMode('document'); setDraft(null); setError(''); }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            mode === 'document'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <UploadCloud className="h-3.5 w-3.5" />
          Upload document
        </button>
      </div>

      {/* Prompt mode */}
      {mode === 'prompt' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">Describe your event in a sentence and generate a starting draft you can edit.</p>
          <textarea
            className="ev-input min-h-20"
            placeholder="e.g. We want to teach first-year students Git and GitHub."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => void handleGenerate()} disabled={busy || !prompt.trim()}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : 'Generate Draft'}
            </Button>
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
        </div>
      )}

      {/* Document mode */}
      {mode === 'document' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Upload a PDF, Word (.docx), or text file containing your event details. The AI will read it and auto-fill the form.
          </p>

          {!file ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-6 py-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20">
              <FileText className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Click to choose a file</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">PDF, DOCX, or TXT — up to 10 MB</span>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-indigo-500" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{file.name}</span>
              <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={clearFile} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Event length:</span>
            {([
              { value: 'auto', label: 'Let AI decide' },
              { value: 'single', label: 'Single day' },
              { value: 'multi', label: 'Multi-day' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDayMode(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  dayMode === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => void handleParseDocument()} disabled={busy || !file}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading document…</> : 'Extract Event Details'}
            </Button>
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
        </div>
      )}

      {/* Draft preview */}
      {draft ? (
        <div className="mt-2 space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
          <DraftField label="Title">{draft.title}</DraftField>
          {draft.summary ? <DraftField label="Short description (card blurb)">{draft.summary}</DraftField> : null}
          <DraftField label="Description">{draft.description}</DraftField>
          {draft.venue ? <DraftField label="Venue">{draft.venue}</DraftField> : null}
          {draft.address ? <DraftField label="Address">{draft.address}</DraftField> : null}
          {draft.meetingLink ? <DraftField label="Meeting link">{draft.meetingLink}</DraftField> : null}
          {draft.date ? <DraftField label="Date">{draft.date}{draft.startTime ? ` at ${draft.startTime}` : ''}{draft.endTime ? ` – ${draft.endTime}` : ''}</DraftField> : null}
          {draft.timezone ? <DraftField label="Timezone">{draft.timezone}</DraftField> : null}
          {draft.type ? <DraftField label="Type">{draft.type.replace(/_/g, ' ')}</DraftField> : null}
          {draft.mode ? <DraftField label="Mode">{draft.mode}</DraftField> : null}
          {draft.capacity ? <DraftField label="Capacity">{draft.capacity} participants</DraftField> : null}
          {draft.ticketPrice ? <DraftField label="Ticket price">₦{draft.ticketPrice.toLocaleString('en-NG')}</DraftField> : null}
          {draft.registrationDeadline ? <DraftField label="Registration deadline">{draft.registrationDeadline}</DraftField> : null}
          {draft.refreshments ? <DraftField label="Refreshments">✓ Will be provided</DraftField> : null}
          {draft.features?.length ? <DraftField label="What to expect">{draft.features.join(' · ')}</DraftField> : null}
          {draft.days?.length ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Day-by-day agenda ({draft.days.length} days)</p>
              <ul className="mt-1 space-y-2">
                {draft.days.map((day, i) => (
                  <li key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      Day {i + 1}{day.date ? ` — ${day.date}` : ''}{day.theme ? `: ${day.theme}` : ''}
                    </p>
                    {(day.startTime || day.venue) ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {[day.startTime && `${day.startTime}${day.endTime ? `–${day.endTime}` : ''}`, day.venue].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                    {day.sessions.length ? (
                      <ul className="mt-1 list-disc pl-5 text-xs text-slate-600 dark:text-slate-400">
                        {day.sessions.map((s, j) => <li key={j}>{[s.time, s.title].filter(Boolean).join(' — ')}</li>)}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {draft.agenda?.length ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Agenda</p>
              <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
                {draft.agenda.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          ) : null}
          {draft.audience ? <DraftField label="Audience">{draft.audience}</DraftField> : null}
          {draft.tags?.length ? <DraftField label="Tags">{draft.tags.join(', ')}</DraftField> : null}
          {draft.contacts?.length ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Contacts</p>
              <ul className="mt-1 space-y-1">
                {draft.contacts.map((c, i) => (
                  <li key={i} className="text-sm text-slate-700 dark:text-slate-300">
                    {c.name}{c.phone ? ` · ${c.phone}` : ''}{c.email ? ` · ${c.email}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {draft.people?.length ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Speakers / Trainers</p>
              <ul className="mt-1 space-y-2">
                {draft.people.map((p, i) => (
                  <li key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{p.fullName}</span>
                      <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                        {p.speakerType === 'TRAINER' ? 'Trainer' : p.speakerType === 'PANEL' ? 'Panelist' : p.speakerType === 'WORKSHOP' ? 'Workshop Speaker' : 'Guest Speaker'}
                      </span>
                    </div>
                    {(p.title || p.organization) ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {[p.title, p.organization].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                    {p.bio ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{p.bio}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex items-center gap-3 pt-1">
            <Button variant="primary" onClick={() => onApply(draft)}>Apply to form</Button>
            <span className="text-xs text-slate-400 dark:text-slate-500">{draft.source === 'ai' ? 'Extracted by AI' : 'Template draft'}</span>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function DraftField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-sm text-slate-700 dark:text-slate-300">{children}</p>
    </div>
  );
}
