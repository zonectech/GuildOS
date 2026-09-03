'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getCurrentUser, resendVerification } from '../../components/guildos/auth-api';
import { SelectMenu } from '../../components/guildos/ui/select-menu';
import {
  createRecruiterOpportunity,
  getOpportunityApplicants,
  getRecruiterAnalytics,
  getRecruiterDashboard,
  getRecruiterOpportunities,
  registerRecruiter,
  requestRecruiterVerification,
  searchCandidates,
  setApplicantStatus,
  updateRecruiterOpportunity,
  OPPORTUNITY_CATEGORIES,
  type Applicant,
  type ApplicantReviewStatus,
  type Candidate,
  type RecruiterAnalytics,
  type RecruiterDashboard,
  type RecruiterOpportunity,
} from '../../components/guildos/recruiter-api';

const REVIEW_STATUSES: ApplicantReviewStatus[] = ['NEW', 'SHORTLISTED', 'CONTACTED', 'REJECTED', 'HIRED'];

export default function RecruiterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isRecruiter, setIsRecruiter] = useState(false);
  const [dashboard, setDashboard] = useState<RecruiterDashboard | null>(null);
  const [opps, setOpps] = useState<RecruiterOpportunity[]>([]);
  const [analytics, setAnalytics] = useState<RecruiterAnalytics | null>(null);
  const [emailVerified, setEmailVerified] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  // Onboarding form
  const [reg, setReg] = useState({ company: '', position: '', website: '', about: '' });

  // Post opportunity form
  const [form, setForm] = useState({ title: '', category: 'INTERNSHIP', organization: '', location: '', deadline: '', tags: '', applicationUrl: '', minGuildScore: '' });

  // Applicants
  const [applicantsFor, setApplicantsFor] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);

  // Candidate search
  const [candFilters, setCandFilters] = useState({ university: '', department: '', minGuildScore: '', requireLeadership: false, openToWork: false });
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  async function loadRecruiter() {
    const [d, o, a] = await Promise.all([getRecruiterDashboard(), getRecruiterOpportunities(), getRecruiterAnalytics()]);
    setDashboard(d);
    setOpps(o.opportunities);
    setAnalytics(a);
  }

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        setEmailVerified(user.emailVerified);
        setUserEmail(user.email);
        if (user.role === 'RECRUITER' || user.role === 'ADMIN') {
          setIsRecruiter(true);
          await loadRecruiter();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load recruiter portal');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleRegister() {
    try {
      setError('');
      await registerRecruiter(reg);
      setIsRecruiter(true);
      await loadRecruiter();
      setNotice('Welcome! Your recruiter account is ready.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register');
    }
  }

  async function handlePost() {
    if (!form.title.trim()) return;
    try {
      setError('');
      await createRecruiterOpportunity({
        title: form.title,
        category: form.category,
        organization: form.organization,
        location: form.location,
        deadline: form.deadline || null,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        applicationUrl: form.applicationUrl,
        eligibility: { minGuildScore: form.minGuildScore ? Number(form.minGuildScore) : 0 },
      });
      setForm({ title: '', category: 'INTERNSHIP', organization: '', location: '', deadline: '', tags: '', applicationUrl: '', minGuildScore: '' });
      await loadRecruiter();
      setNotice('Opportunity published.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish opportunity');
    }
  }

  async function toggleClose(o: RecruiterOpportunity) {
    try {
      await updateRecruiterOpportunity(o.id, { status: o.status === 'OPEN' ? 'CLOSED' : 'OPEN' });
      await loadRecruiter();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update');
    }
  }

  async function viewApplicants(id: string) {
    try {
      if (applicantsFor === id) { setApplicantsFor(null); return; }
      const result = await getOpportunityApplicants(id);
      setApplicants(result.applicants);
      setApplicantsFor(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load applicants');
    }
  }

  async function changeApplicantStatus(candidateId: string, status: ApplicantReviewStatus) {
    if (!applicantsFor) return;
    try {
      await setApplicantStatus(applicantsFor, candidateId, status);
      setApplicants((list) => list.map((a) => (a.userId === candidateId ? { ...a, reviewStatus: status } : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update applicant');
    }
  }

  async function handleResendVerification() {
    try {
      await resendVerification({ email: userEmail });
      setNotice('Verification email sent. Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend verification email');
    }
  }

  async function handleRequestVerification() {
    try {
      setError('');
      await requestRecruiterVerification();
      await loadRecruiter();
      setNotice('Verification requested. An admin will review your organization.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request verification');
    }
  }

  async function runCandidateSearch() {
    try {
      const result = await searchCandidates({
        university: candFilters.university || undefined,
        department: candFilters.department || undefined,
        minGuildScore: candFilters.minGuildScore ? Number(candFilters.minGuildScore) : undefined,
        requireLeadership: candFilters.requireLeadership,
        openToWork: candFilters.openToWork,
      });
      setCandidates(result.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to search candidates');
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-4 py-10"><p className="text-slate-500 dark:text-slate-400">Loading…</p></main>;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Recruiter Portal</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Publish opportunities and discover students by verified activity and Guild Score.</p>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</div> : null}

      {!emailVerified ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300">
          <span>Verify your email to build trust with candidates{userEmail ? ` — sent to ${userEmail}` : ''}.</span>
          <button onClick={() => void handleResendVerification()} className="rounded-xl border border-amber-300 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-amber-800">Resend email</button>
        </div>
      ) : null}

      {!isRecruiter ? (
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Become a recruiter</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Set up your organization to start posting opportunities.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className="ev-input" placeholder="Company / organization *" value={reg.company} onChange={(e) => setReg({ ...reg, company: e.target.value })} />
            <input className="ev-input" placeholder="Your position" value={reg.position} onChange={(e) => setReg({ ...reg, position: e.target.value })} />
            <input className="ev-input" placeholder="Website" value={reg.website} onChange={(e) => setReg({ ...reg, website: e.target.value })} />
            <input className="ev-input" placeholder="About (short)" value={reg.about} onChange={(e) => setReg({ ...reg, about: e.target.value })} />
          </div>
          <button onClick={() => void handleRegister()} className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create recruiter account</button>
        </section>
      ) : (
        <>
          {dashboard ? (
            <section className="grid gap-4 sm:grid-cols-3">
              <Stat label="Opportunities" value={dashboard.stats.opportunities} />
              <Stat label="Open" value={dashboard.stats.openOpportunities} />
              <Stat label="Applicants" value={dashboard.stats.totalApplicants} />
            </section>
          ) : null}

          {dashboard?.recruiter ? (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Organization verification</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {dashboard.recruiter.verificationStatus === 'VERIFIED'
                    ? 'Your organization is verified. Your listings show a trusted badge to students.'
                    : dashboard.recruiter.verificationStatus === 'PENDING'
                    ? 'Your verification request is pending admin review.'
                    : dashboard.recruiter.verificationStatus === 'REJECTED'
                    ? `Verification was declined.${dashboard.recruiter.verificationNote ? ` Note: ${dashboard.recruiter.verificationNote}` : ''} You can request again.`
                    : 'Get a verified badge to build trust with candidates.'}
                </p>
              </div>
              {dashboard.recruiter.verificationStatus === 'VERIFIED' ? (
                <span className="rounded-full bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">✓ Verified</span>
              ) : dashboard.recruiter.verificationStatus === 'PENDING' ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Pending review</span>
              ) : (
                <button onClick={() => void handleRequestVerification()} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Request verification</button>
              )}
            </section>
          ) : null}

          {dashboard?.reputation ? (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Employer reputation</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {dashboard.reputation.successfulHires} successful hire(s) · {dashboard.reputation.responseRate}% response rate
                  {dashboard.reputation.activeSince ? ` · active since ${new Date(dashboard.reputation.activeSince).toLocaleDateString('en-NG')}` : ''}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${dashboard.reputation.tier === 'Top Campus Employer' ? 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300' : dashboard.reputation.tier === 'Trusted Employer' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : dashboard.reputation.tier === 'Verified Recruiter' ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400'}`}>{dashboard.reputation.tier}</span>
            </section>
          ) : null}

          {analytics ? (
            <section className="space-y-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Analytics</h2>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <MiniStat label="Views" value={analytics.summary.totalViews} />
                <MiniStat label="Applied" value={analytics.summary.applied} />
                <MiniStat label="Interested" value={analytics.summary.interested} />
                <MiniStat label="Saved" value={analytics.summary.saved} />
                <MiniStat label="Hires" value={analytics.summary.hires} />
                <MiniStat label="Listings" value={analytics.summary.opportunities} />
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                <Breakdown title="Applicants by university" rows={analytics.byUniversity.map((r) => ({ label: r.university, count: r.count }))} />
                <Breakdown title="By Guild Score band" rows={analytics.byScoreBand.map((r) => ({ label: r.band, count: r.count }))} />
                <Breakdown title="Top communities" rows={analytics.byCommunity.map((r) => ({ label: r.community, count: r.count }))} />
              </div>
              {analytics.perOpportunity.length ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Per opportunity</h3>
                  <div className="space-y-1">
                    {analytics.perOpportunity.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                        <span className="truncate text-slate-800 dark:text-slate-200">{p.title}</span>
                        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{p.views} views · {p.applyCount} applied · {p.saveCount} saved</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Post an opportunity</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className="ev-input" placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <SelectMenu
                aria-label="Category"
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                options={OPPORTUNITY_CATEGORIES.map((c) => ({ value: c, label: c.replace('_', ' ') }))}
              />
              <input className="ev-input" placeholder="Organization" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
              <input className="ev-input" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <input className="ev-input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              <input className="ev-input" placeholder="Application URL" value={form.applicationUrl} onChange={(e) => setForm({ ...form, applicationUrl: e.target.value })} />
              <input className="ev-input" placeholder="Tags (comma-separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              <input className="ev-input" type="number" placeholder="Min Guild Score" value={form.minGuildScore} onChange={(e) => setForm({ ...form, minGuildScore: e.target.value })} />
            </div>
            <button onClick={() => void handlePost()} className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Publish opportunity</button>
          </section>

          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">My opportunities</h2>
            {opps.length ? (
              <div className="mt-4 space-y-3">
                {opps.map((o) => (
                  <div key={o.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{o.title} <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${o.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400'}`}>{o.status}</span>{o.moderationStatus && o.moderationStatus !== 'VERIFIED' ? <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{o.moderationStatus === 'PENDING_REVIEW' ? 'Pending review' : o.moderationStatus === 'FLAGGED' ? 'Flagged' : o.moderationStatus}</span> : null}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{o.category.replace('_', ' ')} · {o.applyCount} applied · {o.saveCount} saved</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => void viewApplicants(o.id)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{applicantsFor === o.id ? 'Hide applicants' : 'View applicants'}</button>
                        <button onClick={() => void toggleClose(o)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{o.status === 'OPEN' ? 'Close' : 'Reopen'}</button>
                      </div>
                    </div>
                    {applicantsFor === o.id ? (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        {applicants.length ? (
                          <ul className="space-y-2">
                            {applicants.map((a) => (
                              <li key={a.userId + a.action} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <div className="min-w-0">
                                  <a href={`/u/${encodeURIComponent(a.username)}`} className="font-medium text-slate-900 dark:text-slate-100 hover:underline">{a.fullName}</a>
                                  <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{a.matchScore}% match</span>
                                  {a.availability === 'OPEN' ? <span className="ml-1 text-xs font-medium text-emerald-600">● open</span> : null}
                                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{a.university || '—'} · GS {a.guildScore} · {a.action}</span>
                                  {a.reasons.length ? <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 capitalize">{a.reasons.slice(0, 3).join(' · ')}</p> : null}
                                </div>
                                <SelectMenu
                                  aria-label="Applicant review status"
                                  className="w-36"
                                  size="sm"
                                  value={a.reviewStatus}
                                  onChange={(v) => void changeApplicantStatus(a.userId, v as ApplicantReviewStatus)}
                                  options={REVIEW_STATUSES.map((s) => ({ value: s, label: s }))}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : <p className="text-sm text-slate-500 dark:text-slate-400">No applicants yet.</p>}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">You haven&apos;t posted any opportunities yet.</p>}
          </section>

          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Find candidates</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <input className="ev-input" placeholder="University" value={candFilters.university} onChange={(e) => setCandFilters({ ...candFilters, university: e.target.value })} />
              <input className="ev-input" placeholder="Department" value={candFilters.department} onChange={(e) => setCandFilters({ ...candFilters, department: e.target.value })} />
              <input className="ev-input" type="number" placeholder="Min Guild Score" value={candFilters.minGuildScore} onChange={(e) => setCandFilters({ ...candFilters, minGuildScore: e.target.value })} />
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={candFilters.requireLeadership} onChange={(e) => setCandFilters({ ...candFilters, requireLeadership: e.target.checked })} /> Leaders only</label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={candFilters.openToWork} onChange={(e) => setCandFilters({ ...candFilters, openToWork: e.target.checked })} /> Only students open to opportunities</label>
            <button onClick={() => void runCandidateSearch()} className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Search</button>
            {candidates.length ? (
              <div className="mt-4 space-y-2">
                {candidates.map((c) => (
                  <div key={c.userId} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-2">
                    <div>
                      <a href={`/u/${encodeURIComponent(c.username)}`} className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline">{c.fullName}</a>
                      {c.availability === 'OPEN' ? <span className="ml-2 text-xs font-medium text-emerald-600">● open to work</span> : c.availability === 'CASUAL' ? <span className="ml-2 text-xs font-medium text-amber-600">● casual</span> : null}
                      <p className="text-xs text-slate-500 dark:text-slate-400">{[c.department, c.university].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{c.guildScore.toLocaleString('en-NG')} · {c.level}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 dark:bg-slate-900 p-3 text-center">
      <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
      {rows.length ? (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span className="truncate">{r.label}</span><span>{r.count}</span></div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-950"><div className="h-full rounded-full bg-indigo-400" style={{ width: `${(r.count / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-slate-400 dark:text-slate-500">No data yet.</p>}
    </div>
  );
}
