'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { requestPasswordReset } from './auth-api';
import { AuthField, AuthSplitLayout } from './auth-pages';
import { navigateBack } from './back-navigation';
import { useMediaQuery } from './use-media-query';

export function ForgotPasswordPage() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('Enter your email address and we\'ll send you a password reset link.');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const payload = await requestPasswordReset({ email });
      setMessage(payload.message ?? 'Password reset link sent');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to send reset link');
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
              <p className="auth-card-eyebrow">We’ll help you get back in</p>
              <h1>Reset your password</h1>
              <p>Enter your email address and we’ll send you a password reset link.</p>
            </div>
          </div>
          <p className="auth-description">{message}</p>
          <form className="auth-form auth-form-single" onSubmit={handleReset}>
            <AuthField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required />
            {error ? <p className="auth-error-text">{error}</p> : null}
            <button type="submit" className="auth-button auth-button-primary" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
          <div className="auth-stack-actions">
            <button type="button" onClick={() => navigateBack(router, '/login')} className="auth-button auth-button-secondary">Back to sign in</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <AuthSplitLayout
      heroKicker="We'll Help You Get Back In"
      heroTitle="Reset Password"
      heroText="Enter your email address and we'll send you a password reset link."
      heroBody={
        <div className="auth-flow-card">
          <div className="auth-flow-step"><span>Request Link</span></div>
          <div className="auth-flow-arrow">↓</div>
          <div className="auth-flow-step accent"><span>Check Inbox</span></div>
          <div className="auth-flow-arrow">↓</div>
          <div className="auth-flow-step success"><span>Set New Password</span></div>
        </div>
      }
      cardTitle="Reset Password"
    >
      <p className="auth-description">{message}</p>
      <form className="auth-form auth-form-single" onSubmit={handleReset}>
        <AuthField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required />
        {error ? <p className="auth-error-text">{error}</p> : null}
        <button type="submit" className="auth-button auth-button-primary" disabled={isLoading}>
                      {isLoading ? 'Sending...' : 'Send reset link'}
                    </button>
      </form>
      <div className="auth-stack-actions">
        <button type="button" onClick={() => navigateBack(router, '/login')} className="auth-button auth-button-secondary">Back to sign in</button>
      </div>
    </AuthSplitLayout>
  );
}
