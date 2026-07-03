'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { confirmEmailVerification, resendVerification as resendVerificationRequest } from './auth-api';
import { AuthField, AuthSuccessCard } from './auth-pages';

export function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('We\'ve sent a verification link to your email address. Please verify your account before continuing.');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    const verificationToken = searchParams.get('token');

    if (!verificationToken) {
      return;
    }

    const confirmNow = async () => {
      setIsConfirming(true);

      try {
        const result = await confirmEmailVerification({ token: verificationToken });
        setMessage(result.message);

        window.setTimeout(() => {
          const destination = result.user.role === 'RECRUITER' ? '/recruiter' : result.user.profileComplete ? '/home' : '/profile-setup';
          router.push(destination);
        }, 1200);
      } catch (confirmError) {
        setError(confirmError instanceof Error ? confirmError.message : 'Unable to verify your email');
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
      const result = await resendVerificationRequest({ email });
      setMessage(result.message);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Unable to resend verification email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthSuccessCard
      title="Check your inbox"
      subtitle="Verify your email"
      message={isConfirming ? 'Verifying your email now...' : message}
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
            <Link href="/login" className="auth-button auth-button-secondary">Back to sign in</Link>
          </div>
        </>
      }
    />
  );
}
