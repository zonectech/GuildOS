'use client';
import { useCallback, useMemo, useState } from 'react';
import { BarChart3, Download, RefreshCw, Search } from 'lucide-react';
import { downloadCsv, type AttendanceRecord } from '@/lib/api/host';
import type { RegistrationQuestion } from '@/lib/api/types';
import { ATTENDEE_STATUS, attendeeExportFields, attendeeExportRows, questionStatistics, submissionProgress, submissionQuestions } from '@/lib/attendee-submissions';
import { Btn } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';
import { SubmissionPie } from '@/components/host/submission-pie';

export function AttendeeTools({ people, filteredPeople, questions, slug, external, onRefresh }: {
  people: AttendanceRecord[]; filteredPeople: AttendanceRecord[]; questions: RegistrationQuestion[];
  slug: string; external: boolean; onRefresh: () => Promise<void>;
}) {
  const [panel, setPanel] = useState<'export' | 'stats' | null>(null);
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered');
  const [chosen, setChosen] = useState<string[]>(['name', 'email']);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const close = useCallback(() => setPanel(null), []);
  const fields = useMemo(() => attendeeExportFields(people, questions), [people, questions]);
  const rows = scope === 'all' ? people : filteredPeople;
  const selected = fields.filter((field) => chosen.includes(field.id));
  const visibleFields = fields.filter((field) => `${field.label} ${field.group}`.toLowerCase().includes(search.trim().toLowerCase()));
  const groups = [...new Set(visibleFields.map((field) => field.group))];
  const statsQuestions = submissionQuestions(questions, people);
  const statuses = Object.entries(ATTENDEE_STATUS).map(([status, label]) => ({ status, label, count: rows.filter((p) => p.status === status).length })).filter((s) => s.count);
  const allRequired = rows.filter((p) => submissionProgress(p, questions).missingRequired === 0).length;
  function exportCsv() {
    downloadCsv(`${slug}-attendees-${scope === 'all' ? 'all' : 'current-list'}.csv`, attendeeExportRows(rows, fields, selected.map((field) => field.id)));
  }
  async function refresh() {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }
  return <>
    <div className="flex flex-wrap gap-2">
      <Btn kind="secondary" size="sm" onClick={() => void refresh()} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Refreshing…' : 'Refresh attendees'}</Btn>
      <Btn kind="secondary" size="sm" onClick={() => setPanel('stats')}><BarChart3 size={15} />Submission statistics</Btn>
      <Btn kind="secondary" size="sm" onClick={() => setPanel('export')} disabled={!people.length}><Download size={15} />Export CSV</Btn>
    </div>
    <Sheet open={Boolean(panel)} onClose={close} title={panel === 'stats' ? 'Submission statistics' : 'Choose fields to export'} width={480}>
      <div className="flex flex-col gap-5 px-5 pb-6">
        {external ? <p className="rounded-xl bg-mist p-3 text-[13px]">These records are saved in Kintriva. Submissions and answers on the external partner’s form are not included.</p> : null}
        <fieldset className="flex flex-col gap-2 rounded-2xl border border-line p-4"><legend className="px-1 text-[14px] font-bold">Which attendees?</legend>
          <label className="flex items-center gap-2 text-[14px]"><input type="radio" name="attendee-scope" checked={scope === 'filtered'} onChange={() => setScope('filtered')} className="size-4 accent-green" />Current list ({filteredPeople.length})</label>
          <label className="flex items-center gap-2 text-[14px]"><input type="radio" name="attendee-scope" checked={scope === 'all'} onChange={() => setScope('all')} className="size-4 accent-green" />All records ({people.length}), including cancelled and declined</label>
          <p className="mt-1 text-[12px] text-muted">Current list follows your attendee search and status filter, including everyone beyond the first 200 shown.</p>
        </fieldset>
        {panel === 'export' ? <>
          <p className="text-[14px] text-muted">Choose one field, several fields, or everything. Only selected fields are included in your download.</p>
          <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5"><Search size={16} className="text-muted" /><input aria-label="Find an export field" placeholder="Find name, email, phone, questions…" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" /></label>
          <div className="flex flex-wrap items-center gap-3 text-[13px]"><button type="button" onClick={() => setChosen(fields.map((f) => f.id))} className="font-bold text-green-text hover:underline">Select all fields</button><button type="button" onClick={() => setChosen([])} className="font-bold text-green-text hover:underline">Clear selection</button><span aria-live="polite" className="text-muted">{selected.length} of {fields.length} selected</span></div>
          {groups.map((group) => <fieldset key={group} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line p-4"><legend className="px-1 text-[14px] font-bold">{group}</legend>{visibleFields.filter((f) => f.group === group).map((field) => <label key={field.id} className="flex min-w-0 items-start gap-3 text-[14px]"><input type="checkbox" checked={chosen.includes(field.id)} onChange={(e) => setChosen((old) => e.target.checked ? [...old, field.id] : old.filter((id) => id !== field.id))} className="mt-0.5 size-4 shrink-0 accent-green" /><span className="min-w-0 break-words">{field.label}</span></label>)}</fieldset>)}
          {!visibleFields.length ? <p className="text-[14px] text-muted">No fields match. Try another name.</p> : null}
          <p className="text-[12px] text-muted">Phone numbers are available only when submitted for this event. Blank cells mean the detail was not provided. Earlier questions remain available.</p>
          <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-raised pt-3 pb-1"><p className="text-[13px] text-muted">{rows.length} attendee{rows.length === 1 ? '' : 's'} · {selected.length} field{selected.length === 1 ? '' : 's'}</p><Btn wide onClick={exportCsv} disabled={!selected.length || !rows.length}><Download size={16} />Download selected fields</Btn></div>
        </> : panel === 'stats' ? <>
          <div className="grid grid-cols-2 gap-3"><Metric label="Saved registrations" value={rows.length} /><Metric label="Checked in" value={rows.filter((p) => p.checkInAt).length} /></div>
          <section><h3 className="font-bold">Registration status</h3><div className="mt-3"><SubmissionPie title="Registration status" values={statuses.map((s) => ({ label: s.label, count: s.count }))} />{!rows.length ? <p className="mt-2 text-[14px] text-muted">No registrations in this selection.</p> : null}</div></section>
          {!external && questions.some((q) => q.required) ? <p className="rounded-xl bg-mist p-3 text-[13px]"><b>{allRequired} of {rows.length}</b> have all current required answers saved. Questions may have been added after earlier registrations; this does not change anyone’s registration status.</p> : null}
          <section className="flex flex-col gap-3"><h3 className="font-bold">Answers by question</h3><p className="text-[12px] text-muted">Counts use the attendees selected above. Choice percentages are based on people who answered that question. Missing answers can include people who registered before the question was added.</p>
            {statsQuestions.map((question) => {
              const stats = questionStatistics(question, rows);
              return <div key={question.key} className="min-w-0 rounded-2xl border border-line p-4"><h4 className="break-words text-[15px] font-bold">{question.label}</h4>{question.earlier ? <p className="mt-1 text-[12px] text-muted">Earlier question · removed from the current form</p> : null}<p className="mt-2 text-[13px] text-muted"><b className="text-ink">{stats.answered}</b> answered · {stats.unanswered} without a saved answer</p>
                <div className="mt-3"><SubmissionPie title={`${question.label} responses`} values={stats.choices.length ? stats.choices.map((choice) => ({ label: choice.value + (choice.earlier ? ' (earlier choice)' : ''), count: choice.count })) : [{ label: 'Answered', count: stats.answered }, { label: 'No answer saved', count: stats.unanswered }]} /></div>
              </div>;
            })}
            {!statsQuestions.length ? <p className="py-3 text-[14px] text-muted">No extra registration questions have been collected.</p> : null}
          </section>
        </> : null}
      </div>
    </Sheet>
  </>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-line p-4"><b className="block text-[28px] tabular-nums">{value}</b><span className="text-[12px] text-muted">{label}</span></div>;
}
