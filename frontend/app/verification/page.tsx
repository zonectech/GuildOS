'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Eye, Award, Briefcase, FileCheck2, Loader2 } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { getVerificationCenter, resolveViewerAvatar, type VerificationCenter } from '../../components/guildos/verification-api';

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export default function VerificationCenterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationCenter | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      try {
        const result = await getVerificationCenter();
        if (!cancelled) setData(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const stats = data?.stats;
  const cards = [
    { label: 'Verified certificates', value: stats?.certificatesVerified ?? 0, icon: <Award className="h-5 w-5" />, tone: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
    { label: 'Profile views', value: stats?.profileViews ?? 0, sub: `${stats?.profileViews30d ?? 0} in last 30 days`, icon: <Eye className="h-5 w-5" />, tone: 'bg-indigo-50 text-indigo-600 ring-indigo-100' },
    { label: 'Recruiter views', value: stats?.recruiterViews ?? 0, icon: <Briefcase className="h-5 w-5" />, tone: 'bg-sky-50 text-sky-600 ring-sky-100' },
    { label: 'Certificate checks', value: stats?.certificateViews ?? 0, icon: <FileCheck2 className="h-5 w-5" />, tone: 'bg-amber-50 text-amber-600 ring-amber-100' },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950"><ShieldCheck className="h-6 w-6 text-emerald-600" /> Verification Center</h1>
          <p className="text-sm text-slate-500">Transparency into your verified credentials and who&apos;s viewing your profile.</p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-16 shadow-sm"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {cards.map((c) => (
                <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{c.label}</p>
                      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{c.value.toLocaleString()}</p>
                      {c.sub ? <p className="mt-0.5 text-xs text-slate-400">{c.sub}</p> : null}
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${c.tone}`}>{c.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Recent views</h2>
              <p className="mt-0.5 text-sm text-slate-500">Recruiter views show the recruiter; other viewers stay anonymous for privacy.</p>
              <div className="mt-4 space-y-2">
                {data?.recent.length ? (
                  data.recent.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                      {v.viewer?.avatar ? (
                        <img src={resolveViewerAvatar(v.viewer.avatar)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">{v.viewerRole === 'RECRUITER' ? '💼' : '👀'}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {v.viewer ? (
                            <Link href={`/profile/${encodeURIComponent(v.viewer.username)}`} className="hover:underline">{v.label}</Link>
                          ) : v.label}
                          <span className="ml-1 font-normal text-slate-400">viewed your {v.source === 'CERTIFICATE' ? 'certificate' : 'profile'}</span>
                        </p>
                        <p className="text-xs text-slate-400">{timeAgo(v.createdAt)}</p>
                      </div>
                      {v.viewerRole === 'RECRUITER' ? <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">Recruiter</span> : null}
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No views yet. Share your profile to start building visibility.</p>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
