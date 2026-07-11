'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Award, Briefcase, Eye, FileCheck2, ShieldCheck } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { getVerificationCenter, resolveViewerAvatar, type VerificationCenter, type VerificationRecentView } from '../../components/guildos/verification-api';
import { LogoSpinner } from '../../components/guildos/ui/loading';

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

/**
 * Groups consecutive views of the same source/type so multiple viewers of the same
 * post/profile appear inline (X-style: stacked avatars + "X and N others viewed").
 */
type ViewGroup = {
  key: string;
  source: 'PROFILE' | 'CERTIFICATE';
  hasRecruiter: boolean;
  views: VerificationRecentView[];
  latestAt: string;
};

function groupViews(views: VerificationRecentView[]): ViewGroup[] {
  const groups: ViewGroup[] = [];
  for (const v of views) {
    const last = groups[groups.length - 1];
    // Group only profile views (certificates keep individual entries since serial differs)
    if (last && last.source === 'PROFILE' && v.source === 'PROFILE') {
      last.views.push(v);
      if (v.viewerRole === 'RECRUITER') last.hasRecruiter = true;
    } else {
      groups.push({
        key: v.id,
        source: v.source,
        hasRecruiter: v.viewerRole === 'RECRUITER',
        views: [v],
        latestAt: v.createdAt,
      });
    }
  }
  return groups;
}

function ViewGroupRow({ group }: { group: ViewGroup }) {
  const { views, hasRecruiter, source, latestAt } = group;
  const named = views.filter(v => v.viewer);
  const anon = views.filter(v => !v.viewer);
  const shown = named.slice(0, 3);
  const extra = views.length - shown.length;

  const label = (() => {
    if (named.length === 0) {
      if (views.length === 1) return 'Someone viewed your profile';
      return `${views.length} people viewed your profile`;
    }
    const firstName = named[0].label;
    if (views.length === 1) return `${firstName} viewed your ${source === 'CERTIFICATE' ? 'certificate' : 'profile'}`;
    if (anon.length === 0) return `${firstName} and ${views.length - 1} other${views.length > 2 ? 's' : ''} viewed your profile`;
    return `${firstName} and ${views.length - 1} other${views.length > 2 ? 's' : ''} viewed your profile`;
  })();

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${hasRecruiter ? 'border-sky-200 bg-sky-50/50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
      {/* Stacked avatars */}
      <div className="flex shrink-0 -space-x-2 pt-0.5">
        {shown.map((v, i) => {
          const src = v.viewer?.avatar ? resolveViewerAvatar(v.viewer.avatar) : '';
          return src ? (
            v.viewer?.username ? (
              <Link key={v.id} href={`/profile/${encodeURIComponent(v.viewer.username)}`} title={v.viewer.fullName}
                style={{ zIndex: 10 - i }}
                className="h-9 w-9 rounded-full border-2 border-white object-cover overflow-hidden block transition hover:z-20">
                <img src={src} alt="" className="h-full w-full object-cover" />
              </Link>
            ) : (
              <img key={v.id} src={src} alt="" style={{ zIndex: 10 - i }} className="h-9 w-9 rounded-full border-2 border-white object-cover" />
            )
          ) : (
            <span key={v.id} style={{ zIndex: 10 - i }}
              className={`grid h-9 w-9 place-items-center rounded-full border-2 border-white text-base ${hasRecruiter ? 'bg-sky-100' : 'bg-slate-100'}`}>
              {v.viewerRole === 'RECRUITER' ? '💼' : '👤'}
            </span>
          );
        })}
        {extra > 0 ? (
          <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-slate-200 text-[11px] font-bold text-slate-600">+{extra}</span>
        ) : null}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">
          {named.length > 0 && named[0].viewer?.username ? (
            <Link href={`/profile/${encodeURIComponent(named[0].viewer.username)}`} className="hover:underline">
              {label}
            </Link>
          ) : label}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{timeAgo(latestAt)}</p>
      </div>

      {/* Recruiter badge */}
      {hasRecruiter ? (
        <span className="shrink-0 self-start rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-700 ring-1 ring-sky-200">
          💼 Recruiter
        </span>
      ) : null}
    </div>
  );
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
      if (!user) { router.replace('/login'); return; }
      try {
        const result = await getVerificationCenter();
        if (!cancelled) setData(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const stats = data?.stats;
  const cards = [
    { label: 'Verified certificates', value: stats?.certificatesVerified ?? 0, icon: <Award className="h-5 w-5" />, tone: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
    { label: 'Profile views', value: stats?.profileViews ?? 0, sub: `${stats?.profileViews30d ?? 0} in last 30 days`, icon: <Eye className="h-5 w-5" />, tone: 'bg-indigo-50 text-indigo-600 ring-indigo-100' },
    { label: 'Recruiter views', value: stats?.recruiterViews ?? 0, icon: <Briefcase className="h-5 w-5" />, tone: 'bg-sky-50 text-sky-600 ring-sky-100' },
    { label: 'Certificate checks', value: stats?.certificateViews ?? 0, icon: <FileCheck2 className="h-5 w-5" />, tone: 'bg-amber-50 text-amber-600 ring-amber-100' },
  ];

  const groups = data ? groupViews(data.recent) : [];

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <StudentNav />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-950">
            <ShieldCheck className="h-6 w-6 text-emerald-600" /> Verification Center
          </h1>
          <p className="mt-1 text-sm text-slate-500">Transparency into your verified credentials and who is viewing your profile.</p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-16 shadow-sm"><LogoSpinner /></div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((c) => (
                <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500">{c.label}</p>
                      <p className="mt-1.5 text-3xl font-extrabold tabular-nums text-slate-950">{c.value.toLocaleString()}</p>
                      {c.sub ? <p className="mt-0.5 text-[11px] text-slate-400">{c.sub}</p> : null}
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${c.tone}`}>{c.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Views — X notification style */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700">Recent views</h2>
                <div className="flex gap-2 text-xs">
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700 ring-1 ring-sky-200">💼 = Recruiter</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">👤 = Anonymous</span>
                </div>
              </div>
              <p className="mb-4 text-xs text-slate-400">Recruiter views show the recruiter. Non-recruiter viewers are anonymous for privacy. Multiple views are grouped like X notifications.</p>

              {groups.length ? (
                <div className="space-y-2">
                  {groups.map((g) => <ViewGroupRow key={g.key} group={g} />)}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <Eye className="mx-auto h-8 w-8 text-slate-200" />
                  <p className="mt-3 text-sm text-slate-500">No views yet. Share your profile to start building visibility.</p>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
