'use client';

import { Section, Field, Toggle } from '../../../../../components/guildos/events/event-form-ui';
import { LINK_PLATFORM_META, type EventInput, type LinkPlatform } from '../../../../../components/guildos/api/event-api';
import { TicketingFields } from './ticketing-fields';
import { REMOVE_SQUARE, fromLocalInput, toLocalInput, type SectionProps } from './form-model';

type RegistrationQuestion = NonNullable<EventInput['registrationQuestions']>[number];

const QUESTION_GRID = 'grid-cols-[1fr_130px_1fr_78px_32px]';
const MAX_QUESTIONS = 8;

/** One-tap profile-link questions (the "+ LinkedIn" chips). */
const QUICK_LINKS: Array<{ platform: LinkPlatform; label: string }> = [
  { platform: 'LINKEDIN', label: 'LinkedIn profile' },
  { platform: 'GITHUB', label: 'GitHub profile' },
  { platform: 'X', label: 'X (Twitter) profile' },
  { platform: 'INSTAGRAM', label: 'Instagram profile' },
];

function RegistrationQuestionsField({ form, update }: SectionProps) {
  const questions = form.registrationQuestions ?? [];
  const patchQuestion = (index: number, patch: Partial<RegistrationQuestion>) =>
    update('registrationQuestions', questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  const addQuestion = (question: Partial<RegistrationQuestion>) =>
    update('registrationQuestions', [...questions, { key: '', label: '', type: 'TEXT' as const, options: [], required: false, ...question }]);
  const full = questions.length >= MAX_QUESTIONS;

  return (
    <Field label="Registration questions (optional)" as="div">
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Ask attendees for anything you need at sign-up: phone number, matric number, T-shirt size, profile links.
        Phone numbers and profile links prefill from the attendee&apos;s profile so most people never type them, and links are
        checked (a GitHub question only accepts a GitHub profile). Answers appear on the Attendees page and in the report.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK_LINKS.map((quick) => {
          const added = questions.some((q) => q.type === 'LINK' && q.platform === quick.platform);
          return (
            <button
              key={quick.platform}
              type="button"
              disabled={added || full}
              onClick={() => addQuestion({ label: quick.label, type: 'LINK', platform: quick.platform })}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:text-indigo-300"
            >
              {added ? '✓' : '+'} {LINK_PLATFORM_META[quick.platform].label}
            </button>
          );
        })}
        <button
          type="button"
          disabled={full}
          onClick={() => addQuestion({})}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:text-indigo-300"
        >
          + Custom
        </button>
      </div>
      {questions.length ? (
        <div className={`mb-1 grid ${QUESTION_GRID} gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500`}>
          <span>Question</span><span>Type</span><span>Choices</span><span>Required</span><span />
        </div>
      ) : null}
      {questions.map((q, i) => (
        <div key={i} className={`mb-2 grid ${QUESTION_GRID} items-center gap-2`}>
          <input className="ev-input" placeholder="e.g. Matric number" maxLength={120} value={q.label} onChange={(e) => patchQuestion(i, { label: e.target.value })} />
          <select className="ev-input" aria-label="Question type" value={q.type} onChange={(e) => patchQuestion(i, { type: e.target.value as RegistrationQuestion['type'] })}>
            <option value="TEXT">Text</option>
            <option value="PHONE">Phone number</option>
            <option value="SELECT">Dropdown</option>
            <option value="YES_NO">Yes / No</option>
            <option value="LINK">Link</option>
          </select>
          {q.type === 'LINK' ? (
            <select
              className="ev-input"
              aria-label="Link platform"
              title="Which site the link must point at"
              value={q.platform ?? 'WEBSITE'}
              onChange={(e) => patchQuestion(i, { platform: e.target.value as LinkPlatform })}
            >
              {(Object.keys(LINK_PLATFORM_META) as LinkPlatform[]).map((p) => (
                <option key={p} value={p}>{p === 'WEBSITE' ? 'Any website' : LINK_PLATFORM_META[p].label}</option>
              ))}
            </select>
          ) : q.type === 'SELECT' ? (
            <input
              className="ev-input"
              placeholder="Comma-separated, e.g. S, M, L, XL"
              title="Choices for the dropdown (comma-separated)"
              value={q.options.join(', ')}
              onChange={(e) => patchQuestion(i, { options: e.target.value.split(',').map((v) => v.trimStart()).slice(0, 10) })}
            />
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">Not needed</span>
          )}
          <input
            type="checkbox"
            aria-label="Required"
            className="h-4 w-4 justify-self-center accent-indigo-600"
            checked={q.required}
            onChange={(e) => patchQuestion(i, { required: e.target.checked })}
          />
          <button type="button" title="Remove question" onClick={() => update('registrationQuestions', questions.filter((_, idx) => idx !== i))} className={REMOVE_SQUARE}>
            ×
          </button>
        </div>
      ))}
      {full ? <p className="text-xs text-slate-500 dark:text-slate-400">That&apos;s the maximum of {MAX_QUESTIONS} questions.</p> : null}
    </Field>
  );
}

