'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { joinByInvite } from '@/lib/api/communities';
import { useSession } from '@/lib/session';
import { Btn } from '@/components/ui/bits';

export default function JoinByInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading } = useSession();
  const attempted = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || attempted.current) return;
    if (!user) {
      router.replace('/login?next=' + encodeURIComponent('/communities/join/' + token));
      return;
    }
    attempted.current = true;
    joinByInvite(token)
      .then((result) => router.replace(result.community?.slug ? '/communities/' + result.community.slug : '/communities'))
      .catch((e: Error) => setError(e.message || 'This invite link is no longer available.'));
  }, [loading, user, token, router]);

  return (
    <div className="mx-auto flex min-h-[55dvh] max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
      {error ? <><h1 className="text-[26px] font-extrabold">Couldn’t join this community</h1><p role="alert" className="text-[15px] text-muted">{error}</p><div className="flex flex-wrap justify-center gap-2"><Btn href="/communities">Browse communities</Btn><Link href="/events" className="rounded-xl px-4 py-3 text-[14px] font-semibold text-muted hover:bg-mist">Back to events</Link></div></> : <><h1 className="text-[24px] font-extrabold">Joining community…</h1><p className="text-[15px] text-muted">We’re checking your invite.</p></>}
    </div>
  );
}
