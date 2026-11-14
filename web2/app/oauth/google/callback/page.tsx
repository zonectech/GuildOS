'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleAlert } from 'lucide-react';
import { api, friendlyError } from '@/lib/api/client';
import { safeNext } from '@/lib/next-path';
import { useSession } from '@/lib/session';
import { GOOGLE_NEXT_KEY } from '@/components/auth/google';
import { Btn } from '@/components/ui/bits';
import { Stamp } from '@/components/brand/stamp';

/**
 * Where Google sends people back. The API swaps Google's code for a session (cookies), then you go
 * where you were heading: onboarding first for a new account.
 */
function Finish() {
  const params = useSearchParams();
  const router = useRouter();
  const { reload } = useSession();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get('code');
    const state = params.get('state');
    if (params.get('error')) { setError('Google sign-in was cancelled.'); return; }
    if (!code || !state) { setError('This sign-in link is incomplete. Try again.'); return; }
    let next = '';
    try { next = sessionStorage.getItem(GOOGLE_NEXT_KEY) ?? ''; sessionStorage.removeItem(GOOGLE_NEXT_KEY); } catch { /* storage blocked */ }
    api<{ user: { profileComplete?: boolean } }>(`/api/oauth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
      .then(async (r) => {
        await reload();
        const target = safeNext(next);
        router.replace(r.user?.profileComplete === false ? `/onboarding${next ? `?next=${encodeURIComponent(target)}` : ''}` : target);
      })
      .catch((e) => setError(friendlyError(e)));
  }, [params, reload, router]);

  if (error) {
    return (
      <div role="alert" className="flex max-w-sm flex-col items-center gap-3 text-center">
        <CircleAlert size={34} className="text-coral-text" />
        <h1 className="text-[26px] font-extrabold">Couldn&apos;t sign you in with Google</h1>
        <p className="text-[15px] text-muted">{error}</p>
        <Btn href="/login">Back to sign in</Btn>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 text-center" aria-busy="true">
      <Stamp label="Welcome" size={92} tilt={0} />
      <p className="text-[16px] font-semibold">Signing you in…</p>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <div className="mesh grid min-h-[80dvh] place-items-center px-4 py-10">
      <Suspense fallback={null}><Finish /></Suspense>
    </div>
  );
}
