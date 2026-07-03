'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import {
  getPendingRecruiters,
  rejectRecruiter,
  verifyRecruiter,
  type PendingRecruiter,
} from '../../../components/guildos/recruiter-api';

export default function AdminRecruitersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<PendingRecruiter[]>([]);

  async function load() {
    const { recruiters } = await getPendingRecruiters();
    setPending(recruiters);
  }

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        if (user.role !== 'ADMIN') {
          setError('Admins only.');
          return;
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load recruiter requests');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function decide(userId: string, approve: boolean) {
    const note = approve ? '' : (window.prompt('Reason for declining (optional):') ?? '');
    try {
      if (approve) await verifyRecruiter(userId);
      else await rejectRecruiter(userId, note);
      setPending((list) => list.filter((r) => r.userId !== userId));
      setNotice(approve ? 'Recruiter verified.' : 'Recruiter declined.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update recruiter');
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-4xl px-4 py-10"><p className="text-slate-500">Loading…</p></main>;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950">Recruiter verification</h1>
        <p className="text-sm text-slate-500">Review and approve organizations requesting a verified badge.</p>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      {pending.length ? (
        <div className="space-y-3">
          {pending.map((r) => (
            <div key={r.userId} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">{r.company}</p>
                  <p className="text-sm text-slate-500">{r.fullName} · {r.email}{r.position ? ` · ${r.position}` : ''}</p>
                  {r.website ? <a href={r.website} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">{r.website}</a> : null}
                  {r.about ? <p className="mt-2 text-sm text-slate-600">{r.about}</p> : null}
                  <p className="mt-1 text-xs text-slate-400">Requested {new Date(r.requestedAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void decide(r.userId, true)} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Verify</button>
                  <button onClick={() => void decide(r.userId, false)} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Decline</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No pending verification requests.</p>
      )}
    </main>
  );
}
