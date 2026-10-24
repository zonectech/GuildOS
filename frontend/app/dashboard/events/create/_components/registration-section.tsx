'use client';

import { SelectMenu } from '../../../../../components/guildos/ui/select-menu';
import { Section, Field, Toggle } from '../../../../../components/guildos/events/event-form-ui';
import { LINK_PLATFORM_META, type EventInput, type LinkPlatform } from '../../../../../components/guildos/event-api';
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
    <Section title="Registration Settings">
      <Field label="Registration Policy">
        <SelectMenu
          aria-label="Registration policy"
          value={form.registrationPolicy ?? 'OPEN'}
          onChange={(v) => update('registrationPolicy', v as EventInput['registrationPolicy'])}
          options={[
            { value: 'OPEN', label: 'Open', description: 'Anyone registers instantly' },
            { value: 'APPROVAL', label: 'Approval', description: 'You approve each request' },
            { value: 'INVITE', label: 'Invite only', description: 'Only people with your invite link' },
          ]}
        />
        {form.registrationPolicy === 'INVITE' ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">After publishing, use “Copy invite link” on the Events dashboard. Only people who open that link can register.</p>
        ) : null}
      </Field>
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
      {/* Chapters of parent orgs (MLSA, GDG…) often must capture attendees on the org's own form too.
          GuildOS stays the source of truth for attendance — this link is shown as a follow-up step. */}
      <Field label="Official partner registration link (optional)">
        <input className="ev-input" placeholder="https://forms.office.com/…" value={form.partnerRegistrationUrl ?? ''} onChange={(e) => update('partnerRegistrationUrl', e.target.value)} />
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">For chapters that must also capture attendees on their parent org&apos;s form (e.g. Microsoft for MLSA). Attendees are asked to complete it right after registering here.</span>
      </Field>
      {form.partnerRegistrationUrl ? (
        <Field label="Partner name">
          <input className="ev-input" placeholder="Microsoft" maxLength={60} value={form.partnerRegistrationLabel ?? ''} onChange={(e) => update('partnerRegistrationLabel', e.target.value)} />
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Shown as &ldquo;Complete the Microsoft registration&rdquo;.</span>
        </Field>
      ) : null}
      <Toggle label="Allow walk-ins" checked={Boolean(form.allowWalkIns)} onChange={(v) => update('allowWalkIns', v)} />
      <Toggle label="Enable QR attendance" checked={Boolean(form.qrEnabled)} onChange={(v) => update('qrEnabled', v)} />
      <Field label="Visibility">
        <SelectMenu
          aria-label="Visibility"
          value={form.visibility ?? 'PUBLIC'}
          onChange={(v) => update('visibility', v as EventInput['visibility'])}
          options={['PUBLIC', 'PRIVATE', 'UNLISTED'].map((v) => ({ value: v, label: v }))}
        />
      </Field>
    </Section>
  );
}
