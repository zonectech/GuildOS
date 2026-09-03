'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Award, BadgeCheck, BriefcaseBusiness, CircleCheck, GraduationCap, Share2, Trophy, Users } from 'lucide-react';
import { getPublicPortfolio } from './../../../components/guildos/auth-api';
import { getProfileCertificates, getReputationSummary, getPublicTimeline, type ProfileCertificate, type ReputationSummary, type ReputationActivityEntry } from '../../../components/guildos/reputation-api';
import { getUserLeadershipHistory, type LeadershipHistoryEntry } from '../../../components/guildos/community-list-api';
import { StudentNav } from '../../../components/guildos/student-nav';
import { SocialLinks } from '../../../components/guildos/social-link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
function resolveAvatar(a?: string) {
  if (!a) return '';
  if (a.startsWith('http')) return a;
  if (a.startsWith('/')) return `${API_BASE_URL}${a}`;
  return `${API_BASE_URL}/uploads/${a}`;
}

function fmt(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short' });
}

export default function PortfolioPage() {
  const params = useParams<{ username: string }>();
  const username = typeof params?.username === 'string' ? decodeURIComponent(params.username) : '';
  const [data, setData] = useState<any>(null);
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const [leadership, setLeadership] = useState<LeadershipHistoryEntry[]>([]);
  const [certs, setCerts] = useState<ProfileCertificate[]>([]);
  const [timeline, setTimeline] = useState<ReputationActivityEntry[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await getPublicPortfolio(username);
        if (cancelled) return;
        setData(result);
        const userId = result.user?.id ?? (result.portfolio as any)?.profile?.id;
        if (userId) {
          const [rep, lead, tl] = await Promise.allSettled([
            getReputationSummary(userId),
            getUserLeadershipHistory(userId),
            getPublicTimeline(userId, 20),
          ]);
          if (rep.status === 'fulfilled') setSummary(rep.value);
          if (lead.status === 'fulfilled') setLeadership(lead.value.leadershipHistory ?? []);
          if (tl.status === 'fulfilled') setTimeline(tl.value.activity);
        }
        const cs = await getProfileCertificates(username).catch(() => ({ certificates: [] }));
        if (!cancelled) setCerts(cs.certificates);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load portfolio');
      }
    })();
    return () => { cancelled = true; };
  }, [username]);

  if (error) return (
    <div className="min-h-screen bg-[#F4F6FA]"><StudentNav />
      <main className="mx-auto max-w-5xl px-4 py-10"><div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-600 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300">{error}</div></main>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-[#F4F6FA]"><StudentNav />
      <main className="mx-auto max-w-5xl px-4 py-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({length: 6}).map((_,i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-white dark:bg-slate-900" />)}
      </main>
    </div>
  );

  const portfolio = data.portfolio ?? data;
  const profile = portfolio.profile ?? {};
  const avatar = resolveAvatar(profile.avatar);
  const LEVEL_TONE: Record<string, string> = {
    'Explorer Guild': 'from-slate-500 to-slate-700', 'Bronze Guild': 'from-amber-600 to-orange-700',
    'Silver Guild': 'from-slate-400 to-slate-600', 'Gold Guild': 'from-yellow-400 to-amber-600',
    'Platinum Guild': 'from-cyan-400 to-sky-600', 'Elite Guild': 'from-fuchsia-500 to-indigo-700',
  };
  const grad = summary ? LEVEL_TONE[summary.reputation.level] ?? 'from-indigo-600 to-sky-500' : 'from-indigo-600 to-sky-500';

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <StudentNav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {/* Hero card */}
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${grad} p-8 text-white shadow-md`}>
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="flex items-start gap-4">
              {avatar ? (
                <img src={avatar} alt={profile.fullName} className="h-20 w-20 rounded-2xl border-4 border-white/30 object-cover shadow-lg" />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-white/30 bg-white/20 text-3xl font-black">
                  {(profile.fullName ?? 'U').slice(0, 1)}
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold">{profile.fullName}</h1>
                  <BadgeCheck className="h-5 w-5 text-white/80" />
                </div>
                <p className="text-sm text-white/80">@{profile.username}</p>
                <p className="mt-0.5 text-sm text-white/75">{[profile.department, profile.university].filter(Boolean).join(' · ')}</p>
                {profile.socialLinks?.length ? (
                  <div className="mt-3 max-w-md text-slate-900 dark:text-slate-100">
                    <SocialLinks links={profile.socialLinks} compact />
                  </div>
                ) : null}
              </div>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Link href={`/u/${encodeURIComponent(username)}`} className="rounded-xl bg-white/15 px-3.5 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25">View Profile</Link>
              <Link href={`/resume/${encodeURIComponent(username)}`} className="rounded-xl bg-white/15 px-3.5 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25">View Resume</Link>
              <button onClick={() => { navigator.clipboard.writeText(window.location.href).then(()=>{setCopied(true); setTimeout(()=>setCopied(false),1500);}); }} className="rounded-xl bg-white/15 px-3.5 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25">
                <Share2 className="h-4 w-4 inline -mt-0.5 mr-1" />{copied ? 'Copied!' : 'Share'}
              </button>
            </div>
          </div>
          {/* Stats strip */}
          {summary ? (
            <div className="relative mt-6 flex flex-wrap gap-5 border-t border-white/20 pt-5">
              {[
                ['Guild Score', summary.reputation.guildScore.toLocaleString('en-NG')],
                ['Events', summary.stats.eventsCompleted],
                ['Certificates', summary.stats.certificatesEarned],
                ['Leadership', summary.stats.leadershipRoles],
                ['Communities', summary.stats.communitiesJoined],
              ].map(([l, v]) => (
                <div key={String(l)}>
                  <p className="text-xl font-extrabold tabular-nums">{v}</p>
                  <p className="text-xs text-white/70">{l}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-5 lg:col-span-2">
            {/* Leadership */}
            {leadership.length ? (
              <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"><BriefcaseBusiness className="h-4 w-4" /> Leadership Experience</h2>
                <div className="space-y-3">
                  {leadership.map(e => (
                    <div key={e.id} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 dark:bg-slate-900 p-4 transition hover:border-indigo-200">
                      <div className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-400" />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">{e.role.replace(/_/g, ' ')}</p>
                            {e.community ? <p className="text-sm text-indigo-600">{e.community.name}</p> : null}
                            <p className="text-xs text-slate-400 dark:text-slate-500">{fmt(e.startDate)} – {e.endDate ? fmt(e.endDate) : 'Present'}</p>
                          </div>
                          {e.verificationStatus === 'VERIFIED' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"><CircleCheck className="h-3.5 w-3.5" aria-hidden /> Verified</span>
                          ) : <span className="rounded-full bg-slate-100 dark:bg-slate-950 px-2.5 py-0.5 text-xs text-slate-500 dark:text-slate-400">Pending</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Certificates */}
            {certs.length ? (
              <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"><Award className="h-4 w-4" /> Certificates</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {certs.map(c => (
                    <Link key={c.serial} href={`/certificates/${c.serial}`} className="group flex items-start justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{c.eventTitle}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{c.communityName}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(c.issuedAt).toLocaleDateString('en-NG')}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${c.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-rose-50 text-rose-700'}`}>
                        {c.status === 'VERIFIED' ? <><CircleCheck className="h-3.5 w-3.5" aria-hidden /> Verified</> : 'Revoked'}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Bio */}
            {profile.bio ? (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">About</h2>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{profile.bio}</p>
              </div>
            ) : null}

            {/* Guild Score */}
            {summary ? (
              <div className={`rounded-3xl bg-gradient-to-br ${grad} p-5 text-white shadow-sm`}>
                <div className="flex items-center gap-2"><Trophy className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-widest opacity-80">Guild Score</span></div>
                <p className="mt-2 text-4xl font-extrabold tabular-nums">{summary.reputation.guildScore.toLocaleString('en-NG')}</p>
                <p className="mt-0.5 text-sm opacity-80">{summary.reputation.level}{summary.rank ? ` · Rank #${summary.rank}` : ''}</p>
                {summary.reputation.badges.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {summary.reputation.badges.map(b => (
                      <span key={b.code} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs backdrop-blur">{b.icon} {b.label}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Interests */}
            {profile.interests?.length ? (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Interests</h2>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((i: string) => <span key={i} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">{i}</span>)}
                </div>
              </div>
            ) : null}

            {/* Activity timeline */}
            {timeline.length ? (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Recent Activity</h2>
                <ol className="border-l-2 border-indigo-100 pl-4 space-y-3">
                  {timeline.slice(0, 8).map(a => (
                    <li key={a.id} className="flex items-start justify-between gap-2">
                      <div><p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{a.description || a.type}</p><p className="text-[11px] text-slate-400 dark:text-slate-500">{fmt(a.createdAt)}</p></div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">+{a.scoreAwarded}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
