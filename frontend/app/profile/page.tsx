'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { getCurrentUser } from '../../components/guildos/auth-api';
import { PageLoading } from '../../components/guildos/ui/loading';

/**
 * /profile — convenience redirect to the viewer's own public profile.
 * Falls back to account settings when no username is set yet,
 * so "Profile" links never dead-end on a 404.
 */
export default function MyProfileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    void getCurrentUser()
      .then((user) => {
        if (!user) {
          router.replace('/login?next=/profile');
        } else if (user.profile?.username) {
          router.replace(`/u/${encodeURIComponent(user.profile.username)}`);
        } else {
          router.replace('/account');
        }
      })
      .catch(() => router.replace('/login?next=/profile'));
  }, [router]);

  return <PageLoading label="Opening your profile…" />;
}
