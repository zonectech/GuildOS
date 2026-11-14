'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { safeNext } from '@/lib/next-path';
import { api } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import { Btn } from '@/components/ui/bits';
import { AuthCard, ErrorNote, inputCls } from '@/components/auth/auth-bits';

/** "What did you think?" Goes straight to the team; the page you came from is attached. */
function FeedbackForm() {
  const from = useSearchParams().get('from') ?? '';
  const { user } = useSession();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api('/api/feedback', { method: 'POST', body: JSON.stringify({ message: message.trim(), page: safeNext(from, ''), email: user ? undefined : email.trim() }) }); setDone(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to send'); }
    finally { setBusy(false); }
  }
  if (done) return <AuthCard stamp="Thank you" title="Got it, thank you" lead="The team reads every message. If you left an email, we may reply."><Btn size="lg" wide href={safeNext(from)}>Back</Btn></AuthCard>;
  return (
    <AuthCard stamp="Tell us" title="What did you think?" lead="Something confusing, broken or missing? Tell us in your own words." onSubmit={submit}>
      <textarea required value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} aria-label="Your feedback" placeholder="e.g. I couldn't find where my QR pass was after registering." className="min-h-[150px] rounded-2xl border border-line bg-surface px-4 py-3 text-[16px] outline-none focus:border-green-text" />
      {!user ? <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Email <span className="font-normal text-muted">(optional, if you'd like a reply)</span></span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></label> : null}
      <ErrorNote text={error} />
      <Btn size="lg" wide type="submit" disabled={busy || message.trim().length < 3}>{busy ? 'Sending…' : 'Send feedback'}</Btn>
    </AuthCard>
  );
}
export default function FeedbackPage() { return <Suspense fallback={null}><FeedbackForm /></Suspense>; }
