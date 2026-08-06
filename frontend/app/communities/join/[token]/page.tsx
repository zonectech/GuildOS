'use client';

import { LogoSpinner } from '../../../../components/guildos/ui/loading';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { getCurrentUser } from '../../../../components/guildos/auth-api';
import { navigateBack } from '../../../../components/guildos/back-navigation';
import { joinCommunityByInviteToken } from '../../../../components/guildos/community-list-api';
import { DashboardShell } from '../../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../../components/guildos/dashboard-topbar';
import { Button } from '../../../../components/guildos/ui/button';

export default function JoinCommunityByInvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [status, setStatus] = useState('Loading invite...');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        if (!token) {
          setError('Invalid invite link');
          setBusy(false);
          return;
        }

        setStatus('Joining community...');
        const result = await joinCommunityByInviteToken(token);
        setStatus(result.message ?? 'Joined successfully');

        if (result.community?.slug) {
          router.replace(`/communities/${result.community.slug}`);
        } else {
          router.replace('/dashboard/communities');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to join community');
        setBusy(false);
      }
    };

    void run();
  }, [router, token]);

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
        {busy ? <LogoSpinner size="lg" /> : null}
        <h1 className="mt-4 text-2xl font-semibold text-slate-950 dark:text-white">Community Invite</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{error || status}</p>
        {error ? (
          <div className="mt-6 flex gap-3">
            <Button variant="primary" asChild href="/login">
              Go to Login
            </Button>
            <Button variant="secondary" onClick={() => navigateBack(router, '/dashboard/communities')}>
              Back to Communities
            </Button>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
