'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { getCurrentUser, getProfile } from '../../components/guildos/api/auth-api';
import { PageLoading } from '../../components/guildos/ui/loading';

/**
 * /profile — convenience redirect to the viewer's own public profile.
 * Opens profile setup when no username has been chosen yet,
 * so "Profile" links never dead-end on a 404.
 */
export default function MyProfileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    void getCurrentUser()
      .then(async (user) => {
        if (user && !user.profile?.username) user = (await getProfile()).user;
        if (!user) {
          router.replace('/login?next=/profile');
        } else if (user.profile?.username) {
          router.replace(`/u/${encodeURIComponent(user.profile.username)}`);
        } else {
          router.replace('/profile-setup');
        }
      })
      .catch(() => router.replace('/login?next=/profile'));
  }, [router]);

  return <PageLoading label="Opening your profile…" />;
}
