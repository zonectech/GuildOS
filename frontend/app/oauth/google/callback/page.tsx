'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { completeGoogleSignIn } from '../../../../components/guildos/auth-api';
import { LogoSpinner } from '../../../../components/guildos/ui/loading';
export default function GoogleOAuthCallbackPage() {
 return <Suspense fallback={<main className="auth-page auth-page-center"><LogoSpinner /></main>}><GoogleCallback /></Suspense>;
}
function GoogleCallback() {
 const router = useRouter();
 const params = useSearchParams();
 const started = useRef(false);
 const [error, setError] = useState('');
 useEffect(() => {
  if (started.current) return;
  started.current = true;
  const code = params.get('code'); const state = params.get('state');
  if (!code || !state) { setError('Google sign-in could not be completed. Please try again.'); return; }
  void completeGoogleSignIn(code, state).then(result => {
   const fallback = result.user.profileComplete ? '/home' : '/profile-setup';
   const destination = ['/home', '/profile-setup', '/dashboard/admin', '/recruiter'].includes(result.nextRoute) ? result.nextRoute : fallback;
   router.replace(destination);
  }).catch(err => setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.'));
 }, [router, params]);
 return <main className="auth-page auth-page-center"><div className="auth-center-shell">
  {error ? <><p role="alert">{error}</p><Link href="/login" className="mt-4 inline-block font-semibold text-indigo-600">Back to sign in</Link></> : <><LogoSpinner /><p>Signing you in with Google…</p></>}
 </div></main>;
}
