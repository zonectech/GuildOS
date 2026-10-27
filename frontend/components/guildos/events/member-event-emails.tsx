'use client';

import { useEffect, useState } from 'react';
import { externalRequest } from './external-event-api';

export function MemberEventEmails({ guildosEmail }: { guildosEmail: string }) {
  const [copyMessage, setCopyMessage] = useState('');
  const [emails, setEmails] = useState<{ email: string }[]>([]);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void externalRequest<{ emails: { email: string }[] }>('member-emails')
      .then(result => { if (active) setEmails(result.emails); })
      .catch(() => { if (active) setError('Unable to load linked emails. You can still verify an email below.'); });
    return () => { active = false; };
  }, []);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(guildosEmail);
      setCopyMessage('Email copied. Use it on the external site.');
    } catch {
      setCopyMessage('Unable to copy. Select and copy the email shown above.');
    }
  }

  async function act(verify: boolean) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (verify) {
        const result = await externalRequest<{ emails: { email: string }[] }>('member-emails/verify', { email, code });
        setEmails(result.emails);
        setSent(false);
        setEmail('');
        setCode('');
        setMessage('Email verified and linked for report matching. If your organizer already imported a report, ask them to recheck it.');
      } else {
        const result = await externalRequest<{ alreadyVerified: boolean }>('member-emails/request', { email });
        setSent(!result.alreadyVerified);
        if (result.alreadyVerified) {
          const linked = await externalRequest<{ emails: { email: string }[] }>('member-emails');
          setEmails(linked.emails);
        }
        setMessage(result.alreadyVerified ? 'This email is already verified and linked.' : 'We sent a six-digit code to that email. Enter it below within 10 minutes.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify email');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="External registration email" className="w-full rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 text-sm dark:border-indigo-800 dark:bg-indigo-950/20">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">Use your GuildOS email on the external site</h3>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Register there with the same email you use for GuildOS. This helps us match your registration and attendance for certificate eligibility.</p>
      {guildosEmail && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-white p-3 dark:border-indigo-800 dark:bg-slate-900">
          <span className="min-w-0 flex-1 select-text break-all font-semibold text-slate-900 dark:text-slate-100">{guildosEmail}</span>
          <button type="button" onClick={() => void copyEmail()} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">Copy email</button>
        </div>
      )}
      {copyMessage && <p role="status" className="mt-2 text-xs text-slate-600 dark:text-slate-400">{copyMessage}</p>}
      <details className="mt-3 border-t border-indigo-100 pt-3 dark:border-indigo-800">
        <summary className="cursor-pointer text-xs font-medium text-indigo-700 dark:text-indigo-300">Already registered with another email?</summary>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">If you used another email, or the platform requires a school or work email, enter and verify it here so we can match it to your account.</p>
      {emails.length > 0 && <p className="mt-2 break-words text-xs text-emerald-700 dark:text-emerald-300">Verified linked emails: {emails.map(entry => entry.email).join(', ')}</p>}
      <form className="mt-3" onSubmit={e => { e.preventDefault(); if (!busy && email.trim() && (!sent || code.length === 6)) void act(sent); }}>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          Email used on the external site (optional)
          <input aria-label="External platform email" type="email" autoComplete="email" required value={email} disabled={busy} onChange={e => { setEmail(e.target.value); setSent(false); setCode(''); setMessage(''); setError(''); }} className="ev-input mt-1 w-full" placeholder="name@example.com" maxLength={254} />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={busy || !email.trim()} onClick={e => { if (e.currentTarget.form?.reportValidity()) void act(false); }} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-medium disabled:opacity-50 dark:border-indigo-700 dark:bg-slate-900">{busy ? 'Please wait…' : sent ? 'Resend code' : 'Send verification code'}</button>
        </div>
        {sent && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-xs font-medium text-slate-700 dark:text-slate-300">Six-digit verification code
              <input aria-label="Email verification code" inputMode="numeric" autoComplete="one-time-code" value={code} disabled={busy} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="ev-input mt-1 w-full" placeholder="123456" />
            </label>
            <button type="submit" disabled={busy || code.length !== 6} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Verify email</button>
          </div>
        )}
      </form>
      {message && <p role="status" className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{message}</p>}
      {error && <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Verifying another email does not confirm external registration or attendance. Those are matched against the organizer’s report.</p>
      </details>
    </section>
  );
}
