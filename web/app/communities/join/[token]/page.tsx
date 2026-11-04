'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { joinByInvite } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Invite links from community founders land here. */
export default function JoinByInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading } = useSession();
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(`/login?next=${encodeURIComponent(`/communities/join/${token}`)}`); return; }
    joinByInvite(token)
      .then((r) => router.replace(r.community?.slug ? `/communities/${r.community.slug}` : '/communities'))
      .catch((e: Error) => setError(e.message));
  }, [loading, user, token, router]);

  return (
    <div className="wrap page">
      {error ? <><p className="error">{error}</p><Link className="lk" href="/communities">See all communities</Link></> : <p className="empty">Joining the community…</p>}
    </div>
  );
}
