'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';

import { getCurrentUser, logout, resendVerification } from '../../components/guildos/auth-api';
import { GuildOSLogo } from '../../components/guildos/guildos-logo';
import { SelectMenu } from '../../components/guildos/ui/select-menu';
import { getUnreadCount } from '../../components/guildos/notification-api';
import { OPPORTUNITY_CATEGORY_LABELS, type OpportunityCategory } from '../../components/guildos/opportunity-api';
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
const REVIEW_LABELS: Record<ApplicantReviewStatus, string> = { NEW: 'New', SHORTLISTED: 'Shortlisted', CONTACTED: 'Contacted', REJECTED: 'Not moving forward', HIRED: 'Hired' };
const ACTION_LABELS: Record<string, string> = { APPLIED: 'Applied', INTERESTED: 'Interested', SAVED: 'Saved it' };
const ACTION_ORDER: Record<string, number> = { APPLIED: 0, INTERESTED: 1, SAVED: 2 };
const categoryLabel = (c: string) => OPPORTUNITY_CATEGORY_LABELS[c as OpportunityCategory] ?? c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, ' ');
const EMPTY_FORM = { title: '', category: 'INTERNSHIP', description: '', organization: '', location: '', deadline: '', tags: '', applicationUrl: '', minGuildScore: '' };

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
  const [unread, setUnread] = useState(0);

  // Onboarding form
  const [reg, setReg] = useState({ company: '', position: '', website: '', about: '' });

  // Post opportunity form
  const [form, setForm] = useState(EMPTY_FORM);

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
        void getUnreadCount().then((r) => setUnread(r.count)).catch(() => undefined);
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
    if (!form.title.trim()) { setError('Give the job a title.'); return; }
    if (!form.applicationUrl.trim()) { setError('Add the link where students apply.'); return; }
    try {
      setError('');
      const created = await createRecruiterOpportunity({
        title: form.title,
        category: form.category,
        description: form.description,
        organization: form.organization || dashboard?.recruiter?.company || '',
        location: form.location,
        deadline: form.deadline || null,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        applicationUrl: form.applicationUrl,
        eligibility: { minGuildScore: form.minGuildScore ? Number(form.minGuildScore) : 0 },
      });
      setForm(EMPTY_FORM);
      await loadRecruiter();
      setNotice(created.moderationStatus === 'VERIFIED'
        ? 'Your job is live. Students can find it and apply now.'
        : 'Job saved. Our team checks jobs from new employers before students see them. You will get a notification when it is live.');
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
      setApplicants([...result.applicants].sort((x, y) => (ACTION_ORDER[x.action] ?? 9) - (ACTION_ORDER[y.action] ?? 9) || y.matchScore - x.matchScore));
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
      if (status === 'SHORTLISTED' || status === 'CONTACTED' || status === 'HIRED') setNotice('Saved. The student got a notification.');
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
    {/* Recruiters had no way to navigate or sign out on this page. */}
    <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <GuildOSLogo variant="nav" href="/recruiter" />
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">Recruiter</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/notifications" aria-label={unread ? `${unread} unread notifications` : 'Notifications'} className="relative grid h-9 w-9 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <Bell className="h-5 w-5" />
            {unread ? <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span> : null}
          </Link>
          <button
            type="button"
            onClick={() => void logout().finally(() => { window.location.href = '/login'; })}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Recruiter portal</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Post jobs, review who applied, and find students by verified activity and Guild Score.</p>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</div> : null}

      {!emailVerified ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300">
          <span>Verify your email to build trust with candidates{userEmail ? ` (sent to ${userEmail})` : ''}.</span>
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
              <Stat label="Jobs posted" value={dashboard.stats.opportunities} />
              <Stat label="Open now" value={dashboard.stats.openOpportunities} />
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
                    : 'Verified employers get a badge, and their jobs go live without waiting for review.'}
                </p>
              </div>
              {dashboard.recruiter.verificationStatus === 'VERIFIED' ? (
                <span className="rounded-full bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">✓ Verified</span>
              ) : dashboard.recruiter.verificationStatus === 'PENDING' ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Pending review</span>
              ) : (
                <button onClick={() => void handleRequestVerification()} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Request verification</button>
              )}
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Post a job</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className="ev-input" placeholder="Job title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <SelectMenu
                aria-label="Category"
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                options={OPPORTUNITY_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))}
              />
              <textarea className="ev-input min-h-[96px] sm:col-span-2" placeholder="What will they do, and who is it for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <input className="ev-input" placeholder={dashboard?.recruiter?.company ? `Company (defaults to ${dashboard.recruiter.company})` : 'Company'} value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
              <input className="ev-input" placeholder="Location, e.g. Lagos or Remote" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <label className="block text-xs text-slate-500 dark:text-slate-400">Application deadline
                <input className="ev-input mt-1" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </label>
              <label className="block text-xs text-slate-500 dark:text-slate-400">Where students apply *
                <input className="ev-input mt-1" placeholder="https://" value={form.applicationUrl} onChange={(e) => setForm({ ...form, applicationUrl: e.target.value })} />
              </label>
              <input className="ev-input" placeholder="Skills, comma-separated (helps matching)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              <input className="ev-input" type="number" placeholder="Minimum Guild Score (optional)" value={form.minGuildScore} onChange={(e) => setForm({ ...form, minGuildScore: e.target.value })} />
            </div>
            <button onClick={() => void handlePost()} className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900">Post job</button>
          </section>

          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Your jobs</h2>
            {opps.length ? (
              <div className="mt-4 space-y-3">
                {opps.map((o) => (
                  <div key={o.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{o.title} <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${o.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400'}`}>{o.status === 'OPEN' ? 'Open' : o.status === 'DRAFT' ? 'Draft' : 'Closed'}</span>{o.moderationStatus && o.moderationStatus !== 'VERIFIED' ? <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{o.moderationStatus === 'PENDING_REVIEW' ? 'Waiting for review' : o.moderationStatus === 'FLAGGED' ? 'Under review after reports' : 'Not approved'}</span> : null}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{categoryLabel(o.category)} · {o.applyCount} applied · {o.saveCount} saved</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => void viewApplicants(o.id)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{applicantsFor === o.id ? 'Hide people' : 'See who applied'}</button>
                        <button onClick={() => void toggleClose(o)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{o.status === 'OPEN' ? 'Close' : 'Reopen'}</button>
                      </div>
                    </div>
                    {applicantsFor === o.id ? (
                      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                        {applicants.length ? <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">Students you mark Shortlisted, Contacted or Hired get a notification. Your notes stay private.</p> : null}
                        {applicants.length ? (
                          <ul className="space-y-2">
                            {applicants.map((a) => (
                              <li key={a.userId + a.action} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <div className="min-w-0">
                                  <a href={`/u/${encodeURIComponent(a.username)}`} className="font-medium text-slate-900 dark:text-slate-100 hover:underline">{a.fullName}</a>
                                  <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{a.matchScore}% match</span>
                                  {a.availability === 'OPEN' ? <span className="ml-1 text-xs font-medium text-emerald-600">● open</span> : null}
                                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{a.university || 'University not set'} · Guild Score {a.guildScore.toLocaleString('en-NG')} · {ACTION_LABELS[a.action] ?? a.action}</span>
                                  {a.reasons.length ? <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{a.reasons.slice(0, 3).map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(' · ')}</p> : null}
                                </div>
                                <SelectMenu
                                  aria-label="Applicant review status"
                                  className="w-44"
                                  size="sm"
                                  value={a.reviewStatus}
                                  onChange={(v) => void changeApplicantStatus(a.userId, v as ApplicantReviewStatus)}
                                  options={REVIEW_STATUSES.map((s) => ({ value: s, label: REVIEW_LABELS[s] }))}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : <p className="text-sm text-slate-500 dark:text-slate-400">Nobody yet. Students who apply, save or mark interest show up here.</p>}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No jobs yet. Post your first one above.</p>}
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
                      <p className="text-xs text-slate-500 dark:text-slate-400">{[c.department, c.university].filter(Boolean).join(' · ') || 'Not set'}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{c.guildScore.toLocaleString('en-NG')} · {c.level}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {dashboard?.reputation ? (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Employer reputation</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {dashboard.reputation.successfulHires} successful hire(s) · {dashboard.reputation.responseRate}% response rate
                  {dashboard.reputation.activeSince ? ` · active since ${new Date(dashboard.reputation.activeSince).toLocaleDateString('en-NG')}` : ''}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${dashboard.reputation.tier === 'Top Campus Employer' ? 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300' : dashboard.reputation.tier === 'Trusted Employer' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : dashboard.reputation.tier === 'Verified Recruiter' ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400'}`}>{dashboard.reputation.tier === 'Unverified' ? 'New employer' : dashboard.reputation.tier}</span>
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
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">By job</h3>
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
        </>
      )}
    </main>
    </div>
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
