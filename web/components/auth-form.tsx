'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, signup } from '@/lib/api';
import { googleAuthUrl } from '@/lib/account';
import { useSession } from '@/lib/session';

/** Log in and sign up share one layout: the form on the left, the poster on the right. */
export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useSession();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = params.get('next') || '/events';

  async function google() {
    setBusy(true); setError('');
    try { window.location.assign((await googleAuthUrl()).authUrl); }
    catch (err) { setError(err instanceof Error ? err.message : 'Google sign-in is not available right now.'); setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { user } = mode === 'login' ? await login(email.trim(), password) : await signup(fullName.trim(), email.trim(), password);
      setUser(user);
      // New and unverified accounts finish setup first; everyone else goes where they were heading.
      if (mode === 'signup' || !user.emailVerified) router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
      else if (!user.profileComplete) router.push('/onboarding');
      else router.push(next.startsWith('/') && !next.startsWith('//') ? next : '/events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form onSubmit={submit} noValidate={false}>
        <div className="stack" style={{ gap: 6 }}>
          <h1 style={{ fontSize: 30 }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="muted">{mode === 'login' ? 'Log in to see your events and passes.' : 'See what is happening at your school.'}</p>
        </div>
        <button type="button" className="btn s w" onClick={google} disabled={busy}><GoogleLogo />Continue with Google</button>
        <p className="or">or</p>
        {mode === 'signup' ? <label className="field"><span>Full name <em>*</em></span><input className="input" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></label> : null}
        <label className="field"><span>Email <em>*</em></span><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span>Password <em>*</em></span><input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {mode === 'login' ? <Link href="/forgot-password" className="lk" style={{ alignSelf: 'flex-end', fontSize: 14 }}>Forgot password?</Link> : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button type="submit" className="btn p w" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        <p className="muted" style={{ textAlign: 'center' }}>
          {mode === 'login' ? <>New here? <Link className="lk" href="/signup">Create an account</Link></> : <>Already have an account? <Link className="lk" href="/login">Log in</Link></>}
        </p>
      </form>
      <div className="poster" aria-hidden="true">PROOF<br />YOU<br />SHOWED<br />UP.</div>
    </div>
  );
}

/** Google's own four-colour G, as their sign-in branding rules ask for. */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
