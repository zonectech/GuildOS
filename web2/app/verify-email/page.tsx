'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import { Btn } from '@/components/ui/bits';
import { AuthCard } from '@/components/auth/auth-bits';

function Verify() {
  const token = useSearchParams().get('token') ?? '';
  const { reload } = useSession();
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [error, setError] = useState('');
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return; // the link works once; don't send it twice in development's double render
    ran.current = true;
    if (!token) { setState('failed'); setError('This link is incomplete.'); return; }
    api('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => { setState('done'); return reload(); })
      .catch((e: Error) => { setState('failed'); setError(e.message); });
  }, [token, reload]);
  if (state === 'working') return <AuthCard stamp="Checking" title="Verifying your email…" lead="One moment."><div className="shimmer h-12 rounded-2xl" /></AuthCard>;
  if (state === 'done') return <AuthCard stamp="Verified" title="Email verified" lead="You're all set. Any certificates you earned while unverified are on their way to your profile."><Btn size="lg" wide href="/events">Explore events</Btn></AuthCard>;
  return <AuthCard stamp="Hmm" title="We couldn't verify that link" lead={`${error} Links expire, and each works once. Sign in to send a new one.`}><Btn size="lg" wide href="/login">Sign in</Btn></AuthCard>;
}
export default function VerifyEmailPage() { return <Suspense fallback={null}><Verify /></Suspense>; }
