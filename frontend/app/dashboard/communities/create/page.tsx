'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';

import { DashboardShell } from '../../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../../components/guildos/dashboard-topbar';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';
import { CommunityCreationWizard } from '../../../../components/guildos/community-creation-wizard';
import { getCurrentUser } from '../../../../components/guildos/auth-api';
import { getMyCommunityAccess } from '../../../../components/guildos/community-access-api';
import { PageLoading } from '../../../../components/guildos/ui/loading';

export default function CreateCommunityPage() {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'granted' | 'denied'>('loading');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      const access = await getMyCommunityAccess().catch(() => null);
      if (cancelled) return;
      setState(access?.hasAccess ? 'granted' : 'denied');
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === 'loading') {
    return <PageLoading label="Checking access…" />;
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Communities"
        title="Create a Community"
        subtitle="Build a student community with verified identity, leadership roles, and event management support."
      />

      {state === 'granted' ? (
        <CommunityCreationWizard />
      ) : (
        <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">Community Mode access required</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Creating a community requires Community Mode access. Verify your school email or request access to get started.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Request access
          </Link>
        </div>
      )}
    </DashboardShell>
  );
}
