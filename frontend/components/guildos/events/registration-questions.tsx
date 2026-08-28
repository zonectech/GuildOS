'use client';

/**
 * Registration questions — the attendee-facing form for an event's custom
 * registration fields, shared by the register flow, ticket checkout, and
 * guest ticket claims on the event page.
 *
 * PHONE questions are prefilled from the viewer's profile (passed in via
 * `phonePrefill`); the backend saves a newly-typed number back to an empty
 * profile so attendees never type it twice.
 */

import type { RegistrationQuestion } from '../event-api';

export function answersReady(questions: RegistrationQuestion[], answers: Record<string, string>) {
  return questions.every((q) => !q.required || (answers[q.key] ?? '').trim());
}

export function RegistrationQuestionsForm({
  questions,
  answers,
  onChange,
  disabled,
}: {
  questions: RegistrationQuestion[];
  answers: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
}) {
  if (!questions.length) return null;

  function set(key: string, value: string) {
    onChange({ ...answers, [key]: value });
  }

  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <label key={q.key} className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
            {q.label}
            {q.required ? <span className="ml-0.5 text-rose-500">*</span> : <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">(optional)</span>}
          </span>
          {q.type === 'SELECT' ? (
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={answers[q.key] ?? ''}
              disabled={disabled}
              onChange={(e) => set(q.key, e.target.value)}
            >
              <option value="">Choose…</option>
              {q.options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : q.type === 'YES_NO' ? (
            <div className="flex gap-2">
              {(['Yes', 'No'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  onClick={() => set(q.key, answers[q.key] === option ? '' : option)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
                    answers[q.key] === option
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              type={q.type === 'PHONE' ? 'tel' : 'text'}
              inputMode={q.type === 'PHONE' ? 'tel' : undefined}
              placeholder={q.type === 'PHONE' ? 'e.g. 0803 123 4567' : 'Your answer'}
              maxLength={500}
              value={answers[q.key] ?? ''}
              disabled={disabled}
              onChange={(e) => set(q.key, e.target.value)}
            />
          )}
        </label>
      ))}
    </div>
  );
}
