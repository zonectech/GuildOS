'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { resetPassword as resetPasswordRequest } from './auth-api';
import { AuthField, AuthSplitLayout } from './auth-pages';
import { useMediaQuery } from './use-media-query';

export function ResetPasswordPage() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('Choose a new password for your GuildOS account.');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const result = await resetPasswordRequest({ token, password });
      setMessage(result.message);
      window.setTimeout(() => {
        router.push('/login');
      }, 1200);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to reset password');
    } finally {
      setIsLoading(false);
    }
  };

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
              <p className="auth-card-eyebrow">Reset your password</p>
              <h1>Create a new secure password</h1>
              <p>Choose a password that keeps your GuildOS account and portfolio secure.</p>
            </div>
          </div>
          <p className="auth-description">{message}</p>
          <form className="auth-form auth-form-single" onSubmit={handleReset}>
            <AuthField label="Reset Token" value={token} onChange={setToken} required />
            <AuthField label="New Password" type="password" autoComplete="new-password" value={password} onChange={setPassword} required />
            <AuthField label="Confirm Password" type="password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} required />
            {error ? <p className="auth-error-text">{error}</p> : null}
            <button type="submit" className="auth-button auth-button-primary" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
          <div className="auth-stack-actions">
            <Link href="/login" className="auth-button auth-button-secondary">Back to sign in</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <AuthSplitLayout
      heroKicker="Reset Your Password"
      heroTitle="Create a new secure password"
      heroText="Choose a password that will keep your GuildOS account and portfolio secure."
      heroBody={
        <div className="auth-portfolio-card">
          <div className="auth-portfolio-header">
            <div>
              <span className="auth-portfolio-label">Secure Reset</span>
              <strong>Protected Account Recovery</strong>
            </div>
            <span className="auth-live-pill">Safe</span>
          </div>
          <div className="auth-portfolio-grid">
            <div><span>Minimum Length</span><strong>8+</strong></div>
            <div><span>Uppercase</span><strong>1</strong></div>
            <div><span>Number</span><strong>1</strong></div>
            <div><span>Symbol</span><strong>1</strong></div>
          </div>
        </div>
      }
      cardTitle="Reset your password"
    >
      <p className="auth-description">{message}</p>
      <form className="auth-form auth-form-single" onSubmit={handleReset}>
        <AuthField label="Reset token" value={token} onChange={setToken} required />
        <AuthField label="New password" type="password" autoComplete="new-password" value={password} onChange={setPassword} required />
        <AuthField label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} required />
        {error ? <p className="auth-error-text">{error}</p> : null}
        <button type="submit" className="auth-button auth-button-primary" disabled={isLoading}>
          {isLoading ? 'Updating...' : 'Update password'}
        </button>
      </form>
      <div className="auth-stack-actions">
        <Link href="/login" className="auth-button auth-button-secondary">Back to sign in</Link>
      </div>
    </AuthSplitLayout>
  );
}
