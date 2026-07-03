'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { getGoogleAuthUrl, signup as signupRequest } from './auth-api';
import { AuthField, AuthSplitLayout } from './auth-pages';

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

export function SignupPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth <= 760);
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await signupRequest({ fullName, email, password });
      router.push('/verify-email');
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : 'Unable to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const fields = (
    <>
      <AuthField label="Your Full Name" autoComplete="name" value={fullName} onChange={setFullName} required />
      <AuthField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required />
      <AuthField label="Password" type="password" autoComplete="new-password" value={password} onChange={setPassword} required />
      <AuthField label="Confirm Password" type="password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} required />
      <label className="auth-checkbox auth-checkbox-wide">
        <input type="checkbox" required />
        <span>I agree to the Terms and Privacy Policy</span>
      </label>
      {error ? <p className="auth-error-text">{error}</p> : null}
      <button type="submit" className="auth-button auth-button-primary" disabled={isLoading}>
        {isLoading ? 'Creating Account...' : 'Create your account'}
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
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </>
  );

  if (isMobile) {
    return (
      <main className="auth-mobile-page">
        <div className="auth-center-brand auth-mobile-brand">
          <div className="auth-logo-mark">G</div>
          <div className="guildos-logo-copy">
            <strong>GuildOS</strong>
            <span>Student Portfolio Platform</span>
          </div>
              </div>
        <section className="auth-mobile-card auth-card-surface">
          <div className="auth-card-header auth-card-header-center">
            <div>
              <p className="auth-card-eyebrow">Start Your Journey</p>
              <h1>Create your account</h1>
              <p>Store verified certificates, track participation, and build a portfolio that grows with you.</p>
            </div>
          </div>
          <form id="signup-form" className="auth-form" onSubmit={handleSignup}>
            {fields}
          </form>
        </section>
      </main>
    );
  }

  return (
    <AuthSplitLayout
      heroKicker="Start Your Journey"
      heroTitle="Turn your campus experiences into opportunity"
      heroText="Store verified certificates, track participation, showcase leadership experience, and build a professional portfolio."
      heroBody={
        <div className="auth-flow-card">
          <div className="auth-flow-step"><span>Community Event</span></div>
          <div className="auth-flow-arrow">↓</div>
          <div className="auth-flow-step accent"><span>QR Check-In</span></div>
          <div className="auth-flow-arrow">↓</div>
          <div className="auth-flow-step success"><span>Certificate</span></div>
          <div className="auth-flow-arrow">↓</div>
          <div className="auth-flow-step"><span>Portfolio</span></div>
        </div>
      }
      cardTitle="Create your account"
    >
      <form id="signup-form" className="auth-form" onSubmit={handleSignup}>
        {fields}
      </form>
    </AuthSplitLayout>
  );
}
