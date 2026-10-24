'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { getGoogleAuthUrl, login as loginRequest } from './auth-api';
import { AuthField, AuthSplitLayout } from './auth-pages';
import { CampusJourney } from './visuals/campus-journey';
import { Encouragement } from './visuals/encouragement';

const ENCOURAGEMENT = [
  'Every event you show up to counts.',
  'Your next opportunity starts with showing up.',
  'Small steps, verified. That’s how a CV grows.',
  'Your community is waiting for you.',
];

function GoogleButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button type="button" className="auth-button auth-button-secondary auth-google-button" onClick={onClick}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="auth-google-icon">
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-1.5 3.5-5.5 3.5-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 4 1.5l2.7-2.6C16.9 1.9 14.7 1 12 1 6.9 1 2.8 5.1 2.8 10.2S6.9 19.4 12 19.4c6.1 0 10.2-4.3 10.2-10.3 0-.7-.1-1.2-.2-1.7H12z"/>
        <path fill="#4285F4" d="M23 12.2c0-.7-.1-1.2-.2-1.7H12v3.2h6.2c-.3 1.4-1.1 2.6-2.3 3.4l3.5 2.7C21.8 17.7 23 15.2 23 12.2z"/>
        <path fill="#FBBC05" d="M5 14.1c-.4-1.1-.6-2.2-.6-3.4s.2-2.3.6-3.4L1.3 4.7C.4 6.4 0 8.2 0 10.2s.4 3.8 1.3 5.5L5 14.1z"/>
        <path fill="#34A853" d="M12 23c2.7 0 4.9-.9 6.5-2.4l-3.5-2.7c-.9.6-2 .9-3 .9-3.6 0-6.6-2.4-7.7-5.7l-3.7 2.9C3 20 7.2 23 12 23z"/>
      </svg>
      <span>{label}</span>
    </button>
  );
}

export function LoginPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // ?next=/events/slug — where to return after login (same-origin paths only).
  const [nextPath, setNextPath] = useState('');

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next') ?? '';
    // Only relative paths — never redirect off-site from a login link.
    if (next.startsWith('/') && !next.startsWith('//')) setNextPath(next);
  }, []);

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth <= 760);
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await loginRequest({ email, password });
      if (result.user.role === 'RECRUITER') {
        router.push('/recruiter');
        return;
      }

      if (result.needsVerification) {
        router.push('/verify-email');
        return;
      }

      // Admins operate the platform — land them on the Admin Console. They can
      // still switch to student mode from there. Not forced through onboarding.
      if (result.user.role === 'ADMIN') {
        router.push('/dashboard/admin');
        return;
      }

      if (!result.user.profileComplete) {
        router.push('/profile-setup');
        return;
      }

      router.push(nextPath || '/home');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const form = (
    <form id="login-form" className="auth-form" onSubmit={handleLogin}>
      <AuthField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required />
      <AuthField label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} required />

      <div className="auth-form-row">
        <label className="auth-checkbox">
          <input type="checkbox" />
          <span>Remember this device</span>
        </label>
        <Link href="/forgot-password" className="auth-inline-link">Forgot password?</Link>
      </div>

      {error ? <p className="auth-error-text">{error}</p> : null}
      <button type="submit" className="auth-button auth-button-primary" disabled={isLoading}>
        {isLoading ? 'Signing In...' : 'Continue'}
      </button>
      <GoogleButton
        label="Continue with Google"
        onClick={async () => {
          try {
            const authUrl = await getGoogleAuthUrl();
            window.location.href = authUrl;
          } catch (googleError) {
            setError(googleError instanceof Error ? googleError.message : 'Unable to start Google sign-in');
          }
        }}
      />
      <p className="auth-footer-copy">
        Don’t have an account? <Link href="/signup">Create one</Link>
      </p>
      <p className="auth-footer-copy">
        Hiring students? <Link href="/recruiter/signup">Sign up as a recruiter</Link>
      </p>
    </form>
  );

  if (isMobile) {
    return (
      <main className="auth-mobile-page">
        <Link href="/" className="auth-center-brand auth-mobile-brand">
          <div className="auth-logo-mark">G</div>
          <div className="guildos-logo-copy">
            <strong>GuildOS</strong>
            <span>Find your people on campus</span>
          </div>
              </Link>
        <section className="auth-mobile-card auth-card-surface">
          <div className="auth-card-header auth-card-header-center">
            <div>
              <p className="auth-card-eyebrow">Welcome Back</p>
              <h1>Good to see you again.</h1>
              <p>Your communities, tickets and certificates are right where you left them.</p>
            </div>
          </div>
          <div className="mb-4"><Encouragement lines={ENCOURAGEMENT} tone="card" size={26} /></div>
          {form}
        </section>
      </main>
    );
  }

  return (
    <AuthSplitLayout
      heroKicker="Welcome back"
      heroTitle="Good to see you again."
      heroText="Your communities, your tickets and every certificate you've earned are right where you left them."
      encouragement={ENCOURAGEMENT}
      heroBody={<CampusJourney compact />}
      cardTitle="Sign in"
    >
      {form}
    </AuthSplitLayout>
  );
}
