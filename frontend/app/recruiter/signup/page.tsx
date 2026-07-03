'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { recruiterSignup } from '../../../components/guildos/auth-api';

export default function RecruiterSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', company: '', position: '', website: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">Recruiter sign up</h1>
        <p className="mt-1 text-sm text-slate-500">Create an account to post opportunities and discover students by verified reputation.</p>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input className="ev-input w-full" placeholder="Full name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className="ev-input w-full" type="email" placeholder="Work email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="ev-input w-full" type="password" placeholder="Password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="ev-input w-full" placeholder="Company / organization" required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className="ev-input w-full" placeholder="Your position" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            <input className="ev-input w-full" placeholder="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
            {loading ? 'Creating account…' : 'Create recruiter account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-medium text-indigo-600 hover:underline">Sign in</Link>
        </p>
        <p className="mt-1 text-center text-sm text-slate-500">
          Are you a student? <Link href="/signup" className="font-medium text-indigo-600 hover:underline">Student sign up</Link>
        </p>
      </div>
    </main>
  );
}
