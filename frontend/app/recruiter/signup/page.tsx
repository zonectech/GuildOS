'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Award, BadgeCheck, Crown, QrCode, Trophy } from 'lucide-react';

import { recruiterSignup } from '../../../components/guildos/api/auth-api';
import { AuthField, AuthSplitLayout } from '../../../components/guildos/auth-pages';
import { useMediaQuery } from '../../../components/guildos/use-media-query';

// A made-up student, clearly marked as a sample, showing what an applicant looks like in the portal.
const SAMPLE_RECORD = [
  { icon: QrCode, tint: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', title: 'Checked in at Campus Tech Week', by: 'Scanned at the door' },
  { icon: Award, tint: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', title: 'Certificate: Intro to React workshop', by: 'Issued by the Tech Club' },
  { icon: Crown, tint: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', title: 'Events lead, Debate Society', by: 'Confirmed by the club' },
  { icon: Trophy, tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', title: '2nd place, campus hackathon', by: 'Judged by organizers' },
];

function SampleApplicantCard() {
  return (
    <div className="auth-portfolio-card w-full max-w-md p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">What an applicant looks like</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">Sample</span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-base font-bold text-white">TA</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">Tobi A. <BadgeCheck className="h-4 w-4 text-sky-500" aria-label="Verified student" /></p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">Computer Science · 300 level</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">1,450</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Guild Score</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-[82%] rounded-full bg-gradient-to-r from-indigo-500 to-sky-500" /></div>
        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">82% match</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">for your Frontend Intern job · open to work</p>

      <ul className="mt-4 space-y-2">
        {SAMPLE_RECORD.map((item) => (
          <li key={item.title} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${item.tint}`}><item.icon className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{item.title}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{item.by}</p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-2">
        <span className="flex-1 rounded-xl bg-slate-900 py-2 text-center text-xs font-semibold text-white dark:bg-white dark:text-slate-900">Shortlist</span>
        <span className="flex-1 rounded-xl border border-slate-200 py-2 text-center text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">View full profile</span>
      </div>
    </div>
  );
}

// Mirrors the backend's ensurePassword rules so people see them before submitting.
const PASSWORD_RULES = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'an uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'a lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'a number', test: (p: string) => /[0-9]/.test(p) },
];

export default function RecruiterSignupPage() {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', company: '', position: '', website: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setField = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const weak = PASSWORD_RULES.find((rule) => !rule.test(form.password));
    if (weak) { setError(`Password needs ${weak.label}.`); return; }
    if (form.password !== confirmPassword) { setError('The two passwords do not match.'); return; }
    const website = form.website.trim();
    if (website && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(website.startsWith('http') ? website : `https://${website}`)) {
      setError('That website does not look right. Try something like novalabs.com.');
      return;
    }
    setLoading(true);
    try {
      await recruiterSignup({ ...form, website: website && !website.startsWith('http') ? `https://${website}` : website });
      router.push('/recruiter');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create recruiter account');
    } finally {
      setLoading(false);
    }
  }

  const fields = (
    <>
      <AuthField label="Full name" placeholder="e.g. Ngozi Eze" autoComplete="name" value={form.fullName} onChange={setField('fullName')} required />
      <AuthField label="Work email" placeholder="you@company.com" type="email" autoComplete="email" value={form.email} onChange={setField('email')} required />
      <AuthField label="Password" placeholder="Create a password" type="password" autoComplete="new-password" value={form.password} onChange={setField('password')} required />
      {form.password ? (
        <ul className="-mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Password rules">
          {PASSWORD_RULES.map((rule) => (
            <li key={rule.label} className={rule.test(form.password) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}>{rule.test(form.password) ? '✓' : '○'} {rule.label}</li>
          ))}
        </ul>
      ) : null}
      <AuthField label="Confirm password" placeholder="Type it again" type="password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} required />
      <AuthField label="Company name" placeholder="e.g. NovaLabs" autoComplete="organization" value={form.company} onChange={setField('company')} required />
      <AuthField label="Your role (optional)" placeholder="e.g. Talent lead" autoComplete="organization-title" value={form.position} onChange={setField('position')} />
      <AuthField label="Company website (optional)" placeholder="e.g. novalabs.com" value={form.website} onChange={setField('website')} />
      <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600 dark:bg-slate-900 dark:text-slate-400">
        <p className="font-semibold text-slate-800 dark:text-slate-200">What happens next</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
          <li>Confirm your email from the link we send you.</li>
          <li>Ask for employer verification from your portal. Our team checks your company.</li>
          <li>Until then, each job you post is reviewed before students see it. Once verified, jobs go live straight away.</li>
        </ol>
      </div>
      {error ? <p className="auth-error-text">{error}</p> : null}
      <button type="submit" className="auth-button auth-button-primary" disabled={loading}>
        {loading ? 'Creating your account…' : 'Create recruiter account'}
      </button>
      <p className="auth-footer-copy">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
      <p className="auth-footer-copy">
        Are you a student? <Link href="/signup">Sign up as a student</Link>
      </p>
    </>
  );

  if (isMobile) {
    return (
      <main className="auth-mobile-page">
        <Link href="/" className="auth-center-brand auth-mobile-brand">
          <div className="auth-logo-mark">G</div>
          <div className="guildos-logo-copy">
            <strong>GuildOS</strong>
            <span>Find your people on campus</span>
          </div>
        </Link>
        <section className="auth-mobile-card auth-card-surface">
          <div className="auth-card-header auth-card-header-center">
            <div>
              <p className="auth-card-eyebrow">For employers</p>
              <h1>Create your recruiter account</h1>
              <p>Post jobs and find students by what they have actually done.</p>
            </div>
          </div>
          <form id="recruiter-signup-form" className="auth-form" onSubmit={handleSubmit}>
            {fields}
          </form>
        </section>
      </main>
    );
  }

  return (
    <AuthSplitLayout
      heroKicker="For employers"
      heroTitle="Hire students by what they have actually done"
      heroText="Attendance is checked in at the door and certificates come from the clubs that ran the event. Post a job and see each applicant with their real record, not just a CV."
      heroBody={<SampleApplicantCard />}
      cardTitle="Create your recruiter account"
      cardSubtitle="Post jobs and internships, then see who applied and what they have done on campus."
    >
      <form id="recruiter-signup-form" className="auth-form" onSubmit={handleSubmit}>
        {fields}
      </form>
    </AuthSplitLayout>
  );
}
