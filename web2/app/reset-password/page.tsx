'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api/client';
import { Btn } from '@/components/ui/bits';
import { AuthCard, ErrorNote, PasswordField, passwordOk } from '@/components/auth/auth-bits';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }); setDone(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to reset your password'); }
    finally { setBusy(false); }
  }
  if (!token) return <AuthCard stamp="Reset" title="This link is incomplete" lead="Open the reset link from your email again, or ask for a new one."><Btn size="lg" wide href="/forgot-password">Send a new link</Btn></AuthCard>;
  if (done) return <AuthCard stamp="All set" title="Password changed" lead="Sign in with your new password."><Btn size="lg" wide href="/login">Sign in</Btn></AuthCard>;
  return (
    <AuthCard stamp="Reset" title="Set a new password" lead="Choose a password you don't use anywhere else." onSubmit={submit}>
      <PasswordField required label="New password" value={password} onChange={setPassword} />
      <ErrorNote text={error} />
      <Btn size="lg" wide type="submit" disabled={busy || !passwordOk(password)}>{busy ? 'Saving…' : 'Save new password'}</Btn>
    </AuthCard>
  );
}
export default function ResetPasswordPage() { return <Suspense fallback={null}><ResetForm /></Suspense>; }
