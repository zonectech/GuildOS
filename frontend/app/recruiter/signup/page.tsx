'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { recruiterSignup } from '../../../components/guildos/auth-api';
import { AuthField, AuthSplitLayout } from '../../../components/guildos/auth-pages';
import { useMediaQuery } from '../../../components/guildos/use-media-query';

export default function RecruiterSignupPage() {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', company: '', position: '', website: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setField = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await recruiterSignup(form);
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
      <AuthField label="Company / Organization" autoComplete="organization" value={form.company} onChange={setField('company')} required />
      <AuthField label="Your Position" autoComplete="organization-title" value={form.position} onChange={setField('position')} />
      <AuthField label="Website" placeholder="https://" value={form.website} onChange={setField('website')} />
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
            <span>Student Portfolio Platform</span>
          </div>
        </Link>
        <section className="auth-mobile-card auth-card-surface">
          <div className="auth-card-header auth-card-header-center">
            <div>
              <p className="auth-card-eyebrow">For Recruiters</p>
              <h1>Create your recruiter account</h1>
              <p>Post opportunities and discover students by verified reputation.</p>
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
      heroText="Post opportunities and discover students by verified participation, leadership, and certificates — not just claims on a CV."
      heroBody={
        <div className="auth-portfolio-card">
          <div className="auth-portfolio-header">
            <div>
              <span className="auth-portfolio-label">Candidate Profile</span>
              <strong>GuildOS Verified Talent</strong>
            </div>
            <span className="auth-live-pill">Verified</span>
          </div>
          <div className="auth-portfolio-grid">
            <div><span>Events Attended</span><strong>18</strong></div>
            <div><span>Certificates</span><strong>12</strong></div>
            <div><span>Leadership Roles</span><strong>4</strong></div>
            <div><span>Reputation</span><strong>Top 5%</strong></div>
          </div>
          <div className="auth-badge-row" aria-hidden="true"><span>Verified</span><span>Leadership</span><span>Certificates</span></div>
        </div>
      }
      cardTitle="Recruiter Sign Up"
      cardSubtitle="Create an account to post opportunities and discover verified student talent."
    >
      <form id="recruiter-signup-form" className="auth-form" onSubmit={handleSubmit}>
        {fields}
      </form>
    </AuthSplitLayout>
  );
}
