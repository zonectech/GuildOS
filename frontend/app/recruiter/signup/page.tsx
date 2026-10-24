'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { recruiterSignup } from '../../../components/guildos/auth-api';
import { AuthField, AuthSplitLayout } from '../../../components/guildos/auth-pages';
import { useMediaQuery } from '../../../components/guildos/use-media-query';

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
      <AuthField label="Your Full Name" autoComplete="name" value={form.fullName} onChange={setField('fullName')} required />
      <AuthField label="Work Email" type="email" autoComplete="email" value={form.email} onChange={setField('email')} required />
      <AuthField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={setField('password')} required />
      {form.password ? (
        <ul className="-mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Password rules">
          {PASSWORD_RULES.map((rule) => (
            <li key={rule.label} className={rule.test(form.password) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}>{rule.test(form.password) ? '✓' : '○'} {rule.label}</li>
          ))}
        </ul>
      ) : null}
      <AuthField label="Confirm Password" type="password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} required />
      <AuthField label="Company / Organization" autoComplete="organization" value={form.company} onChange={setField('company')} required />
      <AuthField label="Your Position" autoComplete="organization-title" value={form.position} onChange={setField('position')} />
      <AuthField label="Company Website" placeholder="e.g. novalabs.com" value={form.website} onChange={setField('website')} />
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
        {loading ? 'Creating Account...' : 'Create recruiter account'}
      </button>
      <p className="auth-footer-copy">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
      <p className="auth-footer-copy">
        Are you a student? <Link href="/signup">Student sign up</Link>
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
              <p className="auth-card-eyebrow">For Recruiters</p>
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
      heroKicker="For Recruiters"
      heroTitle="Hire students with verified track records"
      heroText="Post opportunities and discover students by verified participation, leadership and certificates, not just claims on a CV."
      heroBody={
        <div className="auth-portfolio-card">
          <div className="auth-portfolio-header">
            <div>
              <span className="auth-portfolio-label">Example profile</span>
              <strong>What you see for each student</strong>
            </div>
            <span className="auth-live-pill">Sample</span>
          </div>
          <div className="auth-portfolio-grid">
            <div><span>Events Attended</span><strong>18</strong></div>
            <div><span>Certificates</span><strong>12</strong></div>
            <div><span>Leadership Roles</span><strong>4</strong></div>
            <div><span>Guild Score</span><strong>1,450</strong></div>
          </div>
          <div className="auth-badge-row" aria-hidden="true"><span>Verified</span><span>Leadership</span><span>Certificates</span></div>
        </div>
      }
      cardTitle="Recruiter Sign Up"
      cardSubtitle="Post jobs and internships, then see who applied with their verified record."
    >
      <form id="recruiter-signup-form" className="auth-form" onSubmit={handleSubmit}>
        {fields}
      </form>
    </AuthSplitLayout>
  );
}
