'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as m from 'motion/react-m';
import { MailCheck } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import { spring } from '@/lib/motion';
import { Btn } from '@/components/ui/bits';
import { AuthCard, ErrorNote, inputCls, PasswordField, passwordOk } from '@/components/auth/auth-bits';
import { useToast } from '@/components/ui/toast';
import { Opt, Req, RequiredNote } from '@/components/ui/req';

/** Create an account. Same accounts and cookies as the current site. */
function SignupForm() {
  const router = useRouter();
  const toast = useToast();
  const next = useSearchParams().get('next');
  const { user, loading, reload } = useSession();
  const [f, setF] = useState({ fullName: '', email: '', password: '', university: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/api/auth/signup', { method: 'POST', body: JSON.stringify({ fullName: f.fullName.trim(), email: f.email.trim(), password: f.password, university: f.university.trim() }) });
      await reload();
      setSent(f.email.trim());
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create your account'); }
    finally { setBusy(false); }
  }
  const resend = () => api('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: sent }) }).then(() => toast('Sent again')).catch((e: Error) => toast(e.message));

  useEffect(() => {
    if (!loading && user && !sent) router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/events');
  }, [loading, user, sent, next, router]);

  if (sent) {
    return (
      <AuthCard stamp="Welcome" title="Check your email" lead={<>We sent a link to <b className="text-ink">{sent}</b>. Open it to verify your account.</>}>
        <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.bouncy} className="mx-auto grid size-14 place-items-center rounded-full bg-tint text-green-text"><MailCheck size={26} /></m.span>
        <Btn size="lg" wide onClick={() => router.replace(`/onboarding${next && next.startsWith('/') ? `?next=${encodeURIComponent(next)}` : ''}`)}>Set up your profile</Btn>
        <p className="text-center text-[14px] text-muted">No email? Check spam, or <button type="button" onClick={() => void resend()} className="font-semibold text-green-text hover:underline">send it again</button>.</p>
      </AuthCard>
    );
  }
  if (loading || user) return <div role="status" className="px-4 py-20 text-center text-[14px] text-muted">Checking your account…</div>;

  return (
    <AuthCard stamp="Your first stamp" title="Create your account" lead="Register for events, check in with a QR pass, and collect a stamp for every event you attend." onSubmit={submit}>
      <RequiredNote className="-mb-1" />
      <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Full name<Req /></span><input required autoComplete="name" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} className={inputCls} /></label>
      <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Email<Req /></span><input type="email" required autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} className={inputCls} /></label>
      <PasswordField required value={f.password} onChange={(v) => set('password', v)} />
      <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">School<Opt /></span><input autoComplete="organization" value={f.university} onChange={(e) => set('university', e.target.value)} placeholder="e.g. Ahmadu Bello University" className={inputCls} /></label>
      <ErrorNote text={error} />
      <Btn size="lg" wide type="submit" disabled={busy || f.fullName.trim().length < 2 || !passwordOk(f.password)}>{busy ? 'Creating your account…' : 'Create account'}</Btn>
      <p className="text-center text-[14px] text-muted">Already have an account? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-green-text hover:underline">Sign in</Link></p>
      <p className="text-center text-[12.5px] text-muted">By creating an account you agree to the <Link href="/terms" className="font-semibold text-green-text hover:underline">terms</Link> and <Link href="/privacy" className="font-semibold text-green-text hover:underline">privacy policy</Link>.</p>
    </AuthCard>
  );
}

export default function SignupPage() {
  return <Suspense fallback={null}><SignupForm /></Suspense>;
}
