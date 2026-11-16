'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api/client';
import type { Registration, RegistrationQuestion, User } from '@/lib/api/types';
import { Btn } from '@/components/ui/bits';

type Details = { phoneNumber?: string; socialLinks?: string[]; university?: string; department?: string };
const field = 'w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-3 text-[15px] outline-none focus:border-green-text';
const hosts: Record<string, string[]> = { LINKEDIN: ['linkedin.com'], GITHUB: ['github.com'], X: ['x.com', 'twitter.com'], INSTAGRAM: ['instagram.com'] };
function savedLink(platform: string, links: string[]) {
  if (!hosts[platform]) return '';
  return links.find((link) => {
    try { const h = new URL(link).hostname.toLowerCase().replace(/^www\./, ''); return hosts[platform].some((host) => h === host || h.endsWith(`.${host}`)); } catch { return false; }
  }) ?? '';
}

export function RegistrationForm({ questions, viewer, busy, onSubmit, initialAnswers, editing = false }: {
  questions: RegistrationQuestion[]; viewer: User; busy: boolean;
  initialAnswers?: Registration['answers']; editing?: boolean;
  onSubmit: (answers: Record<string, string>) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  // Event pages refresh in the background. Identical questions must not erase a form in progress.
  const signature = JSON.stringify(questions);
  const formQuestions = useMemo(() => JSON.parse(signature) as RegistrationQuestion[], [signature]);
  const answerSignature = JSON.stringify(initialAnswers ?? []);
  const savedAnswers = useMemo(() => JSON.parse(answerSignature) as NonNullable<Registration['answers']>, [answerSignature]);
  useEffect(() => {
    let alive = true;
    setError('');
    api<{ user: { profile?: Details } }>('/api/profile').then(({ user }) => {
      if (!alive) return;
      const p = user.profile ?? {};
      setDetails(p);
      setAnswers(Object.fromEntries(formQuestions.map((q) => [q.key, editing ? savedAnswers.find((a) => a.key === q.key)?.value ?? '' : q.type === 'PHONE' ? p.phoneNumber ?? '' : q.type === 'LINK' ? savedLink(q.platform, p.socialLinks ?? []) : ''])));
    }).catch(() => { if (alive) setError('We couldn’t load your details. Please try again.'); });
    return () => { alive = false; };
  }, [formQuestions, savedAnswers, editing, attempt]);
  if (!details) return <div className="px-5 pb-6">{error ? <div role="alert"><p className="mb-3">{error}</p><Btn onClick={() => setAttempt((n) => n + 1)}>Try again</Btn></div> : <div className="shimmer h-36 rounded-xl" aria-label="Loading your details" />}</div>;
  return <form className="flex flex-col gap-5 px-5 pb-6" onSubmit={(e) => { e.preventDefault(); void onSubmit(answers); }}>
    {editing ? <p className="text-[14px] text-muted">You can update your answers before the event starts. Your place and QR pass stay the same.</p> : null}
    <div className="rounded-2xl bg-mist p-4 text-[14px]"><b className="block">{viewer.fullName}</b><p className="break-all">{viewer.email}</p>{details.university ? <p>{details.university}</p> : null}{details.department ? <p>{details.department}</p> : null}<p className="mt-2 text-[13px] text-muted">These account details and your answers below are shared with the event organizers.</p></div>
    <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
      {questions.map((q) => <label key={q.key} className="flex min-w-0 flex-col gap-1.5 text-[14px] font-semibold">{q.label} {q.required ? '(required)' : '(optional)'}
        {q.type === 'SELECT' || q.type === 'YES_NO' ? <select className={field} required={q.required} value={answers[q.key] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}><option value="">Choose an answer</option>{(q.type === 'YES_NO' ? ['Yes', 'No'] : q.options).map((v) => <option key={v} value={v}>{v}</option>)}</select>
          : <input className={field} type={q.type === 'PHONE' ? 'tel' : 'text'} autoComplete={q.type === 'PHONE' ? 'tel' : 'off'} maxLength={500} required={q.required} value={answers[q.key] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))} placeholder={q.type === 'LINK' ? q.platform === 'WEBSITE' ? 'https://…' : `${q.platform.toLowerCase()} profile URL or handle` : undefined} />}
      </label>)}
    </fieldset>
    {questions.some((q) => q.type === 'PHONE' || (q.type === 'LINK' && q.platform !== 'WEBSITE')) ? <p className="text-[12px] text-muted">A new phone number or social link is also saved to your profile for next time. Your profile’s visibility settings still apply.</p> : null}
    {editing && savedAnswers.some((a) => !questions.some((q) => q.key === a.key)) ? <div className="rounded-2xl bg-mist p-4"><h3 className="text-[14px] font-bold">Earlier answers</h3><p className="mt-1 text-[12px] text-muted">The organizer removed these questions. Your original answers are kept.</p><dl className="mt-3 flex flex-col gap-3">{savedAnswers.filter((a) => !questions.some((q) => q.key === a.key)).map((a) => <div key={a.key}><dt className="text-[13px] text-muted">{a.label}</dt><dd className="break-words text-[14px]">{a.value}</dd></div>)}</dl></div> : null}
    <Btn wide size="lg" type="submit" disabled={busy}>{busy ? editing ? 'Saving…' : 'Registering…' : editing ? 'Save answers' : 'Confirm registration'}</Btn>
  </form>;
}
