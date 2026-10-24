'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { confirmEmailVerification, resendVerification as resendVerificationRequest } from './auth-api';
import { AuthField, AuthSuccessCard } from './auth-pages';
import { navigateBack } from './back-navigation';

export function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('We\'ve sent a verification link to your email address. Please verify your account before continuing.');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  // Set once the link has been accepted: where to send them next.
  const [verifiedDestination, setVerifiedDestination] = useState('');
  // The token is single-use; React may run the effect twice in development.
  const confirmStarted = useRef(false);

  useEffect(() => {
    const verificationToken = searchParams.get('token');

    if (!verificationToken || confirmStarted.current) {
      return;
    }
    confirmStarted.current = true;

    const confirmNow = async () => {
      setIsConfirming(true);

      try {
        const result = await confirmEmailVerification({ token: verificationToken });
        const destination = result.user.role === 'RECRUITER' ? '/recruiter' : result.user.profileComplete ? '/home' : '/profile-setup';
        setVerifiedDestination(destination);
        window.setTimeout(() => router.push(destination), 1500);
      } catch {
        setMessage('');
        setError('That link has expired or was already used. Enter your email below and we will send a fresh one.');
      } finally {
        setIsConfirming(false);
      }
    };

    void confirmNow();
  }, [router, searchParams]);

  const handleResend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await resendVerificationRequest({ email });
      setMessage(`We sent a new link to ${email}. It can take a minute, and check your spam folder too.`);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Unable to resend verification email');
    } finally {
      setIsLoading(false);
    }
  };

  if (verifiedDestination) {
    return (
      <AuthSuccessCard
        title="All set"
        subtitle="Your email is verified"
        message={verifiedDestination === '/profile-setup' ? 'Next, a quick profile setup so clubs and classmates can find you.' : 'Taking you in now.'}
        actions={
          <button type="button" onClick={() => router.push(verifiedDestination)} className="auth-button auth-button-primary">
            Continue
          </button>
        }
      />
    );
  }

  if (isConfirming) {
    return <AuthSuccessCard title="One moment" subtitle="Checking your link" message="This only takes a second." actions={null} showCheck={false} />;
  }

  return (
    <AuthSuccessCard
      title="Check your inbox"
      subtitle="Verify your email"
      message={message}
      showCheck={!error}
      actions={
        <>
          <form className="auth-form auth-form-single" onSubmit={handleResend}>
            <AuthField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required />
            {error ? <p className="auth-error-text">{error}</p> : null}
            <button type="submit" className="auth-button auth-button-primary" disabled={isLoading || isConfirming}>
              {isLoading ? 'Sending...' : 'Resend verification email'}
            </button>
          </form>
          <div className="auth-stack-actions">
            <button type="button" onClick={() => navigateBack(router, '/login')} className="auth-button auth-button-secondary">Back to sign in</button>
          </div>
        </>
      }
    />
  );
}