export function RegistrationSection({
  form, update, updateForm, ticketCommission, onError,
}: SectionProps & {
  updateForm: (patch: Partial<EventInput>) => void;
  ticketCommission: number | null;
  onError: (message: string) => void;
}) {
  return (
    <Section title="Registration & attendance">
      <fieldset className="space-y-3"><legend className="text-sm font-semibold">Will attendees also register on an external platform?</legend><div className="grid gap-3 sm:grid-cols-2">
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700"><input type="radio" name="registration-platform" checked={form.attendanceSource!=='EXTERNAL'} onChange={()=>updateForm({attendanceSource:'GUILDOS',partnerRegistrationUrl:'',partnerRegistrationLabel:'',qrEnabled:true,checkOutRequired:true})}/><span><strong className="block text-sm">No — use GuildOS</strong><span className="mt-1 block text-xs text-slate-500">Register here, then use GuildOS check-in and check-out to confirm attendance.</span></span></label>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700"><input type="radio" name="registration-platform" checked={form.attendanceSource==='EXTERNAL'} onChange={()=>updateForm({attendanceSource:'EXTERNAL',qrEnabled:false,checkOutRequired:false,allowWalkIns:false})}/><span><strong className="block text-sm">Yes — external platform</strong><span className="mt-1 block text-xs text-slate-500">Save a GuildOS registration, continue to the external site, then match the organizer's attendance report after the event.</span></span></label>
      </div></fieldset>
      {form.attendanceSource==='EXTERNAL'?<div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
       <Field label="External registration link *"><input type="url" required className="ev-input" placeholder="https://…" value={form.partnerRegistrationUrl??''} onChange={e=>update('partnerRegistrationUrl',e.target.value)}/></Field>
       <Field label="External platform name (optional)"><input className="ev-input" maxLength={60} placeholder="e.g. Microsoft or Luma" value={form.partnerRegistrationLabel??''} onChange={e=>update('partnerRegistrationLabel',e.target.value)}/></Field>
       <p className="text-sm text-slate-600 dark:text-slate-400">GuildOS check-in and check-out are disabled. After the event, import the external attendance report on Attendees. Only matched, eligible attendance can receive a certificate; clicking the link does not prove registration or attendance.</p>
      </div>:<p className="text-sm text-slate-500">Attendance is recorded on GuildOS. Configure check-in and certificates in Event options.</p>}
      {form.attendanceSource!=='EXTERNAL'&&form.partnerRegistrationUrl?<p role="alert" className="text-sm text-amber-700">This event has an older external registration link. Choose external platform to keep it, or <button type="button" className="underline" onClick={()=>updateForm({partnerRegistrationUrl:'',partnerRegistrationLabel:''})}>remove that link</button> to use GuildOS only.</p>:null}
      <h3 className="border-t border-slate-200 pt-4 text-sm font-semibold dark:border-slate-800">GuildOS registration details</h3>
      <Field label="Attendee group chat (optional)">
        <input
          className="ev-input"
          placeholder="https://chat.whatsapp.com/… or a Telegram/Discord link"
          value={form.attendeeChatLink ?? ''}
          onChange={(e) => update('attendeeChatLink', e.target.value.slice(0, 300))}
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Shown <strong>only to registered attendees</strong> (ticket holders on paid events), never on the public page.
          Sections can each have their own group below in the Sections editor.
        </p>
      </Field>
      <RegistrationQuestionsField form={form} update={update} />
      <TicketingFields form={form} update={update} updateForm={updateForm} ticketCommission={ticketCommission} onError={onError} />
      <Field label="Registration Deadline"><input type="datetime-local" className="ev-input" value={toLocalInput(form.registrationDeadline)} onChange={(e) => update('registrationDeadline', fromLocalInput(e.target.value))} /></Field>
    </Section>
  );
}
