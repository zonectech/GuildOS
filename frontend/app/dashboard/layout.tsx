'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getMyCommunityAccess } from '../../components/guildos/community-access-api';

/** The dashboard landing page hosts approval onboarding; nested tools require current approval. */
export default function CommunityDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowedPath, setAllowedPath] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (pathname === '/dashboard') return;
    let cancelled = false;
    setError('');
    void getMyCommunityAccess().then(access => {
      if (cancelled) return;
      if (access.hasAccess) setAllowedPath(pathname);
      else router.replace('/dashboard');
    }).catch(() => { if (!cancelled) setError('Unable to verify Community Mode access. Please try again.'); });
    return () => { cancelled = true; };
  }, [pathname, router, attempt]);
  if (pathname === '/dashboard' || allowedPath === pathname) return children;
  return <main className="mx-auto max-w-lg p-8 text-sm text-slate-700 dark:text-slate-300" aria-live="polite">{error || 'Checking Community Mode approval…'}{error ? <button type="button" className="ml-2 font-semibold text-indigo-600" onClick={() => setAttempt(n => n + 1)}>Retry</button> : null}</main>;
}
