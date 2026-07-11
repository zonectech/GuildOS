'use client';

import { LogoSpinner } from '../../../components/guildos/ui/loading';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import { navigateBack } from '../../../components/guildos/back-navigation';
import { AdminShell } from '../../../components/guildos/admin/admin-shell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'denied' | 'ready'>('loading');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      setStatus(user.role === 'ADMIN' ? 'ready' : 'denied');
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100">
        <LogoSpinner size="lg" />
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-950">Administrators only</h1>
          <p className="mt-2 text-sm text-slate-500">This area is restricted to GuildOS administrators.</p>
          <button onClick={() => navigateBack(router, '/home')} className="mt-4 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
            Back to Student Home
          </button>
        </div>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
