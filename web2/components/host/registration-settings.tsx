'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { saveDraft } from '@/lib/api/host';
import type { RegistrationQuestion } from '@/lib/api/types';
import { Btn } from '@/components/ui/bits';
import { useToast } from '@/components/ui/toast';

const field = 'w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-green-text';
const kinds = { TEXT: 'Short answer', PHONE: 'Phone number', SELECT: 'Choose one', YES_NO: 'Yes / No', LINK: 'Website or social link' };

export function registrationQuestionError(questions: RegistrationQuestion[]) {
  return questions.some((q) => !q.label.trim() || (q.type === 'SELECT' && new Set(q.options.map((o) => o.trim()).filter(Boolean)).size < 2))
    ? 'Give every question a label. Choice questions need at least two different options.' : '';
}

export function RegistrationSettings({ eventId, initial, external, locked, onSaved }: {
  eventId: string; initial: RegistrationQuestion[]; external: boolean; locked: boolean;
  onSaved: (questions: RegistrationQuestion[]) => void;
}) {
  const [questions, setQuestions] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const dirty = JSON.stringify(questions) !== JSON.stringify(initial);
  async function save() {
    const cleaned = questions.map((q) => ({ ...q, label: q.label.trim(), options: [...new Set(q.options.map((o) => o.trim()).filter(Boolean))] }));
    const problem = registrationQuestionError(cleaned);
    if (problem) {
      setError(problem); return;
    }
    setBusy(true); setError('');
    try { const result = await saveDraft(eventId, { registrationQuestions: cleaned }); setQuestions(result.draft.registrationQuestions); onSaved(result.draft.registrationQuestions); toast('Registration form saved'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save the form'); }
    finally { setBusy(false); }
  }
  if (external) return <section id="registration" className="scroll-mt-24 rounded-[22px] border border-line bg-surface p-5"><h2 className="text-[20px] font-extrabold">Registration</h2><p className="mt-2 text-muted">This event uses an external registration link. Manage questions and guest responses on the partner site. Kintriva only shows details shared here.</p></section>;
  return (
    <section id="registration" className="scroll-mt-24 flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-5">
      <div><h2 className="text-[20px] font-extrabold">Registration form</h2><p className="mt-1 text-[14px] text-muted">Name and email come from the attendee’s account. School and department are included when available. Ask only for extra details you need for this event.</p></div>
      <div className="rounded-xl bg-mist p-3 text-[14px]"><b>Already included</b><p>Name · Email · School · Department</p></div>
      <p className="text-[13px] text-muted">Up to 8 extra questions. Changes apply to future registrations. Earlier answers stay with each attendee.</p>
      {locked ? <p className="text-[14px] text-muted">This event has ended. Registration questions are read-only.</p> : null}
      <QuestionEditor questions={questions} onChange={setQuestions} busy={busy} locked={locked} />
      {error ? <p role="alert" className="text-[14px] text-red-600">{error}</p> : null}
      {!locked ? <div className="flex flex-wrap items-center gap-3"><Btn onClick={() => void save()} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save registration form'}</Btn>{dirty ? <span className="text-[13px] text-muted">Unsaved changes</span> : null}</div> : null}
    </section>
  );
}

export function QuestionEditor({ questions, onChange, busy = false, locked = false }: { questions: RegistrationQuestion[]; onChange: (questions: RegistrationQuestion[]) => void; busy?: boolean; locked?: boolean }) {
  function patch(key: string, changes: Partial<RegistrationQuestion>) { onChange(questions.map((q) => q.key === key ? { ...q, ...changes } : q)); }
  return (      <fieldset disabled={busy || locked} className="flex min-w-0 flex-col gap-4">
        {questions.map((q, i) => <div key={q.key} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line p-4">
          <div className="flex items-center justify-between gap-2"><b className="text-[14px]">Question {i + 1}</b><button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => onChange(questions.filter((x) => x.key !== q.key))} className="rounded-lg p-2 text-muted hover:bg-mist disabled:opacity-40"><Trash2 size={17} /></button></div>
          <label className="flex flex-col gap-1.5 text-[14px] font-semibold">Question<input className={field} value={q.label} maxLength={120} onChange={(e) => patch(q.key, { label: e.target.value })} placeholder="e.g. What would you like to learn?" /></label>
          <label className="flex flex-col gap-1.5 text-[14px] font-semibold">Answer type<select className={field} value={q.type} onChange={(e) => patch(q.key, { type: e.target.value as RegistrationQuestion['type'] })}>{Object.entries(kinds).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          {q.type === 'SELECT' ? <label className="flex flex-col gap-1.5 text-[14px] font-semibold">Choices (one per line, up to 10)<textarea rows={3} className={field} value={q.options.join('\n')} onChange={(e) => patch(q.key, { options: e.target.value.split('\n').slice(0, 10).map((o) => o.slice(0, 80)) })} /></label> : null}
          {q.type === 'LINK' ? <label className="flex flex-col gap-1.5 text-[14px] font-semibold">Website<select className={field} value={q.platform} onChange={(e) => patch(q.key, { platform: e.target.value })}>{['WEBSITE', 'LINKEDIN', 'GITHUB', 'X', 'INSTAGRAM'].map((p) => <option key={p} value={p}>{p === 'WEBSITE' ? 'Any website' : p === 'X' ? 'X (Twitter)' : p.charAt(0) + p.slice(1).toLowerCase()}</option>)}</select></label> : null}
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={q.required} onChange={(e) => patch(q.key, { required: e.target.checked })} className="size-4 accent-green" />Required to register</label>
        </div>)}
        {!questions.length ? <p className="py-3 text-[14px] text-muted">No extra questions. Students can register with their account details.</p> : null}
        {!locked ? <Btn type="button" kind="secondary" onClick={() => onChange([...questions, { key: crypto.randomUUID(), label: '', type: 'TEXT', options: [], platform: 'WEBSITE', required: false }])} disabled={busy || questions.length >= 8}><Plus size={16} />Add a question</Btn> : null}
      </fieldset>);
}
