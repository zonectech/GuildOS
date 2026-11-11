'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api/client';
import { Btn } from '@/components/ui/bits';
import { AuthCard, ErrorNote, inputCls } from '@/components/auth/auth-bits';
import { Req } from '@/components/ui/req';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) }); setSent(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to send the link'); }
    finally { setBusy(false); }
  }
  if (sent) return (
    <AuthCard stamp="On its way" title="Check your email" lead={<>If an account uses <b className="text-ink">{email.trim()}</b>, a link to reset your password is on its way. It works once.</>}>
      <Btn size="lg" wide href="/login">Back to sign in</Btn>
    </AuthCard>
  );
  return (
    <AuthCard stamp="Reset" title="Forgot your password?" lead="Enter your email and we'll send a link to set a new one." onSubmit={submit}>
      <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Email<Req /></span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></label>
      <ErrorNote text={error} />
      <Btn size="lg" wide type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Btn>
      <p className="text-center text-[14px] text-muted"><Link href="/login" className="font-semibold text-green-text hover:underline">Back to sign in</Link></p>
    </AuthCard>
  );
}
