'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { completeGoogle, forgotPassword, resendVerification, resetPassword, verifyEmail } from '@/lib/account';
import { useSession } from '@/lib/session';

function Shell({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="authcol">
        <div className="stack" style={{ gap: 6 }}><h1 style={{ fontSize: 30 }}>{title}</h1><p className="muted">{text}</p></div>
        {children}
      </div>
      <div className="poster" aria-hidden="true">PROOF<br />YOU<br />SHOWED<br />UP.</div>
    </div>
  );
}

/** With a token from the email link it confirms straight away; without one it offers to resend. */
export function VerifyEmail() {
  const params = useSearchParams();
  const router = useRouter();
  const { reload } = useSession();
  const token = params.get('token');
  const started = useRef(false);
  const [state, setState] = useState<'checking' | 'done' | 'failed' | 'waiting'>(token ? 'checking' : 'waiting');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // The token is single-use; React may run this twice in development.
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token).then(async () => { setState('done'); await reload(); }).catch((e: Error) => { setMessage(e.message); setState('failed'); });
  }, [token, reload]);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    try { await resendVerification(email.trim()); setMessage('We sent a new link. Check your inbox and spam folder.'); }
    catch (err) { setMessage(err instanceof Error ? err.message : 'Unable to send the link'); }
  }

  if (state === 'checking') return <Shell title="Checking your link" text="One moment."><p className="empty">Verifying…</p></Shell>;
  if (state === 'done') return <Shell title="Your email is verified" text="Next, set up your profile so we can show you the right events."><button type="button" className="btn p w" onClick={() => router.push('/onboarding')}>Set up my profile</button></Shell>;
  return (
    <Shell title="Check your email" text={state === 'failed' ? 'That link did not work. It may have expired or been used already.' : 'We sent you a link to confirm your email. Open it on this device.'}>
      <form className="stack" onSubmit={resend}>
        <label className="field"><span>Email</span><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <button type="submit" className="btn s w">Send a new link</button>
      </form>
      {message ? <p className={/sent/i.test(message) ? 'note' : 'error'} role="status">{message}</p> : null}
      <p className="muted" style={{ textAlign: 'center' }}><Link className="lk" href="/login">Back to log in</Link></p>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await forgotPassword(email.trim()); setSent(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to send the link'); }
    finally { setBusy(false); }
  }
  return (
    <Shell title="Forgot your password?" text="Enter your email and we will send you a reset link.">
      {sent ? <p className="note" role="status">If an account uses {email}, a reset link is on its way. Check your spam folder too.</p> : (
        <form className="stack" onSubmit={submit}>
          <label className="field"><span>Email <em>*</em></span><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button type="submit" className="btn p w" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <p className="muted" style={{ textAlign: 'center' }}><Link className="lk" href="/login">Back to log in</Link></p>
    </Shell>
  );
}

export function ResetPassword() {
  const params = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await resetPassword(token.trim(), password); setDone(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to reset your password'); }
    finally { setBusy(false); }
  }
  if (done) return <Shell title="Password saved" text="You can log in with your new password now."><button type="button" className="btn p w" onClick={() => router.push('/login')}>Log in</button></Shell>;
  return (
    <Shell title="Set a new password" text="Use at least 8 characters.">
      <form className="stack" onSubmit={submit}>
        {!params.get('token') ? <label className="field"><span>Reset code from your email <em>*</em></span><input className="input" required value={token} onChange={(e) => setToken(e.target.value)} /></label> : null}
        <label className="field"><span>New password <em>*</em></span><input className="input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="field"><span>Confirm password <em>*</em></span><input className="input" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button type="submit" className="btn p w" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </Shell>
  );
}

/** Google sends people back here with a one-time code; the backend sets the login cookies. */
export function GoogleCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const { setUser } = useSession();
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) { setError('Google sign-in could not be completed. Please try again.'); return; }
    completeGoogle(code, state)
      .then(({ user }) => { setUser(user); router.replace(user.profileComplete ? '/events' : '/onboarding'); })
      .catch((e: Error) => setError(e.message || 'Google sign-in failed. Please try again.'));
  }, [params, router, setUser]);
  return <Shell title={error ? 'Sign-in failed' : 'Signing you in'} text={error || 'One moment while Google finishes.'}>{error ? <Link className="btn s w" href="/login">Back to log in</Link> : null}</Shell>;
}
