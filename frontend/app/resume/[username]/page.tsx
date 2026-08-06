'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Award, BadgeCheck, BookOpen, BriefcaseBusiness, CircleCheck, Download, GraduationCap, Mail, MapPin, Share2 } from 'lucide-react';
import { getResume } from './../../../components/guildos/auth-api';
import { getProfileCertificates, getReputationSummary, type ProfileCertificate, type ReputationSummary } from '../../../components/guildos/reputation-api';
import { getUserLeadershipHistory, type LeadershipHistoryEntry } from '../../../components/guildos/community-list-api';
import { StudentNav } from '../../../components/guildos/student-nav';
import { resolveFeedAvatar } from '../../../components/guildos/feed-api';
import { SocialLinks } from '../../../components/guildos/social-link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
function resolveAvatar(a?: string) {
  if (!a) return '';
  if (a.startsWith('http') || a.startsWith('/')) return a.startsWith('/') ? `${API_BASE_URL}${a}` : a;
  return `${API_BASE_URL}/uploads/${a}`;
}

export default function ResumePage() {
  const params = useParams<{ username: string }>();
  const username = typeof params?.username === 'string' ? decodeURIComponent(params.username) : '';
  const [data, setData] = useState<any>(null);
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const [leadership, setLeadership] = useState<LeadershipHistoryEntry[]>([]);
  const [certs, setCerts] = useState<ProfileCertificate[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await getResume(username);
        if (cancelled) return;
        setData(result);
        const userId = result.user?.id;
        if (userId) {
          const [rep, lead] = await Promise.allSettled([getReputationSummary(userId), getUserLeadershipHistory(userId)]);
          if (rep.status === 'fulfilled') setSummary(rep.value);
          if (lead.status === 'fulfilled') setLeadership(lead.value.leadershipHistory ?? []);
        }
        const cs = await getProfileCertificates(username).catch(() => ({ certificates: [] }));
        if (!cancelled) setCerts(cs.certificates);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load resume');
      }
    })();
    return () => { cancelled = true; };
  }, [username]);

  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  }

  if (error) return (
    <div className="min-h-screen bg-[#F4F6FA]"><StudentNav />
      <main className="mx-auto max-w-4xl px-4 py-10"><div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-600">{error}</div></main>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-[#F4F6FA]"><StudentNav />
      <main className="mx-auto max-w-4xl px-4 py-10 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-32 animate-pulse rounded-3xl bg-white dark:bg-slate-900" />)}
      </main>
    </div>
  );

  const resume = data.resume ?? data;
  const user = data.user ?? {};
  const avatar = resolveAvatar(resume.avatar ?? user?.profile?.avatar);
  const socialLinks: string[] = resume.socialLinks ?? [];
  const verified = certs.filter(c => c.status === 'VERIFIED');

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <StudentNav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-950 dark:text-white">Resume</h1>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800">
              <Download className="h-4 w-4" /> Print / Save PDF
            </button>
            <button onClick={() => void share()} className="no-print inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800">
              <Share2 className="h-4 w-4" /> {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>

        <div id="resume-doc" className="cv-document space-y-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md print:rounded-none print:border-none print:shadow-none">
          {/* Header */}
          <div className="flex flex-col gap-5 border-b border-slate-100 p-8 sm:flex-row sm:items-start">
            {avatar ? (
              <img src={avatar} alt={resume.fullName} className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow" />
            ) : (
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-2xl font-black text-white shadow">
                {(resume.fullName ?? 'U').slice(0, 1)}
              </div>
            )}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">{resume.fullName}</h2>
                <BadgeCheck className="h-5 w-5 text-sky-500" />
                {summary ? (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                    {summary.reputation.level}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 font-semibold text-indigo-600">{resume.headline}</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{resume.summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                {resume.location ? <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {resume.location}</span> : null}
                {resume.username ? <span className="flex items-center gap-1">@ {resume.username}</span> : null}
                {summary ? <span className="flex items-center gap-1 font-semibold text-emerald-600"><Award className="h-3.5 w-3.5" /> Guild Score {summary.reputation.guildScore.toLocaleString('en-NG')}</span> : null}
              </div>
              {socialLinks.length ? <div className="mt-3 max-w-lg"><SocialLinks links={socialLinks} compact /></div> : null}
            </div>
          </div>

          <div className="grid divide-y divide-slate-100 sm:grid-cols-[1fr_220px] sm:divide-x sm:divide-y-0">
            {/* Main */}
            <div className="space-y-6 p-8">
              {/* Education */}
              {resume.showUniversity !== false ? (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"><GraduationCap className="h-4 w-4" /> Education</h3>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 dark:bg-slate-900 p-4">
                    <p className="font-bold text-slate-900 dark:text-slate-100">{resume.university || '—'}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{[resume.faculty, resume.department].filter(Boolean).join(' · ')}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{resume.level}{resume.graduationYear ? ` · Expected ${resume.graduationYear}` : ''}</p>
                  </div>
                </section>
              ) : null}

              {/* Leadership */}
              {resume.showLeadership !== false && leadership.length ? (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"><BriefcaseBusiness className="h-4 w-4" /> Leadership Experience</h3>
                  <div className="space-y-3">
                    {leadership.map(e => (
                      <div key={e.id} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 dark:bg-slate-900 p-4">
                        <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-400" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-slate-900 dark:text-slate-100">{e.role.replace(/_/g, ' ')}</p>
                            {e.verificationStatus === 'VERIFIED' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200"><CircleCheck className="h-3 w-3" aria-hidden /> Verified</span>
                            ) : null}
                          </div>
                          {e.community ? <p className="text-sm font-medium text-indigo-600">{e.community.name}</p> : null}
                          <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(e.startDate).toLocaleDateString('en-NG', { year: 'numeric', month: 'short' })} – {e.endDate ? new Date(e.endDate).toLocaleDateString('en-NG', { year: 'numeric', month: 'short' }) : 'Present'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Certificates */}
              {resume.showCertificates !== false && verified.length ? (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"><Award className="h-4 w-4" /> Verified Certificates</h3>
                  <div className="space-y-2">
                    {verified.map(c => (
                      <a key={c.serial} href={`/certificates/${c.serial}`} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 dark:bg-slate-900 px-4 py-3 transition hover:border-indigo-200">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{c.eventTitle}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{c.communityName} · {new Date(c.issuedAt).toLocaleDateString('en-NG')}</p>
                        </div>
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700" aria-label="Verified"><CircleCheck className="h-4 w-4" aria-hidden /></span>
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            {/* Sidebar */}
            <div className="space-y-6 p-6">
              {/* Skills */}
              {resume.skills?.length ? (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"><BookOpen className="h-4 w-4" /> Skills & Interests</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {resume.skills.map((s: string) => (
                      <span key={s} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">{s}</span>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Stats */}
              {summary ? (
                <section>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Reputation</h3>
                  <div className="space-y-2">
                    {[
                      ['Guild Score', summary.reputation.guildScore.toLocaleString('en-NG')],
                      ['Events Completed', summary.stats.eventsCompleted],
                      ['Certificates', summary.stats.certificatesEarned],
                      ['Leadership Roles', summary.stats.leadershipRoles],
                    ].map(([l, v]) => (
                      <div key={String(l)} className="flex justify-between gap-2 border-b border-slate-50 py-1.5 last:border-b-0">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{l}</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{v}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Verification link */}
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Verify this resume</h3>
                <a href={`${window.location.origin}/u/${encodeURIComponent(username)}`} className="block truncate text-xs text-indigo-600 hover:underline">
                  guildos.app/u/{username}
                </a>
              </section>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">Generated by <strong>GuildOS</strong> · All credentials are verifiable on-chain at guildos.app</p>
      </main>
    </div>
  );
}
