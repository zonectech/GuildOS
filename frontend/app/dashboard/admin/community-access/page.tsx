'use client';

import { LogoSpinner } from '../../../../components/guildos/ui/loading';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, Check, X, Building2 } from 'lucide-react';

import { getCurrentUser } from '../../../../components/guildos/auth-api';
import { navigateBack } from '../../../../components/guildos/back-navigation';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';
import {
  approveCommunityAccess,
  getPendingCommunityAccess,
  rejectCommunityAccess,
  type CommunityAccessRequest,
} from '../../../../components/guildos/community-access-api';

export default function CommunityAccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'denied' | 'ready'>('loading');
  const [requests, setRequests] = useState<CommunityAccessRequest[]>([]);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      if (user.role !== 'ADMIN') {
        setStatus('denied');
        return;
      }
      try {
        const { requests: list } = await getPendingCommunityAccess();
        if (!cancelled) setRequests(list);
      } finally {
        if (!cancelled) setStatus('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function decide(userId: string, approve: boolean, fullName: string) {
    try {
      setBusy(userId);
      if (approve) await approveCommunityAccess(userId);
      else await rejectCommunityAccess(userId);
      setRequests((list) => list.filter((r) => r.userId !== userId));
      setNotice(`${fullName} ${approve ? 'approved for Community Mode' : 'declined'}.`);
    } finally {
      setBusy('');
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 shadow-sm"><LogoSpinner /></div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-3 text-lg font-semibold text-amber-900">Admins only</h2>
        <button onClick={() => navigateBack(router, '/home')} className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Back to Student Home</button>
      </div>
    );
  }

  return (
    <>
      <SectionHeader
        eyebrow="Admin Console"
        title="Community Mode Access"
        subtitle="Approve or decline requests to create and manage communities."
        action={<button onClick={() => navigateBack(router, '/dashboard/admin')} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">← Admin Console</button>}
      />

      {notice ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</div> : null}

      {requests.length ? (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.userId} className="flex flex-col gap-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100"><Building2 className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{r.fullName} {r.username ? <span className="font-normal text-slate-400 dark:text-slate-500">@{r.username}</span> : null}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{r.email}{r.university ? ` · ${r.university}` : ''}{r.department ? ` · ${r.department}` : ''}</p>
                  {r.schoolEmail ? (
                    <p className="mt-1 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">School email: </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{r.schoolEmail}</span>
                      {r.schoolEmailVerified ? (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><Check className="h-3 w-3" /> verified</span>
                      ) : (
                        <span className="ml-1 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">unverified</span>
                      )}
                    </p>
                  ) : null}
                  {r.note ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">“{r.note}”</p> : null}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => void decide(r.userId, true, r.fullName)} disabled={busy === r.userId} className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"><Check className="h-4 w-4" /> Approve</button>
                <button onClick={() => void decide(r.userId, false, r.fullName)} disabled={busy === r.userId} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 disabled:opacity-60"><X className="h-4 w-4" /> Decline</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500 dark:text-slate-400">No pending community access requests.</div>
      )}
    </>
  );
}
