'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getMyCommunityAccess } from '../../components/guildos/api/community-access-api';
import { DashboardShell } from '../../components/guildos/dashboard/dashboard-shell';
import { DashboardSidebar } from '../../components/guildos/dashboard/dashboard-sidebar';
import { DashboardTopbar } from '../../components/guildos/dashboard/dashboard-topbar';
import { LogoSpinner } from '../../components/guildos/ui/loading';

/** Keep navigation mounted while fresh server checks run in the background. */
export default function CommunityDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const adminConsole = pathname === '/dashboard/admin' || pathname.startsWith('/dashboard/admin/');
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (adminConsole) return;
    let cancelled = false;
    const check = () => {
      setError('');
      void getMyCommunityAccess().then(access => {
        if (cancelled) return;
        setApproved(access.hasAccess);
        if (!access.hasAccess && pathname !== '/dashboard') router.replace('/dashboard');
      }).catch(() => { if (!cancelled) setError('Unable to refresh Community Mode access. Please try again.'); });
    };
    check();
    window.addEventListener('focus', check);
    return () => { cancelled = true; window.removeEventListener('focus', check); };
  }, [pathname, router, attempt, adminConsole]);
  if (adminConsole) return <>{children}</>;
  const focused = pathname === '/dashboard/events/create' || pathname === '/dashboard/communities/create' || /^\/dashboard\/communities\/[^/]+\/edit$/.test(pathname);
  const canRender = pathname === '/dashboard' || approved;
  return <DashboardShell focused={focused} sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}<button type="button" className="ml-2 font-semibold" onClick={() => setAttempt(n => n + 1)}>Retry</button></p> : null}
    {canRender ? children : <div role="status" aria-label="Loading dashboard" className="flex min-h-64 items-center justify-center"><LogoSpinner /></div>}
  </DashboardShell>;
}
