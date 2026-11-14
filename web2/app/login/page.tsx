'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as m from 'motion/react-m';
import { Eye, EyeOff } from 'lucide-react';
import { safeNext } from '@/lib/next-path';
import { api } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import { spring } from '@/lib/motion';
import { Btn } from '@/components/ui/bits';
import { Stamp } from '@/components/brand/stamp';
import { Req } from '@/components/ui/req';

/** Sign in. Same accounts and cookies as the current site, so signing in here signs you in there too. */
function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const { reload } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
      await reload();
      router.replace(safeNext(next));
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in'); }
    finally { setBusy(false); }
  }

  return (
    <m.form onSubmit={submit} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: spring.soft }} className="flex w-full max-w-[420px] flex-col gap-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <m.span initial={{ scale: 1.8, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: -10, opacity: 1, transition: { ...spring.bouncy, delay: 0.1 } }}>
          <Stamp label="Welcome back" size={92} tilt={0} />
        </m.span>
        <h1 className="text-[40px] font-extrabold">Sign in</h1>
        <p className="text-[15px] text-muted">Pick up where you left off. Every event you attend counts.</p>
      </div>
      <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Email<Req /></span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-2xl border border-line bg-surface px-4 text-[16px] outline-none focus:border-green-text" />
      </label>
      <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Password<Req /></span>
        <span className="relative">
          <input type={show ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full rounded-2xl border border-line bg-surface px-4 pr-12 text-[16px] outline-none focus:border-green-text" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-muted hover:bg-mist">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </span>
      </label>
      {error ? <p role="alert" className="rounded-2xl bg-[color-mix(in_srgb,var(--coral)_14%,transparent)] px-4 py-3 text-[14px] font-semibold text-coral-text">{error}</p> : null}
      <Btn size="lg" wide type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Btn>
      <p className="text-center text-[14px] text-muted">
        New here? <a href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-green-text hover:underline">Create an account</a>
        <span className="mx-2">·</span>
        <a href="/forgot-password" className="font-semibold text-green-text hover:underline">Forgot password</a>
      </p>
    </m.form>
  );
}

export default function LoginPage() {
  return (
    <div className="mesh grid min-h-[80dvh] place-items-center px-4 py-10">
      <Suspense fallback={null}><LoginForm /></Suspense>
    </div>
  );
}
